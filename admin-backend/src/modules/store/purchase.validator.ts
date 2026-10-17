import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';

export interface ValidationResult { valid: boolean; transactionId: string; raw: unknown; reason?: string }
const b64u = (b: Buffer | string) => Buffer.from(b).toString('base64url');

/**
 * Server-side verification of in-app purchases. FAILS CLOSED: with no store credentials configured a real purchase is refused (never granted on trust).
 *   Google Play: GOOGLE_PLAY_PACKAGE + GOOGLE_SERVICE_ACCOUNT_JSON (file path or the JSON itself) - Android Publisher API purchases.products.get (+ acknowledge)
 *   Apple:       APPLE_ISSUER_ID + APPLE_KEY_ID + APPLE_PRIVATE_KEY (.p8 text or path) + APPLE_BUNDLE_ID [+ APPLE_ENV=production|sandbox] - App Store Server API
 *   Development: platform "editor" is accepted only while PAYMENTS_DEV_MODE=true (default outside production) - grants without any store (for local tests).
 * NOTE: the Google / Apple branches talk to the real store APIs and could not be exercised in this repository (they need your developer accounts); test them with sandbox purchases.
 */
@Injectable()
export class PurchaseValidator {
  private readonly logger = new Logger(PurchaseValidator.name);
  private gToken?: { value: string; exp: number };

  get devMode(): boolean { return (process.env.PAYMENTS_DEV_MODE ?? (process.env.NODE_ENV === 'production' ? 'false' : 'true')) === 'true'; }

  async validate(platform: 'android' | 'ios' | 'editor', sku: string, transactionId: string, receipt: string): Promise<ValidationResult> {
    try { return await this.validateInner(platform, sku, transactionId, receipt); }
    catch (e) { if (e instanceof BadRequestException || e instanceof ServiceUnavailableException) throw e; this.logger.error(`store validation failed: ${(e as Error).message}`); throw new ServiceUnavailableException('The store could not be reached, try again later'); }
  }

  private async validateInner(platform: 'android' | 'ios' | 'editor', sku: string, transactionId: string, receipt: string): Promise<ValidationResult> {
    if (platform === 'editor') {
      if (!this.devMode) throw new BadRequestException('Development purchases are disabled on this server');
      return { valid: true, transactionId, raw: { dev: true } };
    }
    return platform === 'android' ? this.google(sku, receipt, transactionId) : this.apple(sku, transactionId);
  }

