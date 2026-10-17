import { BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus, Injectable, Logger, NotFoundException, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { ADMIN_ROLES } from '../../common/policy/route-policy';
import { SecurityService } from '../security/security.service';
import { AdminSessionService, sha256hex } from './admin-session.service';
import { verifyCaptcha } from './captcha';
import { newTotpSecret, otpauthUrl, verifyTotp } from './totp';

const MAX_FAILS = 6;
const LOCK_MS = 15 * 60_000;
const MIN_PASSWORD = 12;
// compared against when the e-mail is unknown, so "no such user" costs the same time as "wrong password" (no account enumeration by timing)
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 12);

export interface ReqCtx { ip?: string; userAgent?: string }

export function passwordProblem(pw: string): string | null {
  if (!pw || pw.length < MIN_PASSWORD) return `Password must be at least ${MIN_PASSWORD} characters`;
  if (pw.length > 128) return 'Password is too long';
  if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw) || !/\d/.test(pw)) return 'Password needs lower case, upper case and a digit';
  if (/^(.)\1+$/.test(pw) || /(password|123456|qwerty|kingdoms)/i.test(pw)) return 'Password is too easy to guess';
  return null;
}

@Injectable()
export class AdminAuthService implements OnModuleInit {
  private readonly logger = new Logger(AdminAuthService.name);
  private readonly fails = new Map<string, { n: number; until: number }>();

  constructor(private readonly prisma: PrismaService, private readonly sessions: AdminSessionService, private readonly config: ConfigService, private readonly security: SecurityService) {}

  /** Two-factor is mandatory for every admin in production (ADMIN_REQUIRE_2FA=false to relax, e.g. local development). */
  private get require2fa() { return this.config.get<string>('ADMIN_REQUIRE_2FA', this.config.get('NODE_ENV') === 'production' ? 'true' : 'false') === 'true'; }

  /** First start: create the owner account from ADMIN_DEFAULT_EMAIL / ADMIN_DEFAULT_PASSWORD (the password is never logged). */
  async onModuleInit() {
    try {
      if ((await this.prisma.adminUser.count()) > 0) return;
      const email = this.config.get<string>('ADMIN_DEFAULT_EMAIL');
      const password = this.config.get<string>('ADMIN_DEFAULT_PASSWORD');
      if (!email || !password) { this.logger.warn('No admin exists and ADMIN_DEFAULT_EMAIL / ADMIN_DEFAULT_PASSWORD are not set: nobody can sign in to the panel'); return; }
      const problem = passwordProblem(password);
      if (problem) { this.logger.warn(`ADMIN_DEFAULT_PASSWORD rejected: ${problem}`); return; }
      await this.prisma.adminUser.create({ data: { email: email.toLowerCase(), passwordHash: await bcrypt.hash(password, 12), name: 'Owner', role: 'owner' } });
      this.logger.log(`Created the first admin account (${email}, role owner)`);
    } catch (e) { this.logger.warn(`Admin seed skipped: ${(e as Error).message}`); }
  }

  private profile(a: { id: string; email: string; name: string; role: string; twoFactorEnabled: boolean; lastLoginAt: Date | null }) {
    return { id: a.id, email: a.email, name: a.name, role: a.role, twoFactorEnabled: a.twoFactorEnabled, lastLoginAt: a.lastLoginAt };
  }

