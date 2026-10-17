import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AdminGateway } from '../../gateway/admin.gateway';

export type Severity = 'info' | 'warn' | 'high' | 'critical';

/** Obvious attack signatures: path traversal, script injection, SQL tautologies, log4shell-style lookups, null bytes. Checked on URL + query of every request. */
const ATTACK_PATTERNS: { name: string; re: RegExp }[] = [
  { name: 'path-traversal', re: /(\.\.[/\\])|(%2e%2e[/\\%])|(\.\.%2f)/i },
  { name: 'script-injection', re: /<\s*script|javascript:|onerror\s*=|onload\s*=/i },
  { name: 'sql-injection', re: /(\bunion\b[\s+]+\bselect\b)|(\bor\b[\s+]+1\s*=\s*1)|(;\s*drop\s+table)|(\bsleep\s*\(\s*\d)/i },
  { name: 'jndi-lookup', re: /\$\{\s*jndi:/i },
  { name: 'null-byte', re: /%00|\u0000/ },
  { name: 'shell-injection', re: /(\|\s*(cat|nc|bash|sh)\b)|(;\s*(cat|rm|wget|curl)\s)|(`[^`]*`)/i },
];

const OFFENSE_WINDOW_MS = 10 * 60_000;
const OFFENSE_LIMIT = Number(process.env.IP_AUTOBLOCK_OFFENSES ?? 25);
const AUTOBLOCK_MS = Number(process.env.IP_AUTOBLOCK_MINUTES ?? 60) * 60_000;

@Injectable()
export class SecurityService {
  private readonly logger = new Logger(SecurityService.name);
  private blocked = new Map<string, { until: number; auto: boolean }>();   // ip -> block (until ms, Infinity = permanent)
  private blockedLoadedAt = 0;
  private offenses = new Map<string, number[]>();
  private readonly allow = new Set((process.env.IP_ALLOWLIST ?? '127.0.0.1,::1,::ffff:127.0.0.1').split(',').map((s) => s.trim()).filter(Boolean));

  constructor(private readonly prisma: PrismaService, private readonly gateway: AdminGateway) {}

  // ── events ──
  async event(type: string, severity: Severity, ctx: { ip?: string; userAgent?: string; adminId?: string; userId?: string }, detail?: Record<string, unknown>) {
    try {
      await this.prisma.securityEvent.create({ data: { type, severity, ip: ctx.ip, userAgent: ctx.userAgent?.slice(0, 300), adminId: ctx.adminId, userId: ctx.userId, detail: (detail ?? undefined) as never } });
      if (severity === 'high' || severity === 'critical') this.gateway.emitSecurityAlert?.({ type, severity, ip: ctx.ip, detail });
    } catch (e) { this.logger.warn(`security event write failed: ${(e as Error).message}`); }
    if (severity !== 'info') this.logger.warn(`[${severity}] ${type} ip=${ctx.ip ?? '-'} ${detail ? JSON.stringify(detail).slice(0, 200) : ''}`);
  }

  // ── attack signatures ──
  scan(text: string): string | null {
    if (!text) return null;
    let t = text; try { t = decodeURIComponent(text); } catch { /* keep raw */ }
    for (const p of ATTACK_PATTERNS) if (p.re.test(text) || p.re.test(t)) return p.name;
    return null;
  }

  // ── IP firewall ──
  /**
   * Manual blocks apply to EVERY request. Automatic blocks (triggered by attacks on the admin surface) apply only to the admin surface, because many players can share
   * one mobile-carrier (CGNAT) address and must never be locked out of the game by someone else's attack.
   */
  async isBlocked(ip: string | undefined, adminSurface = true): Promise<boolean> {
    if (!ip || this.allow.has(ip)) return false;
    if (Date.now() - this.blockedLoadedAt > 5000) await this.reloadBlocks();
    const b = this.blocked.get(ip);
    if (!b) return false;
    if (b.until < Date.now()) { this.blocked.delete(ip); return false; }
    return b.auto ? adminSurface : true;
  }

  private async reloadBlocks() {
    this.blockedLoadedAt = Date.now();
    try {
      const rows = await this.prisma.ipBlock.findMany();
      const m = new Map<string, { until: number; auto: boolean }>(); const now = Date.now();
      for (const r of rows) { const u = r.until ? r.until.getTime() : Infinity; if (u > now) m.set(r.ip, { until: u, auto: r.auto }); }
      this.blocked = m;
    } catch { /* keep the previous list */ }
  }

  async block(ip: string, reason: string, hours: number | null, createdBy?: string, auto = false) {
    if (this.allow.has(ip)) return null;
    const until = hours ? new Date(Date.now() + hours * 3_600_000) : null;
    const row = await this.prisma.ipBlock.upsert({ where: { ip }, create: { ip, reason, until, auto, createdBy }, update: { reason, until, auto, createdBy } });
    this.blockedLoadedAt = 0; this.blocked.set(ip, { until: until ? until.getTime() : Infinity, auto });
    await this.event(auto ? 'IP_AUTOBLOCK' : 'IP_BLOCK', 'high', { ip, adminId: auto ? undefined : createdBy }, { reason, until });
    return row;
  }

  async unblock(id: string) {
    const r = await this.prisma.ipBlock.delete({ where: { id } }).catch(() => null);
    if (r) { this.blocked.delete(r.ip); this.blockedLoadedAt = 0; }
    return { ok: !!r };
  }

  /** One suspicious thing from this IP (failed login, forbidden call, attack signature ...). Too many in 10 minutes -> automatic temporary block. */
  async offense(ip: string | undefined, kind: string, ctx: { userAgent?: string } = {}) {
    if (!ip || this.allow.has(ip)) return;
    const now = Date.now(); const list = (this.offenses.get(ip) ?? []).filter((t) => now - t < OFFENSE_WINDOW_MS); list.push(now); this.offenses.set(ip, list);
    if (list.length >= OFFENSE_LIMIT) { this.offenses.delete(ip); await this.block(ip, `Automatic: ${list.length} suspicious requests in 10 minutes (last: ${kind})`, AUTOBLOCK_MS / 3_600_000, undefined, true); }
  }

  // ── queries for the panel ──
  events(opts: { type?: string; severity?: string; ip?: string; take?: number; before?: string }) {
    return this.prisma.securityEvent.findMany({ where: { type: opts.type || undefined, severity: opts.severity || undefined, ip: opts.ip || undefined, createdAt: opts.before ? { lt: new Date(opts.before) } : undefined }, orderBy: { createdAt: 'desc' }, take: Math.min(opts.take ?? 100, 500) });
  }
  blocks() { return this.prisma.ipBlock.findMany({ orderBy: { createdAt: 'desc' }, take: 500 }); }
  async stats() {
    const since = new Date(Date.now() - 24 * 3_600_000);
    const [byType, blocks, sessions] = await Promise.all([
      this.prisma.securityEvent.groupBy({ by: ['type'], where: { createdAt: { gte: since } }, _count: { _all: true } }),
      this.prisma.ipBlock.count(),
      this.prisma.adminSession.count({ where: { revokedAt: null, expiresAt: { gt: new Date() } } }),
    ]);
    return { last24h: Object.fromEntries(byType.map((r) => [r.type, r._count._all])), blockedIps: blocks, activeAdminSessions: sessions };
  }
}
