import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AdminGateway } from '../../gateway/admin.gateway';
import { ModerationService } from '../moderation/moderation.service';
import { SessionService } from '../session/session.service';

export const CHEAT_TYPES = [
  'modified_game_data',   // the client reports a data hash that differs from the server's active release (game files edited)
  'result_mismatch',      // players of one match reported different outcomes
  'false_result_claim',   // one player's outcome disagrees with every other player (the outlier)
  'win_rate_anomaly',     // statistically impossible win rate over many games
  'mmr_spike',            // rating gained far too fast
  'win_trading',          // the same two accounts keep feeding each other wins
  'shared_device_match',  // opponents in one match share a device / address (boosting, self-play)
  'ban_evasion',          // a new account on the device / address of a banned player
  'client_tamper',        // the game client itself detected memory editing / hooking / modified binary / root-emulator abuse
  'speed_hack',           // game clock manipulation
  'impossible_apm',       // inhuman command rate
  'api_abuse',            // hammering the API / replaying requests
  'manual',               // raised by a moderator
] as const;
export type CheatType = (typeof CHEAT_TYPES)[number];
export type Severity = 'low' | 'medium' | 'high' | 'critical';

export interface AutoAction { type: 'kick' | 'ranked_ban' | 'temp_ban' | 'perm_ban'; hours?: number; afterStrikes?: number; windowDays?: number }
export interface CheatPolicy { autoEnforce: boolean; rules: Record<string, { severity: Severity; auto?: AutoAction }> }

/** Defaults: certain evidence (edited game data, ban evasion) is punished automatically and escalates; statistical signals only raise flags for a human to review. */
export const DEFAULT_POLICY = (): CheatPolicy => ({
  autoEnforce: true,
  rules: {
    modified_game_data: { severity: 'critical', auto: { type: 'temp_ban', hours: 24 * 3, afterStrikes: 1 } },
    ban_evasion: { severity: 'critical', auto: { type: 'perm_ban', afterStrikes: 1 } },
    client_tamper: { severity: 'high', auto: { type: 'temp_ban', hours: 72, afterStrikes: 2, windowDays: 14 } },
    speed_hack: { severity: 'high', auto: { type: 'temp_ban', hours: 72, afterStrikes: 2, windowDays: 14 } },
    impossible_apm: { severity: 'medium' },
    false_result_claim: { severity: 'high', auto: { type: 'ranked_ban', afterStrikes: 3, windowDays: 30 } },
    result_mismatch: { severity: 'medium' },
    win_trading: { severity: 'high' },
    shared_device_match: { severity: 'medium' },
    win_rate_anomaly: { severity: 'medium' },
    mmr_spike: { severity: 'medium' },
    api_abuse: { severity: 'low' },
    manual: { severity: 'medium' },
  },
});

const POLICY_KEY = 'cheat.policy';
const DEDUPE_MS = 10 * 60_000;

export interface RaiseCtx { matchId?: string; ip?: string; deviceId?: string; platform?: string; appVersion?: string; source?: string }

@Injectable()
export class CheatWatchService {
  private readonly logger = new Logger(CheatWatchService.name);
  private policyCache?: { at: number; value: CheatPolicy };

  constructor(private readonly prisma: PrismaService, private readonly gateway: AdminGateway, private readonly moderation: ModerationService, private readonly sessions: SessionService) {
    this.sessions.onSessionStart((userId, deviceId, ip, ctx) => this.onSessionStart(userId, deviceId, ip, ctx));
  }

  // ── policy (editable in the panel) ──
  async getPolicy(): Promise<CheatPolicy> {
    if (this.policyCache && Date.now() - this.policyCache.at < 10_000) return this.policyCache.value;
    const row = await this.prisma.systemSetting.findUnique({ where: { key: POLICY_KEY } });
    const d = DEFAULT_POLICY(); const v = (row?.value ?? {}) as Partial<CheatPolicy>;
    const value: CheatPolicy = { autoEnforce: v.autoEnforce ?? d.autoEnforce, rules: { ...d.rules, ...(v.rules ?? {}) } };
    this.policyCache = { at: Date.now(), value }; return value;
  }
  async savePolicy(p: Partial<CheatPolicy>, adminId: string) {
    const cur = await this.getPolicy(); const next: CheatPolicy = { autoEnforce: p.autoEnforce ?? cur.autoEnforce, rules: { ...cur.rules, ...(p.rules ?? {}) } };
    for (const [k, r] of Object.entries(next.rules)) {
      if (!['low', 'medium', 'high', 'critical'].includes(r.severity)) throw new ForbiddenException(`rule ${k}: bad severity`);
      if (r.auto && !['kick', 'ranked_ban', 'temp_ban', 'perm_ban'].includes(r.auto.type)) throw new ForbiddenException(`rule ${k}: bad action`);
    }
    await this.prisma.systemSetting.upsert({ where: { key: POLICY_KEY }, create: { key: POLICY_KEY, value: next as never, updatedBy: adminId }, update: { value: next as never, updatedBy: adminId } });
    this.policyCache = undefined; return next;
  }