  // ── sign in ──
  async login(emailRaw: string, password: string, otp: string | undefined, captchaToken: string | undefined, ctx: ReqCtx) {
    const email = String(emailRaw ?? '').trim().toLowerCase().slice(0, 200);
    const key = `${email}|${ctx.ip ?? ''}`;
    const f = this.fails.get(email);
    if (f && f.n >= MAX_FAILS && f.until > Date.now()) {
      await this.security.event('LOGIN_LOCKED', 'warn', ctx, { email });
      throw new HttpException('Too many failed attempts. Try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }
    if (!(await verifyCaptcha(captchaToken, ctx.ip))) {
      await this.security.event('LOGIN_CAPTCHA_FAILED', 'warn', ctx, { email }); void this.security.offense(ctx.ip, 'captcha');
      throw new UnauthorizedException({ message: 'Captcha failed', code: 'CAPTCHA' });
    }
    const admin = await this.prisma.adminUser.findUnique({ where: { email } });
    const passwordOk = await bcrypt.compare(password ?? '', admin?.passwordHash ?? DUMMY_HASH);   // always one bcrypt compare
    if (!admin || !admin.isActive || !passwordOk) return this.fail(email, key, ctx, 'password', f);

    if (admin.twoFactorEnabled) {
      if (!otp) throw new UnauthorizedException({ message: 'Two-factor code required', code: 'OTP_REQUIRED' });
      const ok = (admin.twoFactorSecret && verifyTotp(admin.twoFactorSecret, otp)) || (await this.useRecoveryCode(admin.id, admin.recoveryCodes, otp));
      if (!ok) return this.fail(email, key, ctx, 'otp', f, 'OTP_INVALID');
    }
    this.fails.delete(email);
    const updated = await this.prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
    const limited = this.require2fa && !admin.twoFactorEnabled;           // must enrol 2FA before anything else
    const s = await this.sessions.create(updated, ctx, limited);
    await this.security.event('LOGIN_OK', 'info', { ...ctx, adminId: admin.id }, { limited });
    return { accessToken: s.accessToken, refreshToken: s.refreshToken, limited, admin: this.profile(updated) };
  }

  private async fail(email: string, _key: string, ctx: ReqCtx, why: string, prev: { n: number; until: number } | undefined, code?: string): Promise<never> {
    const n = (prev && prev.until > Date.now() ? prev.n : 0) + 1;
    this.fails.set(email, { n, until: Date.now() + LOCK_MS });
    await this.security.event('LOGIN_FAILED', n >= MAX_FAILS ? 'high' : 'warn', ctx, { email, why, attempts: n });
    void this.security.offense(ctx.ip, 'login');
    throw new UnauthorizedException(code ? { message: 'Invalid two-factor code', code } : 'Invalid e-mail or password');
  }

  async refresh(token: string, ctx: ReqCtx) {
    const r = await this.sessions.rotate(token, ctx, async (adminId, sid) => {
      await this.security.event('REFRESH_TOKEN_REUSE', 'critical', { ...ctx, adminId }, { sid, note: 'a rotated-out refresh token was presented again: session revoked' });
      void this.security.offense(ctx.ip, 'token-reuse');
    });
    if (!r) throw new UnauthorizedException('Session ended');
    if (r.ipChanged) await this.security.event('SESSION_IP_CHANGED', 'warn', { ...ctx, adminId: r.admin.id }, { sid: r.sid });
    return { accessToken: r.accessToken, refreshToken: r.refreshToken, limited: r.limited, admin: this.profile(r.admin) };
  }

  async logout(sid: string) { await this.sessions.revoke(sid, 'logout'); return { ok: true }; }
  async logoutAll(adminId: string) { const n = await this.sessions.revokeAll(adminId, 'logout-all'); return { ok: true, revoked: n }; }
  async me(id: string) { const a = await this.prisma.adminUser.findUnique({ where: { id } }); if (!a) throw new NotFoundException(); return this.profile(a); }

  async changePassword(id: string, sid: string, ctx: ReqCtx, current: string, next: string) {
    const a = await this.prisma.adminUser.findUnique({ where: { id } });
    if (!a || !(await bcrypt.compare(current ?? '', a.passwordHash))) throw new UnauthorizedException('Current password is wrong');
    const problem = passwordProblem(next); if (problem) throw new BadRequestException(problem);
    if (await bcrypt.compare(next, a.passwordHash)) throw new BadRequestException('The new password must differ from the current one');
    await this.prisma.adminUser.update({ where: { id }, data: { passwordHash: await bcrypt.hash(next, 12) } });
    await this.sessions.revokeAll(id, 'password-changed');            // every session (every device) dies; a brand-new session id is issued below
    const s = await this.sessions.create(a, ctx, a.twoFactorEnabled ? false : this.require2fa);
    await this.security.event('PASSWORD_CHANGED', 'info', { ...ctx, adminId: id });
    return { accessToken: s.accessToken, refreshToken: s.refreshToken };
  }

  // ── two-factor ──
  async twoFactorSetup(id: string) {
    const a = await this.prisma.adminUser.findUnique({ where: { id } }); if (!a) throw new NotFoundException();
    if (a.twoFactorEnabled) throw new ConflictException('Two-factor is already enabled');
    const secret = newTotpSecret();
    await this.prisma.adminUser.update({ where: { id }, data: { twoFactorSecret: secret } });
    return { secret, otpauthUrl: otpauthUrl(secret, a.email) };
  }
  /** Turns 2FA on, returns ten ONE-TIME recovery codes (shown once, stored hashed) and a fresh full session (new session id). */
  async twoFactorEnable(id: string, sid: string, ctx: ReqCtx, code: string) {
    const a = await this.prisma.adminUser.findUnique({ where: { id } });
    if (!a?.twoFactorSecret) throw new BadRequestException('Run setup first');
    if (!verifyTotp(a.twoFactorSecret, code)) throw new UnauthorizedException('Invalid code');
    const codes = Array.from({ length: 10 }, () => crypto.randomBytes(5).toString('hex'));
    await this.prisma.adminUser.update({ where: { id }, data: { twoFactorEnabled: true, recoveryCodes: codes.map((c) => sha256hex(c)) as never } });
    const s = await this.sessions.upgrade(sid, ctx);
    await this.security.event('TWO_FACTOR_ENABLED', 'info', { ...ctx, adminId: id });
    return { ok: true, recoveryCodes: codes, accessToken: s.accessToken, refreshToken: s.refreshToken };
  }
  async twoFactorDisable(id: string, password: string, code: string, ctx: ReqCtx) {
    const a = await this.prisma.adminUser.findUnique({ where: { id } });
    if (!a || !(await bcrypt.compare(password ?? '', a.passwordHash))) throw new UnauthorizedException('Password is wrong');
    if (a.twoFactorEnabled && !(a.twoFactorSecret && verifyTotp(a.twoFactorSecret, code))) throw new UnauthorizedException('Invalid code');
    if (this.require2fa) throw new ForbiddenException('Two-factor is mandatory on this server');
    await this.prisma.adminUser.update({ where: { id }, data: { twoFactorEnabled: false, twoFactorSecret: null, recoveryCodes: undefined } });
    await this.security.event('TWO_FACTOR_DISABLED', 'warn', { ...ctx, adminId: id });
    return { ok: true };
  }
  private async useRecoveryCode(adminId: string, stored: unknown, code: string): Promise<boolean> {
    const list = Array.isArray(stored) ? (stored as string[]) : []; const h = sha256hex(String(code ?? '').trim().toLowerCase());
    if (!list.includes(h)) return false;
    await this.prisma.adminUser.update({ where: { id: adminId }, data: { recoveryCodes: list.filter((x) => x !== h) as never } });
    await this.security.event('RECOVERY_CODE_USED', 'warn', { adminId }, { remaining: list.length - 1 });
    return true;
  }

  // ── admin account management (owner / super_admin / developer) ──
  private strip<T extends { passwordHash?: string; twoFactorSecret?: string | null; recoveryCodes?: unknown }>(a: T) { const { passwordHash, twoFactorSecret, recoveryCodes, ...rest } = a; void passwordHash; void twoFactorSecret; void recoveryCodes; return rest; }
  async list() { return (await this.prisma.adminUser.findMany({ orderBy: { createdAt: 'asc' } })).map((a) => this.strip(a)); }
  async create(actor: { role: string }, dto: { email: string; name: string; password: string; role: string }) {
    this.assertRole(dto.role); this.assertMayGrant(actor.role, dto.role);
    const problem = passwordProblem(dto.password); if (problem) throw new BadRequestException(problem);
    const email = dto.email.trim().toLowerCase();
    if (await this.prisma.adminUser.findUnique({ where: { email } })) throw new ConflictException('E-mail already in use');
    return this.strip(await this.prisma.adminUser.create({ data: { email, name: dto.name, role: dto.role as never, passwordHash: await bcrypt.hash(dto.password, 12) } }));
  }
  async update(actor: { id: string; role: string }, id: string, dto: { name?: string; role?: string; isActive?: boolean; password?: string; resetTwoFactor?: boolean }) {
    const target = await this.prisma.adminUser.findUnique({ where: { id } }); if (!target) throw new NotFoundException();
    this.assertMayGrant(actor.role, target.role);
    const data: Record<string, unknown> = {}; let revoke = false;
    if (dto.name) data.name = dto.name;
    if (dto.role) { this.assertRole(dto.role); this.assertMayGrant(actor.role, dto.role); if (id === actor.id && dto.role !== target.role) throw new BadRequestException('You cannot change your own role'); data.role = dto.role; revoke = true; }
    if (dto.isActive !== undefined) { if (id === actor.id && !dto.isActive) throw new BadRequestException('You cannot deactivate yourself'); data.isActive = dto.isActive; if (!dto.isActive) revoke = true; }
    if (dto.password) { const p = passwordProblem(dto.password); if (p) throw new BadRequestException(p); data.passwordHash = await bcrypt.hash(dto.password, 12); revoke = true; }
    if (dto.resetTwoFactor) { data.twoFactorEnabled = false; data.twoFactorSecret = null; revoke = true; }
    const row = await this.prisma.adminUser.update({ where: { id }, data });
    if (revoke) await this.sessions.revokeAll(id, 'account-changed');
    return this.strip(row);
  }
  private assertRole(role: string) { if (!(ADMIN_ROLES as readonly string[]).includes(role)) throw new BadRequestException(`Unknown role '${role}'`); }
  /** Only an owner may create/modify owners & super admins; super_admin may not touch owners. */
  private assertMayGrant(actorRole: string, role: string) {
    if (actorRole === 'owner') return;
    if (role === 'owner' || (role === 'super_admin' && actorRole !== 'super_admin')) throw new BadRequestException('Not allowed to manage this role');
  }
}
