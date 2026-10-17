import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { SessionService } from '../session/session.service';
import { GrantService } from '../grants/grant.service';
import { findActiveBan } from '../../common/ban.util';

export interface PlayerQuery { q?: string; sort?: string; dir?: 'asc' | 'desc'; page?: number; limit?: number; platform?: string; banned?: boolean; online?: boolean; payer?: boolean; minHours?: number; guest?: boolean }

const SORTS: Record<string, string> = { lastSeen: 'lastSeenAt', playtime: 'playSeconds', mmr: 'mmr', matches: 'totalMatches', created: 'createdAt', level: 'level', wins: 'wins' };

@Injectable()
export class InsightsService {
  constructor(private readonly prisma: PrismaService, private readonly sessions: SessionService, private readonly grants: GrantService) {}

  /** Play time including the part of the current session that is not yet written to the profile. */
  private livePlaySeconds(userId: string, stored: number) { const o = this.sessions.online().find((p) => p.userId === userId); return stored + (o ? Math.min(60, o.lastBeatAgoSeconds) * 0 : 0); }

  async players(q: PlayerQuery) {
    const limit = Math.min(Math.max(q.limit ?? 25, 1), 100), page = Math.max(q.page ?? 1, 1);
    const onlineIds = new Set(this.sessions.online().map((p) => p.userId));
    const where: Prisma.PlayerProfileWhereInput = {
      ...(q.q ? { OR: [{ username: { contains: q.q, mode: 'insensitive' } }, { displayName: { contains: q.q, mode: 'insensitive' } }, { userId: q.q }, { user: { email: { contains: q.q, mode: 'insensitive' } } }] } : {}),
      ...(q.platform ? { lastPlatform: q.platform } : {}),
      ...(q.minHours ? { playSeconds: { gte: Math.round(q.minHours * 3600) } } : {}),
      ...(q.online ? { userId: { in: [...onlineIds] } } : {}),
      user: { ...(q.guest !== undefined ? { isGuest: q.guest } : {}), ...(q.banned ? { bans: { some: { isActive: true } } } : {}), ...(q.payer ? { purchases: { some: { status: 'verified' } } } : {}) },
    };
    const sortField = SORTS[q.sort ?? 'lastSeen'] ?? 'lastSeenAt';
    const [total, rows] = await Promise.all([
      this.prisma.playerProfile.count({ where }),
      this.prisma.playerProfile.findMany({ where, orderBy: { [sortField]: q.dir === 'asc' ? 'asc' : 'desc' } as never, skip: (page - 1) * limit, take: limit, include: { user: { select: { email: true, isGuest: true, isActive: true, country: true, language: true, registeredAt: true, bans: { where: { isActive: true }, select: { type: true, endsAt: true }, take: 1 }, purchases: { where: { status: 'verified' }, select: { amountUsd: true } } } } } }),
    ]);
    return {
      total, page, limit,
      players: rows.map((p) => ({
        userId: p.userId, username: p.username, displayName: p.displayName, email: p.user.email, isGuest: p.user.isGuest, country: p.user.country, language: p.user.language,
        level: p.level, mmr: p.mmr, rank: p.currentRank, totalMatches: p.totalMatches, wins: p.wins, losses: p.losses,
        playSeconds: p.playSeconds, hours: Math.round((p.playSeconds / 3600) * 10) / 10, sessions: p.sessionCount, lastSeenAt: p.lastSeenAt, platform: p.lastPlatform, appVersion: p.lastAppVersion,
        registeredAt: p.user.registeredAt, online: onlineIds.has(p.userId), banned: p.user.bans[0] ?? null, spentUsd: Math.round(p.user.purchases.reduce((s, x) => s + x.amountUsd, 0) * 100) / 100,
      })),
    };
  }