  // ── core: record a finding, tell the panel, maybe punish ──
  async raise(userId: string, type: CheatType | string, evidence: Record<string, unknown>, ctx: RaiseCtx = {}) {
    const policy = await this.getPolicy();
    const rule = policy.rules[type] ?? { severity: 'medium' as Severity };
    const dup = await this.prisma.antiCheatFlag.findFirst({ where: { userId, flagType: type, matchId: ctx.matchId ?? null, createdAt: { gte: new Date(Date.now() - DEDUPE_MS) } } });
    if (dup) return { flag: dup, duplicate: true, action: null };
    const profile = await this.prisma.playerProfile.findUnique({ where: { userId }, select: { username: true } });
    const flag = await this.prisma.antiCheatFlag.create({ data: { userId, matchId: ctx.matchId ?? null, flagType: type, severity: rule.severity, reviewed: false, data: { ...evidence, ctx: { ip: ctx.ip, deviceId: ctx.deviceId, platform: ctx.platform, appVersion: ctx.appVersion, source: ctx.source ?? 'server' }, detectedAt: new Date().toISOString() } as never } });
    this.gateway.emitCheatAlert({ flagId: flag.id, userId, username: profile?.username, type, severity: rule.severity, matchId: ctx.matchId, ip: ctx.ip, summary: JSON.stringify(evidence).slice(0, 240) });
    this.logger.warn(`CHEAT ${type} (${rule.severity}) user=${userId} match=${ctx.matchId ?? '-'}`);

    let action: string | null = null;
    if (policy.autoEnforce && rule.auto) {
      const win = new Date(Date.now() - (rule.auto.windowDays ?? 365) * 86_400_000);
      const strikes = await this.prisma.antiCheatFlag.count({ where: { userId, flagType: type, createdAt: { gte: win }, OR: [{ reviewNote: null }, { NOT: { reviewNote: { startsWith: 'dismissed' } } }] } });
      if (strikes >= (rule.auto.afterStrikes ?? 1)) action = await this.enforce(userId, flag.id, type, rule.auto, strikes, ctx);
    }
    return { flag, duplicate: false, action };
  }

  private async enforce(userId: string, flagId: string, type: string, a: AutoAction, strikes: number, ctx: RaiseCtx) {
    const evidence = `auto-enforcement: ${type} (strike ${strikes}) flag ${flagId} match ${ctx.matchId ?? '-'} ip ${ctx.ip ?? '-'} device ${ctx.deviceId ?? '-'}`;
    const by = 'cheat-engine';
    try {
      if (a.type === 'kick') await this.moderation.kick(by, userId, `Cheat detection: ${type}`);
      else if (a.type === 'ranked_ban') await this.moderation.ban(by, userId, 'ranked_only', `Cheat detection: ${type}`, undefined, evidence, ctx.matchId);
      else if (a.type === 'temp_ban') await this.moderation.ban(by, userId, 'temporary', `Cheat detection: ${type}`, a.hours ?? 72, evidence, ctx.matchId);
      else await this.moderation.ban(by, userId, 'permanent', `Cheat detection: ${type}`, undefined, evidence, ctx.matchId);
      if ((a.type === 'perm_ban' || a.type === 'temp_ban') && (ctx.deviceId || ctx.ip) && type === 'ban_evasion') await this.blockDevice(ctx.deviceId, undefined, `evasion by ${userId}`, a.type === 'perm_ban' ? null : a.hours ?? 72, true);
      await this.prisma.antiCheatFlag.update({ where: { id: flagId }, data: { reviewNote: `auto:${a.type}` } });
      return a.type;
    } catch (e) { this.logger.warn(`auto action failed: ${(e as Error).message}`); return null; }
  }