  // ── Google Play ──
  private serviceAccount(): { client_email: string; private_key: string } {
    const v = process.env.GOOGLE_SERVICE_ACCOUNT_JSON; if (!v) throw new ServiceUnavailableException('Google Play validation is not configured (GOOGLE_SERVICE_ACCOUNT_JSON)');
    try { return JSON.parse(v.trim().startsWith('{') ? v : fs.readFileSync(v, 'utf8')); } catch { throw new ServiceUnavailableException('GOOGLE_SERVICE_ACCOUNT_JSON is unreadable'); }
  }
  private async googleToken(): Promise<string> {
    if (this.gToken && this.gToken.exp > Date.now() + 60_000) return this.gToken.value;
    const sa = this.serviceAccount(); const now = Math.floor(Date.now() / 1000);
    const head = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' })), body = b64u(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3000 }));
    const sig = crypto.createSign('RSA-SHA256').update(`${head}.${body}`).sign(sa.private_key).toString('base64url');
    const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${body}.${sig}` }), signal: AbortSignal.timeout(10_000) });
    const j = (await r.json()) as { access_token?: string; expires_in?: number };
    if (!j.access_token) throw new ServiceUnavailableException('Google authentication failed');
    this.gToken = { value: j.access_token, exp: Date.now() + (j.expires_in ?? 3000) * 1000 }; return j.access_token;
  }
  /** Unity IAP hands over a JSON receipt { Store, TransactionID, Payload: '{\"json\":\"{...purchaseToken...}\",\"signature\":...}' }; a bare purchase token is accepted too. */
  static googleToken(receipt: string): string {
    const t = receipt.trim(); if (!t.startsWith('{')) return t;
    try {
      const outer = JSON.parse(t) as { Payload?: string }; const payload = JSON.parse(outer.Payload ?? '{}') as { json?: string };
      const inner = JSON.parse(payload.json ?? '{}') as { purchaseToken?: string };
      if (inner.purchaseToken) return inner.purchaseToken;
    } catch { /* fall through */ }
    throw new BadRequestException('Unreadable Google Play receipt');
  }
  private async google(sku: string, receipt: string, transactionId: string): Promise<ValidationResult> {
    const token = PurchaseValidator.googleToken(receipt);
    const pkg = process.env.GOOGLE_PLAY_PACKAGE; if (!pkg) throw new ServiceUnavailableException('Google Play validation is not configured (GOOGLE_PLAY_PACKAGE)');
    const at = await this.googleToken();
    const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(pkg)}/purchases/products/${encodeURIComponent(sku)}/tokens/${encodeURIComponent(token)}`;
    const r = await fetch(base, { headers: { authorization: `Bearer ${at}` }, signal: AbortSignal.timeout(10_000) });
    const j = (await r.json()) as { purchaseState?: number; orderId?: string; acknowledgementState?: number; error?: unknown };
    if (!r.ok) return { valid: false, transactionId, raw: j, reason: 'store rejected the purchase token' };
    const ok = j.purchaseState === 0;                       // 0 = purchased (1 canceled, 2 pending)
    if (ok && j.acknowledgementState === 0) await fetch(`${base}:acknowledge`, { method: 'POST', headers: { authorization: `Bearer ${at}`, 'content-type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(10_000) }).catch((e) => this.logger.warn(`acknowledge failed: ${e}`));
    return { valid: ok, transactionId: j.orderId ?? transactionId, raw: j, reason: ok ? undefined : `purchaseState ${j.purchaseState}` };
  }

  // ── Apple App Store Server API ──
  private appleJwt(): string {
    const iss = process.env.APPLE_ISSUER_ID, kid = process.env.APPLE_KEY_ID, bid = process.env.APPLE_BUNDLE_ID; let key = process.env.APPLE_PRIVATE_KEY;
    if (!iss || !kid || !bid || !key) throw new ServiceUnavailableException('Apple validation is not configured (APPLE_ISSUER_ID / APPLE_KEY_ID / APPLE_PRIVATE_KEY / APPLE_BUNDLE_ID)');
    key = key.replace(/\\n/g, '\n');       // .env files carry the .p8 on one line with literal backslash-n

    const now = Math.floor(Date.now() / 1000);
    const head = b64u(JSON.stringify({ alg: 'ES256', kid, typ: 'JWT' })), body = b64u(JSON.stringify({ iss, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1', bid }));
    const sig = crypto.sign('sha256', Buffer.from(`${head}.${body}`), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url');
    return `${head}.${body}.${sig}`;
  }
  private async apple(sku: string, transactionId: string): Promise<ValidationResult> {
    const host = (process.env.APPLE_ENV ?? 'production') === 'sandbox' ? 'api.storekit-sandbox.itunes.apple.com' : 'api.storekit.itunes.apple.com';
    const r = await fetch(`https://${host}/inApps/v1/transactions/${encodeURIComponent(transactionId)}`, { headers: { authorization: `Bearer ${this.appleJwt()}` }, signal: AbortSignal.timeout(10_000) });
    if (!r.ok) return { valid: false, transactionId, raw: { status: r.status }, reason: 'App Store did not know this transaction' };
    const j = (await r.json()) as { signedTransactionInfo?: string };
    const payload = JSON.parse(Buffer.from((j.signedTransactionInfo ?? '..').split('.')[1] ?? '', 'base64url').toString('utf8') || '{}') as { bundleId?: string; productId?: string; transactionId?: string; originalTransactionId?: string; revocationDate?: number };
    const ok = payload.bundleId === process.env.APPLE_BUNDLE_ID && payload.productId === sku && !payload.revocationDate && (payload.transactionId === transactionId || payload.originalTransactionId === transactionId);
    return { valid: ok, transactionId: payload.transactionId ?? transactionId, raw: payload, reason: ok ? undefined : 'transaction does not match this app / product or was refunded' };
  }
}
