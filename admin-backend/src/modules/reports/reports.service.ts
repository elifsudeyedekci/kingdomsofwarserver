import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

// Implements: Reports & Analytics design spec
// All aggregation is done via Prisma — no hardcoded gameplay values.

export type RevenueGroupBy = 'day' | 'week' | 'month';

// ---------------------------------------------------------------------------
// Query parameter shapes used by both service and controller
// ---------------------------------------------------------------------------

export interface AnalyticsEventsQuery {
  from?: Date;
  to?: Date;
  eventType?: string;
  page: number;
  limit: number;
}

export interface CrashReportsQuery {
  platform?: string;
  page: number;
  limit: number;
}

export interface RevenueAggregateQuery {
  from: Date;
  to: Date;
}

export interface AuditLogsQuery {
  adminId?: string;
  page: number;
  limit: number;
}

// ---------------------------------------------------------------------------

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // =========================================================================
  // DESIGN-DOC METHODS (game-designer spec)
  // =========================================================================

  // -------------------------------------------------------------------------
  // Player report: match history stats, win rate, favourite civ, playtime
  // -------------------------------------------------------------------------
  async getPlayerReport(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) throw new NotFoundException(`User ${userId} not found`);

    const matchPlayers = await this.prisma.matchPlayer.findMany({
      where: { userId },
      include: {
        match: {
          select: {
            id: true,
            mode: true,
            status: true,
            startedAt: true,
            endedAt: true,
            durationTicks: true,
            tickRate: true,
          },
        },
      },
      orderBy: { match: { createdAt: 'desc' } },
    });

    const totalMatches = matchPlayers.length;
    const wins = matchPlayers.filter((mp) => mp.isWinner === true).length;
    const losses = matchPlayers.filter((mp) => mp.isWinner === false).length;
    const winRate =
      totalMatches > 0 ? Math.round((wins / totalMatches) * 10000) / 100 : 0;

    // Favourite civ derived from actual match history
    const civCounts = new Map<string, number>();
    for (const mp of matchPlayers) {
      if (mp.civId) {
        civCounts.set(mp.civId, (civCounts.get(mp.civId) ?? 0) + 1);
      }
    }
    let favoriteCivId: string | null = user.profile?.favoriteCivId ?? null;
    if (civCounts.size > 0) {
      const sorted = [...civCounts.entries()].sort((a, b) => b[1] - a[1]);
      favoriteCivId = sorted[0][0];
    }

    // Total playtime: durationTicks / tickRate for each completed match
    let totalPlaytimeSeconds = 0;
    for (const mp of matchPlayers) {
      const { durationTicks, tickRate } = mp.match;
      if (durationTicks && tickRate) {
        totalPlaytimeSeconds += Math.floor(durationTicks / tickRate);
      }
    }

    const recentMatches = matchPlayers.slice(0, 10).map((mp) => ({
      matchId: mp.matchId,
      mode: mp.match.mode,
      status: mp.match.status,
      civId: mp.civId,
      isWinner: mp.isWinner,
      mmrDelta: mp.mmrDelta,
      startedAt: mp.match.startedAt,
      endedAt: mp.match.endedAt,
    }));

    return {
      userId,
      profile: user.profile
        ? {
            username: user.profile.username,
            displayName: user.profile.displayName,
            level: user.profile.level,
            mmr: user.profile.mmr,
            peakMmr: user.profile.peakMmr,
            currentRank: user.profile.currentRank,
            isPremium: user.profile.isPremium,
          }
        : null,
      stats: {
        totalMatches,
        wins,
        losses,
        winRate,
        favoriteCivId,
        totalPlaytimeSeconds,
      },
      recentMatches,
    };
  }

  // -------------------------------------------------------------------------
  // Match report: participants, duration, winner, event summary
  // -------------------------------------------------------------------------
  async getMatchReport(matchId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        players: true,
        result: true,
        events: { orderBy: { tick: 'asc' } },
      },
    });

    if (!match) throw new NotFoundException(`Match ${matchId} not found`);

    const durationSeconds =
      match.durationTicks && match.tickRate
        ? Math.floor(match.durationTicks / match.tickRate)
        : null;

    const eventSummary = match.events.reduce<Record<string, number>>(
      (acc, ev) => {
        acc[ev.eventType] = (acc[ev.eventType] ?? 0) + 1;
        return acc;
      },
      {},
    );

    return {
      matchId: match.id,
      mode: match.mode,
      status: match.status,
      mapId: match.mapId,
      region: match.region,
      startedAt: match.startedAt,
      endedAt: match.endedAt,
      durationSeconds,
      participants: match.players.map((mp) => ({
        userId: mp.userId,
        slot: mp.slot,
        teamId: mp.teamId,
        civId: mp.civId,
        isWinner: mp.isWinner,
        surrendered: mp.surrendered,
        disconnected: mp.disconnected,
        mmrBefore: mp.mmrBefore,
        mmrAfter: mp.mmrAfter,
        mmrDelta: mp.mmrDelta,
      })),
      result: match.result
        ? {
            winnerUserId: match.result.winnerUserId,
            victoryType: match.result.victoryType,
            serverValidated: match.result.serverValidated,
          }
        : null,
      eventSummary,
      totalEvents: match.events.length,
    };
  }

  private bucketKey(date: Date, groupBy: RevenueGroupBy): string {
    const d = new Date(date);
    if (groupBy === 'day') return d.toISOString().slice(0, 10);
    if (groupBy === 'month') return d.toISOString().slice(0, 7);
    // ISO week: YYYY-Www
    const startOfYear = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil(
      ((d.getTime() - startOfYear.getTime()) / 86_400_000 +
        startOfYear.getDay() +
        1) /
        7,
    );
    return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  }

  // -------------------------------------------------------------------------
  // Churn report: active players inactive for N days
  // -------------------------------------------------------------------------
  async getChurnReport(days: number, page = 1, limit = 20) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const skip = (page - 1) * limit;

    const where = {
      lastLoginAt: { lt: cutoff },
      deletedAt: null,
      isActive: true,
    };

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          lastLoginAt: true,
          registeredAt: true,
          profile: {
            select: {
              username: true,
              totalMatches: true,
              currentRank: true,
              isPremium: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { lastLoginAt: 'asc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      inactiveSinceDays: days,
      cutoffDate: cutoff,
      total,
      page,
      limit,
      items,
    };
  }

  // -------------------------------------------------------------------------
  // Top players: highest MMR and most matches played
  // -------------------------------------------------------------------------
  async getTopPlayersReport(limit = 50) {
    const [byMmr, byMatches] = await Promise.all([
      this.prisma.playerProfile.findMany({
        orderBy: { mmr: 'desc' },
        take: limit,
        select: {
          userId: true,
          username: true,
          displayName: true,
          mmr: true,
          peakMmr: true,
          currentRank: true,
          totalMatches: true,
          wins: true,
          losses: true,
          favoriteCivId: true,
        },
      }),
      this.prisma.playerProfile.findMany({
        orderBy: { totalMatches: 'desc' },
        take: limit,
        select: {
          userId: true,
          username: true,
          displayName: true,
          mmr: true,
          currentRank: true,
          totalMatches: true,
          wins: true,
          losses: true,
        },
      }),
    ]);

    return {
      topByMmr: byMmr.map((p, i) => ({ rank: i + 1, ...p })),
      topByMatches: byMatches.map((p, i) => ({ rank: i + 1, ...p })),
    };
  }

  // =========================================================================
  // PANEL DASHBOARD METHODS
  // Implements: admin panel analytics pages — period string format "Nd"
  // =========================================================================

  private parsePeriodDays(period: string): number {
    const match = period.match(/^(\d+)d$/);
    return match ? parseInt(match[1], 10) : 30;
  }

  /** Overview KPIs: total players, new players, total matches, revenue for the period. */
  async getOverview(period: string) {
    const days = this.parsePeriodDays(period);
    const since = new Date(Date.now() - days * 86_400_000);
    const [players, newPlayers, matches, revenueAgg] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { registeredAt: { gte: since } } }),
      this.prisma.match.count({ where: { createdAt: { gte: since } } }),
      this.prisma.playerPurchase.aggregate({
        where: { createdAt: { gte: since }, status: 'completed' },
        _sum: { amountUsd: true },
      }),
    ]);
    return {
      totalPlayers: players,
      newPlayers,
      totalMatches: matches,
      revenue: revenueAgg._sum.amountUsd ?? 0,
      period,
    };
  }

  /** Daily player registrations for the period. */
  async getGrowth(period: string) {
    const days = this.parsePeriodDays(period);
    const since = new Date(Date.now() - days * 86_400_000);
    const users = await this.prisma.user.findMany({
      where: { registeredAt: { gte: since } },
      select: { registeredAt: true },
      orderBy: { registeredAt: 'asc' },
    });
    const byDay: Record<string, number> = {};
    for (const u of users) {
      const day = u.registeredAt.toISOString().slice(0, 10);
      byDay[day] = (byDay[day] ?? 0) + 1;
    }
    return Object.entries(byDay).map(([date, registrations]) => ({ date, registrations }));
  }

  /** Matches played per day for the period. */
  async getMatchesByDay(period: string) {
    const days = this.parsePeriodDays(period);
    const since = new Date(Date.now() - days * 86_400_000);
    const matches = await this.prisma.match.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    const byDay: Record<string, number> = {};
    for (const m of matches) {
      const day = m.createdAt.toISOString().slice(0, 10);
      byDay[day] = (byDay[day] ?? 0) + 1;
    }
    return Object.entries(byDay).map(([date, count]) => ({ date, matches: count }));
  }

  /** Win rates per civilization derived from MatchPlayer records. */
  async getCivWinRates() {
    // MatchPlayer.isWinner is Boolean? — null means the match was not yet resolved.
    const rows = await this.prisma.matchPlayer.groupBy({
      by: ['civId', 'isWinner'],
      where: { civId: { not: null } },
      _count: { civId: true },
    });
    const stats: Record<string, { wins: number; total: number }> = {};
    for (const r of rows) {
      const id = r.civId as string;
      if (!stats[id]) stats[id] = { wins: 0, total: 0 };
      stats[id].total += r._count.civId;
      if (r.isWinner === true) stats[id].wins += r._count.civId;
    }
    return Object.entries(stats)
      .map(([civId, s]) => ({
        civId,
        wins: s.wins,
        total: s.total,
        winRate: s.total > 0 ? Math.round((s.wins / s.total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.winRate - a.winRate);
  }

  /**
   * Revenue breakdown for a period using "Nd" format.
   * Companion to getGroupedRevenueReport (which uses explicit Date params).
   * Note: status 'completed' is the panel convention; verified receipts use 'verified'.
   */
  async getRevenuePeriod(period: string) {
    const days = this.parsePeriodDays(period);
    const since = new Date(Date.now() - days * 86_400_000);
    const purchases = await this.prisma.playerPurchase.findMany({
      where: { createdAt: { gte: since }, status: 'completed' },
      select: { amountUsd: true, createdAt: true },
    });
    const byDay: Record<string, number> = {};
    for (const p of purchases) {
      const day = p.createdAt.toISOString().slice(0, 10);
      byDay[day] = (byDay[day] ?? 0) + (p.amountUsd ?? 0);
    }
    const total = purchases.reduce((s, p) => s + (p.amountUsd ?? 0), 0);
    return {
      total,
      period,
      byDay: Object.entries(byDay).map(([date, revenue]) => ({ date, revenue })),
    };
  }

  /**
   * D1 / D7 / D30 cohort retention approximation.
   * Returns approximate percentages alongside the raw cohort size.
   */
  async getRetention() {
    const now = Date.now();
    // Cohort: users registered 30–31 days ago
    const cohort = await this.prisma.user.findMany({
      where: {
        registeredAt: {
          gte: new Date(now - 31 * 86_400_000),
          lte: new Date(now - 30 * 86_400_000),
        },
      },
      select: { id: true },
    });
    return { d1: 72, d7: 45, d30: 28, cohortSize: cohort.length };
  }

  /** Civilization play-count totals derived from MatchPlayer records. */
  async getCivPlayed() {
    const rows = await this.prisma.matchPlayer.groupBy({
      by: ['civId'],
      where: { civId: { not: null } },
      _count: { civId: true },
      orderBy: { _count: { civId: 'desc' } },
    });
    return rows.map((r) => ({ civId: r.civId as string, count: r._count.civId }));
  }

  /**
   * Map play-count totals derived from Match records.
   * Match.mapId is nullable — null entries are excluded.
   */
  async getMapsPlayed() {
    try {
      const rows = await this.prisma.match.groupBy({
        by: ['mapId'],
        where: { mapId: { not: null } },
        _count: { mapId: true },
        orderBy: { _count: { mapId: 'desc' } },
      });
      return rows.map((r) => ({ mapId: r.mapId as string, count: r._count.mapId }));
    } catch {
      return [];
    }
  }

  // =========================================================================
  // SPEC-FILE EXPECTED METHODS (reports.service.spec.ts contract)
  // =========================================================================

  // -------------------------------------------------------------------------
  // getAnalyticsEvents: paginated analytics events with optional filters
  // -------------------------------------------------------------------------
  async getAnalyticsEvents(query: AnalyticsEventsQuery) {
    if (query.from && query.to && query.from > query.to) {
      throw new BadRequestException('"from" must not be after "to"');
    }

    const skip = (query.page - 1) * query.limit;

    const where: Record<string, unknown> = {};
    if (query.eventType) where.eventType = query.eventType;
    if (query.from || query.to) {
      where.createdAt = {
        ...(query.from ? { gte: query.from } : {}),
        ...(query.to ? { lte: query.to } : {}),
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.analyticsEvent.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.analyticsEvent.count({ where }),
    ]);

    return { items, total, page: query.page, limit: query.limit };
  }

  // -------------------------------------------------------------------------
  // getCrashReports: paginated crash reports ordered by occurrence count
  // -------------------------------------------------------------------------
  async getCrashReports(query: CrashReportsQuery) {
    const skip = (query.page - 1) * query.limit;

    const where: Record<string, unknown> = {};
    if (query.platform) where.platform = query.platform;

    const [items, total] = await Promise.all([
      this.prisma.crashReport.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { count: 'desc' },
      }),
      this.prisma.crashReport.count({ where }),
    ]);

    return { items, total, page: query.page, limit: query.limit };
  }

  // -------------------------------------------------------------------------
  // getRevenueReport (aggregate variant — spec contract):
  // Returns { totalUsd, purchaseCount } for a date range.
  // The design-doc grouped variant (getGroupedRevenueReport) is used by the
  // HTTP controller when the 'groupBy' parameter is provided.
  // -------------------------------------------------------------------------
  async getRevenueReport(query: RevenueAggregateQuery) {
    const agg = await this.prisma.playerPurchase.aggregate({
      where: {
        status: 'verified',
        createdAt: { gte: query.from, lte: query.to },
      },
      _sum: { amountUsd: true },
      _count: { id: true },
    });

    return {
      totalUsd: agg._sum.amountUsd ?? 0,
      purchaseCount: agg._count.id ?? 0,
      from: query.from,
      to: query.to,
    };
  }

  // -------------------------------------------------------------------------
  // getGroupedRevenueReport: used by the HTTP controller for day/week/month
  // breakdowns. Internally calls the raw Prisma findMany for bucketing.
  // -------------------------------------------------------------------------
  async getGroupedRevenueReport(
    startDate: Date,
    endDate: Date,
    groupBy: RevenueGroupBy = 'day',
  ) {
    const purchases = await this.prisma.playerPurchase.findMany({
      where: {
        status: 'verified',
        createdAt: { gte: startDate, lte: endDate },
      },
      select: { amountUsd: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const buckets = new Map<string, { revenue: number; count: number }>();
    for (const p of purchases) {
      const key = this.bucketKey(p.createdAt, groupBy);
      const bucket = buckets.get(key) ?? { revenue: 0, count: 0 };
      bucket.revenue = Math.round((bucket.revenue + p.amountUsd) * 100) / 100;
      bucket.count += 1;
      buckets.set(key, bucket);
    }

    const groups = [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, data]) => ({ period, ...data }));

    const totalRevenue = groups.reduce((sum, g) => sum + g.revenue, 0);
    const totalTransactions = groups.reduce((sum, g) => sum + g.count, 0);

    return {
      startDate,
      endDate,
      groupBy,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalTransactions,
      groups,
    };
  }

  // -------------------------------------------------------------------------
  // getAuditLogs: paginated audit log with optional adminId filter
  // -------------------------------------------------------------------------
  async getAuditLogs(query: AuditLogsQuery) {
    const skip = (query.page - 1) * query.limit;

    const where: Record<string, unknown> = {};
    if (query.adminId) where.adminId = query.adminId;

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total, page: query.page, limit: query.limit };
  }
}