  // ── detectors ──
  /** Client tells the server which game data it runs. Anything but the active release (or the shipped baseline) = tampered data. */
  async checkContentHash(userId: string, matchId: string | undefined, reported: string | undefined, ctx: RaiseCtx = {}) {
    if (reported === undefined) return;
    const active = await this.prisma.contentRelease.findFirst({ where: { channel: 'live', isActive: true }, select: { manifestHash: true, version: true } });
    if (!active) return;
    const baseline = await this.baselineHash();
    if (reported !== active.manifestHash && !(reported === '' && baseline === active.manifestHash)) {
      await this.raise(userId, 'modified_game_data', { reported: reported || '(shipped data)', expected: active.manifestHash, release: active.version }, { ...ctx, matchId });
    }
  }
  private async baselineHash(): Promise<string> {
    const crypto = await import('crypto'); const rows = await this.prisma.contentFile.findMany({ orderBy: { path: 'asc' }, select: { path: true, baseContent: true } });
    return crypto.createHash('sha256').update(rows.map((r) => `${r.path}:${crypto.createHash('sha256').update(r.baseContent, 'utf8').digest('hex')}`).join('\n'), 'utf8').digest('hex');
  }

  /** Players of one match disagree about the result. The outlier against a clear majority is the likely liar. */
  async onResultsDisputed(matchId: string, reports: { userId: string; winners: string[] }[]) {
    const key = (w: string[]) => [...w].sort().join(',');
    const groups = new Map<string, string[]>(); for (const r of reports) groups.set(key(r.winners), [...(groups.get(key(r.winners)) ?? []), r.userId]);
    const sorted = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
    for (const r of reports) await this.raise(r.userId, 'result_mismatch', { reports: reports.map((x) => ({ userId: x.userId, winners: x.winners })) }, { matchId });
    if (reports.length >= 3 && sorted.length === 2 && sorted[0][1].length > sorted[1][1].length && sorted[1][1].length === 1) {
      await this.raise(sorted[1][1][0], 'false_result_claim', { claimed: sorted[1][0], majority: sorted[0][0], agreeing: sorted[0][1].length }, { matchId });
    }
  }

  /** After a match is recorded: statistical and relationship checks for each participant. */
  async onMatchRecorded(matchId: string, userIds: string[]) {
    const since1h = new Date(Date.now() - 3_600_000), since24h = new Date(Date.now() - 86_400_000);
    for (const uid of userIds) {
      try {
        const last = await this.prisma.matchPlayer.findMany({ where: { userId: uid, isWinner: { not: null } }, orderBy: { match: { createdAt: 'desc' } }, take: 30, select: { isWinner: true, mmrDelta: true, match: { select: { createdAt: true } } } });
        if (last.length >= 20) { const wr = last.filter((m) => m.isWinner).length / last.length; if (wr >= 0.93) await this.raise(uid, 'win_rate_anomaly', { games: last.length, winRate: Math.round(wr * 100) }, { matchId }); }
        const gain = last.filter((m) => m.match.createdAt >= since1h).reduce((s, m) => s + (m.mmrDelta ?? 0), 0);
        if (gain >= 150) await this.raise(uid, 'mmr_spike', { gainLastHour: gain }, { matchId });
      } catch (e) { this.logger.warn(`stat check failed: ${(e as Error).message}`); }
    }
    if (userIds.length === 2) {
      const [a, b] = userIds;
      const sa = await this.prisma.gameSession.findMany({ where: { userId: a, startedAt: { gte: since24h } }, select: { deviceId: true, ip: true }, take: 20 });
      const sb = await this.prisma.gameSession.findMany({ where: { userId: b, startedAt: { gte: since24h } }, select: { deviceId: true, ip: true }, take: 20 });
      const devs = new Set(sa.map((s) => s.deviceId).filter(Boolean)), ips = new Set(sa.map((s) => s.ip).filter(Boolean));
      const sharedDev = sb.some((s) => s.deviceId && devs.has(s.deviceId)), sharedIp = sb.some((s) => s.ip && ips.has(s.ip));
      if (sharedDev || sharedIp) for (const u of [a, b]) await this.raise(u, 'shared_device_match', { opponent: u === a ? b : a, sharedDevice: sharedDev, sharedIp }, { matchId });
      const together = await this.prisma.match.findMany({ where: { createdAt: { gte: since24h }, AND: [{ players: { some: { userId: a } } }, { players: { some: { userId: b } } }] }, select: { players: { select: { userId: true, isWinner: true } } }, take: 40 });
      if (together.length >= 6) { const aw = together.filter((m) => m.players.find((p) => p.userId === a)?.isWinner).length; if (aw >= together.length - 1 || aw <= 1) { const w = aw >= together.length - 1 ? a : b; await this.raise(w, 'win_trading', { opponent: w === a ? b : a, gamesTogether24h: together.length, wins: Math.max(aw, together.length - aw) }, { matchId }); } }
    }
  }

