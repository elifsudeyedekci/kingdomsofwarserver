import * as crypto from 'crypto';

/**
 * Encrypted login channel. The browser never sends the e-mail / password / 2FA code / captcha token as readable form fields: it encrypts them
 * (ECDH P-256 key agreement -> HKDF-SHA256 -> AES-256-GCM) with a short-lived server key, so DevTools / proxy logs / browser extensions see only an opaque blob.
 * Replay is blocked: every blob carries a timestamp (valid 60 s) and a one-time nonce. This is IN ADDITION to TLS (which is what protects the wire).
 */

interface KeyGen { kid: string; privateKey: crypto.KeyObject; publicJwk: JsonWebKey; createdAt: number }
const ROTATE_MS = 10 * 60_000;
const keys: KeyGen[] = [];
const seenNonces = new Map<string, number>();

function fresh(): KeyGen {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const k = { kid: crypto.randomBytes(8).toString('hex'), privateKey, publicJwk: publicKey.export({ format: 'jwk' }) as JsonWebKey, createdAt: Date.now() };
  keys.unshift(k); if (keys.length > 3) keys.length = 3; return k;
}

export function currentKey() {
  if (!keys.length || Date.now() - keys[0].createdAt > ROTATE_MS) fresh();
  return { kid: keys[0].kid, publicKey: keys[0].publicJwk };
}

export interface LoginSecrets { email: string; password: string; otp?: string; captcha?: string }

/** payload = base64url(JSON { kid, epk (client public JWK), iv, ct }) */
export function decryptLogin(payload: string): LoginSecrets | null {
  try {
    const env = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { kid: string; epk: JsonWebKey; iv: string; ct: string };
    const k = keys.find((x) => x.kid === env.kid); if (!k) return null;
    const shared = crypto.diffieHellman({ privateKey: k.privateKey, publicKey: crypto.createPublicKey({ key: env.epk, format: 'jwk' } as unknown as crypto.JsonWebKeyInput) });
    const key = Buffer.from(crypto.hkdfSync('sha256', shared, Buffer.alloc(0), Buffer.from('kow-admin-login-v1'), 32));
    const ct = Buffer.from(env.ct, 'base64url'), iv = Buffer.from(env.iv, 'base64url');
    const d = crypto.createDecipheriv('aes-256-gcm', key, iv); d.setAuthTag(ct.subarray(ct.length - 16));
    const plain = JSON.parse(Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]).toString('utf8')) as LoginSecrets & { ts: number; nonce: string };
    const now = Date.now();
    if (Math.abs(now - plain.ts) > 60_000 || !plain.nonce || seenNonces.has(plain.nonce)) return null;       // stale or replayed
    seenNonces.set(plain.nonce, now);
    for (const [n, t] of seenNonces) if (now - t > 120_000) seenNonces.delete(n);
    return { email: plain.email, password: plain.password, otp: plain.otp, captcha: plain.captcha };
  } catch { return null; }
}
