import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service';

export const ADMIN_AUD = 'kow-admin';
export const JWT_ISS = 'kow-backend';
export const sha256hex = (s: string) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');

export interface AdminPrincipal { kind: 'admin'; id: string; email: string; username: string; name: string; role: string; sid: string; limited: boolean }

const IDLE_MS = Number(process.env.ADMIN_IDLE_MINUTES ?? 30) * 60_000;       // no request for this long -> the session is dead
const ABSOLUTE_MS = Number(process.env.ADMIN_SESSION_HOURS ?? 12) * 3_600_000; // hard lifetime of one sign-in
const ACCESS_TTL = process.env.ADMIN_JWT_EXPIRES_IN ?? '10m';

/**
 * Panel sessions. Every login creates a NEW random session id (256 bit) - ids are never reused or fixed. The access token (short lived JWT, aud=kow-admin, HS256 pinned, signed
 * with a secret that differs from the player one) carries that id; every request is checked against the session row (revocation is immediate, ~2 s cache).
 * The refresh token is opaque (256 bit random), kept only as a SHA-256 hash and ROTATED on each use. Presenting a rotated-out token again means it was copied: the whole session dies.
 */
@Injectable()
export class AdminSessionService {
  private readonly logger = new Logger(AdminSessionService.name);
  private cache = new Map<string, { at: number; value: AdminPrincipal | null }>();

  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService, private readonly config: ConfigService) {}

  /** Secret for admin tokens: ADMIN_JWT_SECRET, else derived from JWT_SECRET (so the two token kinds can never be mixed up). */
  secret(): string {
    const explicit = this.config.get<string>('ADMIN_JWT_SECRET');
    if (explicit) return explicit;
    return crypto.createHmac('sha256', this.config.getOrThrow<string>('JWT_SECRET')).update('kow-admin-access-v1').digest('hex');
  }

  signAccess(admin: { id: string; name: string }, sid: string, limited: boolean) {
    return this.jwt.sign({ sub: admin.id, sid, typ: 'admin', lim: limited ? 1 : 0, jti: crypto.randomBytes(12).toString('hex') }, { secret: this.secret(), algorithm: 'HS256', audience: ADMIN_AUD, issuer: JWT_ISS, expiresIn: ACCESS_TTL as never });
  }

  async create(admin: { id: string; name: string }, ctx: { ip?: string; userAgent?: string }, limited = false) {
    const sid = crypto.randomBytes(32).toString('hex');
    const refresh = crypto.randomBytes(32).toString('base64url');
    await this.prisma.adminSession.create({ data: { id: sid, adminId: admin.id, refreshHash: sha256hex(refresh), ip: ctx.ip, userAgent: ctx.userAgent?.slice(0, 300), limited, expiresAt: new Date(Date.now() + ABSOLUTE_MS) } });
    return { sid, accessToken: this.signAccess(admin, sid, limited), refreshToken: refresh };
  }

  /** Rotates the refresh token. Returns null when the session is gone (caller answers 401); reuse of an old token revokes the session and is reported to `onTheft`. */
  async rotate(refreshToken: string, ctx: { ip?: string; userAgent?: string }, onTheft?: (adminId: string, sid: string) => Promise<void>) {
    const h = sha256hex(refreshToken ?? '');
    const s = await this.prisma.adminSession.findUnique({ where: { refreshHash: h } });
    if (!s) {
      const old = await this.prisma.adminSession.findFirst({ where: { prevRefreshHash: h } });
      if (old && !old.revokedAt) { await this.revoke(old.id, 'refresh-token-reuse'); await onTheft?.(old.adminId, old.id); }
      return null;
    }
    const now = Date.now();
    if (s.revokedAt || s.expiresAt.getTime() < now || now - s.lastUsedAt.getTime() > IDLE_MS) { await this.revoke(s.id, 'expired'); return null; }
    const admin = await this.prisma.adminUser.findUnique({ where: { id: s.adminId } });
    if (!admin || !admin.isActive) { await this.revoke(s.id, 'admin-inactive'); return null; }
    const next = crypto.randomBytes(32).toString('base64url');
    await this.prisma.adminSession.update({ where: { id: s.id }, data: { refreshHash: sha256hex(next), prevRefreshHash: h, lastUsedAt: new Date(), ip: ctx.ip ?? s.ip, userAgent: ctx.userAgent?.slice(0, 300) ?? s.userAgent } });
    this.cache.delete(s.id);
    return { admin, sid: s.id, limited: s.limited, accessToken: this.signAccess(admin, s.id, s.limited), refreshToken: next, ipChanged: !!ctx.ip && !!s.ip && ctx.ip !== s.ip };
  }

  async revoke(sid: string, reason: string) {
    await this.prisma.adminSession.updateMany({ where: { id: sid, revokedAt: null }, data: { revokedAt: new Date(), revokedReason: reason } });
    this.cache.delete(sid);
  }
  async revokeAll(adminId: string, reason: string, exceptSid?: string) {
    const r = await this.prisma.adminSession.updateMany({ where: { adminId, revokedAt: null, ...(exceptSid ? { id: { not: exceptSid } } : {}) }, data: { revokedAt: new Date(), revokedReason: reason } });
    this.cache.clear(); return r.count;
  }
  /** After 2FA setup the limited session becomes a normal one (a NEW session id is issued: privilege change = new id). */
  async upgrade(sid: string, ctx: { ip?: string; userAgent?: string }) {
    const s = await this.prisma.adminSession.findUnique({ where: { id: sid } }); if (!s) throw new UnauthorizedException();
    const admin = await this.prisma.adminUser.findUnique({ where: { id: s.adminId } }); if (!admin) throw new UnauthorizedException();
    await this.revoke(sid, 'upgraded');
    return this.create(admin, ctx, false);
  }

  /** Verifies a panel access token completely (signature, alg, aud, iss, exp, live session, active admin). Used by HTTP and WebSocket. */
  async authenticate(token: string): Promise<AdminPrincipal> {
    let p: { sub: string; sid: string; lim?: number };
    try { p = this.jwt.verify(token, { secret: this.secret(), algorithms: ['HS256'], audience: ADMIN_AUD, issuer: JWT_ISS }); } catch { throw new UnauthorizedException(); }
    const principal = await this.principalFor(p.sid, p.sub);
    if (!principal) throw new UnauthorizedException();
    return principal;
  }

  async principalFor(sid: string, adminId: string): Promise<AdminPrincipal | null> {
    const hit = this.cache.get(sid); if (hit && Date.now() - hit.at < 2000) return hit.value && hit.value.id === adminId ? hit.value : null;
    const s = await this.prisma.adminSession.findUnique({ where: { id: sid } });
    let value: AdminPrincipal | null = null;
    if (s && !s.revokedAt && s.adminId === adminId && s.expiresAt.getTime() > Date.now() && Date.now() - s.lastUsedAt.getTime() <= IDLE_MS) {
      const a = await this.prisma.adminUser.findUnique({ where: { id: adminId } });
      if (a && a.isActive) {
        value = { kind: 'admin', id: a.id, email: a.email, username: a.name, name: a.name, role: a.role, sid, limited: s.limited };
        if (Date.now() - s.lastUsedAt.getTime() > 60_000) this.prisma.adminSession.update({ where: { id: sid }, data: { lastUsedAt: new Date() } }).catch(() => null);   // idle clock
      }
    }
    this.cache.set(sid, { at: Date.now(), value });
    return value;
  }

  list(adminId?: string) { return this.prisma.adminSession.findMany({ where: { ...(adminId ? { adminId } : {}), revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { lastUsedAt: 'desc' }, take: 200, select: { id: true, adminId: true, ip: true, userAgent: true, createdAt: true, lastUsedAt: true, expiresAt: true, limited: true } }); }
}