  /** A player signs in from a device / address: refuse banned hardware; flag evasion of someone else's ban. */
  async onSessionStart(userId: string, deviceId: string | undefined, ip: string | undefined, ctx: RaiseCtx = {}) {
    if (!deviceId && !ip) return;
    const now = new Date();
    const hit = await this.prisma.deviceBan.findFirst({ where: { OR: [...(deviceId ? [{ deviceId }] : []), ...(ip ? [{ ip }] : [])], AND: [{ OR: [{ until: null }, { until: { gt: now } }] }] } });
    if (hit) { await this.raise(userId, 'ban_evasion', { reason: 'device/address is banned', ban: hit.id, banReason: hit.reason }, { ...ctx, deviceId, ip }); throw new ForbiddenException({ code: 'BANNED_DEVICE', message: hit.reason }); }
    if (deviceId) {
      const others = await this.prisma.gameSession.findMany({ where: { deviceId, userId: { not: userId } }, select: { userId: true }, distinct: ['userId'], take: 20 });
      if (others.length) {
        const banned = await this.prisma.ban.findFirst({ where: { userId: { in: others.map((o) => o.userId) }, isActive: true, type: { in: ['permanent', 'temporary'] } } });
        if (banned) await this.raise(userId, 'ban_evasion', { reason: 'device used by a banned account', bannedUserId: banned.userId, banId: banned.id }, { ...ctx, deviceId, ip });
      }
    }
  }

  /** Reports from the game client's own protections (memory scanner, hook detector, clock check ...). Untrusted input: it only raises a flag, it never punishes alone. */
  async clientReport(userId: string, type: string, detail: Record<string, unknown>, ctx: RaiseCtx) {
    const mapped: CheatType = type === 'speed_hack' ? 'speed_hack' : type === 'impossible_apm' ? 'impossible_apm' : 'client_tamper';
    return this.raise(userId, mapped, { clientType: type.slice(0, 40), detail: JSON.stringify(detail).slice(0, 800) }, { ...ctx, source: 'client' });
  }

  // ── device / address bans ──
  async blockDevice(deviceId: string | undefined, ip: string | undefined, reason: string, hours: number | null, auto: boolean, adminId?: string) {
    if (!deviceId && !ip) return null;
    return this.prisma.deviceBan.create({ data: { deviceId, ip, reason, until: hours ? new Date(Date.now() + hours * 3_600_000) : null, auto, createdBy: adminId } });
  }
  deviceBans() { return this.prisma.deviceBan.findMany({ orderBy: { createdAt: 'desc' }, take: 300 }); }
  async unblockDevice(id: string) { await this.prisma.deviceBan.delete({ where: { id } }).catch(() => null); return { ok: true }; }

  // ── panel reads / review ──
  async flags(f: { status?: string; severity?: string; type?: string; userId?: string; take?: number; before?: string }) {
    const rows = await this.prisma.antiCheatFlag.findMany({
      where: { reviewed: f.status === 'open' ? false : f.status === 'reviewed' ? true : undefined, severity: f.severity || undefined, flagType: f.type || undefined, userId: f.userId || undefined, createdAt: f.before ? { lt: new Date(f.before) } : undefined },
      orderBy: { createdAt: 'desc' }, take: Math.min(f.take ?? 100, 300),
    });
    const names = new Map((await this.prisma.playerProfile.findMany({ where: { userId: { in: [...new Set(rows.map((r) => r.userId))] } }, select: { userId: true, username: true } })).map((p) => [p.userId, p.username]));
    return rows.map((r) => ({ ...r, username: names.get(r.userId) ?? null, online: this.sessions.isOnline(r.userId) }));
  }