  async player(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { profile: { include: { clan: { select: { id: true, name: true } } } }, devices: { orderBy: { lastSeenAt: 'desc' }, take: 10 } } });
    if (!user) throw new NotFoundException('Player not found');
    const since90 = new Date(Date.now() - 90 * 86_400_000), since7 = new Date(Date.now() - 7 * 86_400_000);
    const [sessions, sessAgg, matchRows, purchases, activeBan, flagCounts, assets, ledger, friends] = await Promise.all([
      this.prisma.gameSession.findMany({ where: { userId }, orderBy: { startedAt: 'desc' }, take: 40 }),
      this.prisma.gameSession.aggregate({ where: { userId }, _sum: { seconds: true, menuSeconds: true, matchSeconds: true }, _count: { _all: true } }),
      this.prisma.matchPlayer.findMany({ where: { userId }, orderBy: { match: { createdAt: 'desc' } }, take: 200, include: { match: { select: { id: true, mode: true, mapId: true, status: true, durationTicks: true, tickRate: true, createdAt: true } } } }),
      this.prisma.playerPurchase.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50, include: { storeProduct: { select: { nameKey: true } } } }),
      findActiveBan(this.prisma, userId),
      Promise.all([this.prisma.antiCheatFlag.count({ where: { userId } }), this.prisma.fraudFlag.count({ where: { userId } }), this.prisma.moderationReport.count({ where: { targetUserId: userId } })]),
      this.grants.assets(userId),
      this.grants.ledger(userId, 30),
      this.prisma.friendship.count({ where: { OR: [{ requesterId: userId }, { receiverId: userId }] } } as never).catch(() => 0),
    ]);
    const p = user.profile;
    const byMode: Record<string, { played: number; won: number }> = {}, byCiv: Record<string, { played: number; won: number }> = {};
    let ticks = 0, ticksN = 0;
    for (const m of matchRows) {
      const bm = (byMode[m.match.mode] ??= { played: 0, won: 0 }); bm.played++; if (m.isWinner) bm.won++;
      if (m.civId) { const bc = (byCiv[m.civId] ??= { played: 0, won: 0 }); bc.played++; if (m.isWinner) bc.won++; }
      if (m.match.durationTicks) { ticks += m.match.durationTicks / (m.match.tickRate || 15); ticksN++; }
    }
    // same device or address as other accounts (alt / multi-account / ban evasion hint)
    const devs = [...new Set(sessions.map((s) => s.deviceId).filter(Boolean))] as string[], ips = [...new Set(sessions.map((s) => s.ip).filter(Boolean))] as string[];
    const shared = devs.length || ips.length ? await this.prisma.gameSession.findMany({ where: { userId: { not: userId }, startedAt: { gte: since90 }, OR: [...(devs.length ? [{ deviceId: { in: devs } }] : []), ...(ips.length ? [{ ip: { in: ips } }] : [])] }, select: { userId: true, deviceId: true, ip: true }, take: 500 }) : [];
    const sharedMap = new Map<string, { sharedDevice: boolean; sharedIp: boolean }>();
    for (const s of shared) { const e = sharedMap.get(s.userId) ?? { sharedDevice: false, sharedIp: false }; if (s.deviceId && devs.includes(s.deviceId)) e.sharedDevice = true; if (s.ip && ips.includes(s.ip)) e.sharedIp = true; sharedMap.set(s.userId, e); }
    const others = sharedMap.size ? await this.prisma.playerProfile.findMany({ where: { userId: { in: [...sharedMap.keys()] } }, select: { userId: true, username: true } }) : [];
    const online = this.sessions.online().find((o) => o.userId === userId);
    const total = sessAgg._sum.seconds ?? 0;
    return {
      userId, email: user.email, isGuest: user.isGuest, isActive: user.isActive, country: user.country, language: user.language, registeredAt: user.registeredAt, lastLoginAt: user.lastLoginAt,
      profile: p && { username: p.username, displayName: p.displayName, level: p.level, xp: p.xp, mmr: p.mmr, peakMmr: p.peakMmr, rank: p.currentRank, clan: p.clan, favoriteCivId: p.favoriteCivId, riskScore: p.riskScore, isPremium: p.isPremium },
      online: online ?? null,
      playtime: { totalSeconds: Math.max(p?.playSeconds ?? 0, total), hours: Math.round((Math.max(p?.playSeconds ?? 0, total) / 3600) * 10) / 10, menuSeconds: sessAgg._sum.menuSeconds ?? 0, matchSeconds: sessAgg._sum.matchSeconds ?? 0, sessions: sessAgg._count._all, avgSessionMinutes: sessAgg._count._all ? Math.round(total / sessAgg._count._all / 60) : 0, sessionsLast7Days: sessions.filter((s) => s.startedAt >= since7).length, lastSeenAt: p?.lastSeenAt ?? null, platform: p?.lastPlatform ?? null, appVersion: p?.lastAppVersion ?? null },
      sessions: sessions.map((s) => ({ id: s.id, startedAt: s.startedAt, endedAt: s.endedAt, seconds: s.seconds, menuSeconds: s.menuSeconds, matchSeconds: s.matchSeconds, platform: s.platform, appVersion: s.appVersion, ip: s.ip, deviceId: s.deviceId })),
      matches: { total: p?.totalMatches ?? 0, wins: p?.wins ?? 0, losses: p?.losses ?? 0, winRate: p && p.totalMatches ? Math.round((p.wins / p.totalMatches) * 100) : 0, avgDurationMinutes: ticksN ? Math.round(ticks / ticksN / 60) : 0, byMode, byCiv, recent: matchRows.slice(0, 20).map((m) => ({ matchId: m.matchId, mode: m.match.mode, mapId: m.match.mapId, civId: m.civId, won: m.isWinner, mmrDelta: m.mmrDelta, surrendered: m.surrendered, disconnected: m.disconnected, at: m.match.createdAt })) },
      economy: { ...assets, ledger, purchases: purchases.map((x) => ({ id: x.id, product: x.storeProduct.nameKey, amountUsd: x.amountUsd, status: x.status, platform: x.platform, at: x.createdAt })), spentUsd: Math.round(purchases.filter((x) => x.status === 'verified').reduce((s, x) => s + x.amountUsd, 0) * 100) / 100 },
      devices: user.devices.map((d) => ({ deviceId: d.deviceId, platform: d.platform, model: d.model, osVersion: d.osVersion, appVersion: d.appVersion, lastSeenAt: d.lastSeenAt })),
      network: { distinctDevices: devs, distinctIps: ips, otherAccountsOnSameDeviceOrIp: others.map((o) => ({ userId: o.userId, username: o.username, ...(sharedMap.get(o.userId) as object) })) },
      moderation: { activeBan, antiCheatFlags: flagCounts[0], fraudFlags: flagCounts[1], reportsAgainst: flagCounts[2] },
      social: { friends },
    };
  }

  async summary() {
    const now = Date.now(), d1 = new Date(now - 86_400_000), d7 = new Date(now - 7 * 86_400_000), d30 = new Date(now - 30 * 86_400_000);
    const distinct = async (since: Date) => (await this.prisma.gameSession.groupBy({ by: ['userId'], where: { startedAt: { gte: since } } })).length;
    const [total, new1, new7, guests, dau, wau, mau, playAgg, matches24, matchesLive, revenue30, banned, platforms, versions, civPicks] = await Promise.all([
      this.prisma.playerProfile.count(), this.prisma.user.count({ where: { registeredAt: { gte: d1 } } }), this.prisma.user.count({ where: { registeredAt: { gte: d7 } } }), this.prisma.user.count({ where: { isGuest: true } }),
      distinct(d1), distinct(d7), distinct(d30),
      this.prisma.playerProfile.aggregate({ _sum: { playSeconds: true }, _avg: { playSeconds: true } }),
      this.prisma.match.count({ where: { createdAt: { gte: d1 } } }), this.prisma.match.count({ where: { status: 'in_progress' } }),
      this.prisma.playerPurchase.aggregate({ where: { status: 'verified', createdAt: { gte: d30 } }, _sum: { amountUsd: true }, _count: { _all: true } }),
      this.prisma.ban.count({ where: { isActive: true } }),
      this.prisma.playerProfile.groupBy({ by: ['lastPlatform'], _count: { _all: true } }), this.prisma.playerProfile.groupBy({ by: ['lastAppVersion'], _count: { _all: true } }),
      this.prisma.matchPlayer.groupBy({ by: ['civId'], where: { civId: { not: null }, match: { createdAt: { gte: d30 } } }, _count: { _all: true }, orderBy: { _count: { civId: 'desc' } }, take: 12 }),
    ]);
    const online = this.sessions.online();
    return {
      players: { total, guests, registered: total - guests, newLast24h: new1, newLast7d: new7 },
      activity: { onlineNow: online.length, inMatchNow: online.filter((p) => p.state === 'match').length, dau, wau, mau, stickiness: mau ? Math.round((dau / mau) * 100) : 0 },
      playtime: { totalHours: Math.round(((playAgg._sum.playSeconds ?? 0) / 3600) * 10) / 10, avgHoursPerPlayer: Math.round((((playAgg._avg.playSeconds ?? 0) / 3600)) * 10) / 10 },
      matches: { last24h: matches24, runningNow: matchesLive },
      revenue: { last30dUsd: Math.round((revenue30._sum.amountUsd ?? 0) * 100) / 100, purchases30d: revenue30._count._all },
      moderation: { activeBans: banned },
      platforms: platforms.map((x) => ({ platform: x.lastPlatform ?? 'unknown', players: x._count._all })),
      versions: versions.map((x) => ({ version: x.lastAppVersion ?? 'unknown', players: x._count._all })).sort((a, b) => b.players - a.players),
      civPicks30d: civPicks.map((x) => ({ civ: x.civId, picks: x._count._all })),
    };
  }
}