  async flag(id: string) {
    const f = await this.prisma.antiCheatFlag.findUnique({ where: { id } }); if (!f) throw new NotFoundException();
    const [profile, sameUser, sessions, activeBan] = await Promise.all([
      this.prisma.playerProfile.findUnique({ where: { userId: f.userId }, select: { username: true, level: true, mmr: true, totalMatches: true, wins: true, lastSeenAt: true } }),
      this.prisma.antiCheatFlag.findMany({ where: { userId: f.userId }, orderBy: { createdAt: 'desc' }, take: 30 }),
      this.prisma.gameSession.findMany({ where: { userId: f.userId }, orderBy: { startedAt: 'desc' }, take: 10, select: { startedAt: true, ip: true, deviceId: true, platform: true, appVersion: true } }),
      this.prisma.ban.findFirst({ where: { userId: f.userId, isActive: true } }),
    ]);
    return { flag: f, profile, otherFlagsOfPlayer: sameUser, recentSessions: sessions, activeBan, online: this.sessions.isOnline(f.userId) };
  }

  async resolve(adminId: string, id: string, action: 'dismiss' | 'warn' | 'kick' | 'ban_temp' | 'ban_perm' | 'ban_ranked' | 'ban_device', note: string, hours?: number) {
    const f = await this.prisma.antiCheatFlag.findUnique({ where: { id } }); if (!f) throw new NotFoundException();
    const evidence = `flag ${id} ${f.flagType}: ${note}`;
    if (action === 'warn') await this.moderation.message(adminId, f.userId, 'Warning', note || 'Suspicious activity was detected on your account.');
    else if (action === 'kick') await this.moderation.kick(adminId, f.userId, note || f.flagType);
    else if (action === 'ban_temp') await this.moderation.ban(adminId, f.userId, 'temporary', note || f.flagType, hours ?? 72, evidence, f.matchId ?? undefined);
    else if (action === 'ban_perm') await this.moderation.ban(adminId, f.userId, 'permanent', note || f.flagType, undefined, evidence, f.matchId ?? undefined);
    else if (action === 'ban_ranked') await this.moderation.ban(adminId, f.userId, 'ranked_only', note || f.flagType, undefined, evidence, f.matchId ?? undefined);
    else if (action === 'ban_device') { const c = ((f.data ?? {}) as { ctx?: { deviceId?: string; ip?: string } }).ctx ?? {}; await this.blockDevice(c.deviceId, c.ip, note || f.flagType, hours ?? null, false, adminId); await this.moderation.ban(adminId, f.userId, 'permanent', note || f.flagType, undefined, evidence, f.matchId ?? undefined); }
    if (action === 'dismiss') {
      const auto = (f.reviewNote ?? '').startsWith('auto:');
      if (auto) await this.moderation.unban(adminId, f.userId, `false positive: ${note}`);       // an automatic punishment turned out wrong: lift it
    }
    return this.prisma.antiCheatFlag.update({ where: { id }, data: { reviewed: true, reviewedBy: adminId, reviewNote: action === 'dismiss' ? `dismissed: ${note}` : `${action}: ${note}` } });
  }

  async stats() {
    const since = new Date(Date.now() - 7 * 86_400_000), d1 = new Date(Date.now() - 86_400_000);
    const [open, byType, byDay, last24h, autoActions] = await Promise.all([
      this.prisma.antiCheatFlag.count({ where: { reviewed: false } }),
      this.prisma.antiCheatFlag.groupBy({ by: ['flagType', 'severity'], where: { createdAt: { gte: since } }, _count: { _all: true } }),
      this.prisma.antiCheatFlag.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
      this.prisma.antiCheatFlag.count({ where: { createdAt: { gte: d1 } } }),
      this.prisma.antiCheatFlag.count({ where: { reviewNote: { startsWith: 'auto:' }, createdAt: { gte: since } } }),
    ]);
    const days: Record<string, number> = {}; for (const r of byDay) { const k = r.createdAt.toISOString().slice(0, 10); days[k] = (days[k] ?? 0) + 1; }
    return { openFlags: open, last24h, autoActions7d: autoActions, byType7d: byType.map((r) => ({ type: r.flagType, severity: r.severity, count: r._count._all })), perDay7d: days };
  }
}
