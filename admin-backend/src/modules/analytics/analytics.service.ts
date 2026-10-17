import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { TrackEventDto } from './dto/track-event.dto';
import { QueryEventsDto } from './dto/query-events.dto';

/**
 * AnalyticsService
 * Implements the analytics feature set defined in the Kingdoms of War admin spec.
 * All queries target the following Prisma models:
 *   AnalyticsEvent, User, PlayerSession, Match, MatchPlayer, PlayerPurchase
 *
 * Note: AnalyticsEvent.properties stores the event payload (schema field name is
 * `properties`, exposed to callers as `data` via TrackEventDto to match spec language).
 */
@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // trackEvent
  // Records a single analytics event into the AnalyticsEvent table.
  // ---------------------------------------------------------------------------
  async trackEvent(dto: TrackEventDto) {
    return this.prisma.analyticsEvent.create({
      data: {
        eventType: dto.eventType,
        userId: dto.userId ?? null,
        sessionId: dto.sessionId ?? null,
        properties: (dto.data ?? {}) as Prisma.InputJsonObject,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // getEvents
  // Returns a paginated, filterable list of analytics events.
  // ---------------------------------------------------------------------------
  async getEvents(dto: QueryEventsDto) {
    const { page = 1, limit = 20, eventType, userId, startDate, endDate } = dto;
    const skip = (page - 1) * limit;

    const where = {
      ...(eventType ? { eventType } : {}),
      ...(userId ? { userId } : {}),
      ...(startDate || endDate
        ? {
            createdAt: {
              ...(startDate ? { gte: new Date(startDate) } : {}),
              ...(endDate ? { lte: new Date(`${endDate}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.analyticsEvent.count({ where }),
      this.prisma.analyticsEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      data: items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ---------------------------------------------------------------------------
  // getDashboardStats
  // Returns day-scoped KPIs: DAU (distinct active users via sessions),
  // new registrations, total events, and active (valid) session count.
  // ---------------------------------------------------------------------------
  async getDashboardStats(date?: string) {
    const targetDate = date ? new Date(date) : new Date();
    const dayStart = new Date(targetDate);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setUTCHours(23, 59, 59, 999);

    const dateRange = { gte: dayStart, lte: dayEnd };

    const [newRegistrations, totalEvents, activeSessions, dauResult] =
      await this.prisma.$transaction([
        // New user registrations on this day
        this.prisma.user.count({
          where: { registeredAt: dateRange },
        }),

        // Total analytics events on this day
        this.prisma.analyticsEvent.count({
          where: { createdAt: dateRange },
        }),

        // Active (non-revoked, non-expired) sessions that were created on this day
        this.prisma.playerSession.count({
          where: {
            createdAt: dateRange,
            isValid: true,
          },
        }),

        // DAU: distinct users who had at least one session created on this day
        this.prisma.playerSession.findMany({
          where: { createdAt: dateRange },
          select: { userId: true },
          distinct: ['userId'],
        }),
      ]);

    return {
      date: dayStart.toISOString().split('T')[0],
      dau: dauResult.length,
      newRegistrations,
      totalEvents,
      activeSessions,
    };
  }

  // ---------------------------------------------------------------------------
  // getRetentionMetrics
  // For each of the last `days` days, returns the D1 / D7 / D30 retention rate.
  // Retention = users who registered on day X and had a session on day X+N,
  // divided by total users who registered on day X.
  // ---------------------------------------------------------------------------
  async getRetentionMetrics(days: number = 30) {
    const results: Array<{
      date: string;
      cohortSize: number;
      d1: number;
      d7: number;
      d30: number;
    }> = [];

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    for (let i = days - 1; i >= 0; i--) {
      const cohortDay = new Date(today);
      cohortDay.setUTCDate(today.getUTCDate() - i);

      const cohortStart = new Date(cohortDay);
      const cohortEnd = new Date(cohortDay);
      cohortEnd.setUTCHours(23, 59, 59, 999);

      // Users who registered on this cohort day
      const cohortUsers = await this.prisma.user.findMany({
        where: { registeredAt: { gte: cohortStart, lte: cohortEnd } },
        select: { id: true },
      });

      const cohortSize = cohortUsers.length;
      if (cohortSize === 0) {
        results.push({ date: cohortDay.toISOString().split('T')[0], cohortSize: 0, d1: 0, d7: 0, d30: 0 });
        continue;
      }

      const userIds = cohortUsers.map((u) => u.id);

      const retentionForOffset = async (offsetDays: number): Promise<number> => {
        const retDay = new Date(cohortDay);
        retDay.setUTCDate(cohortDay.getUTCDate() + offsetDays);
        const retDayEnd = new Date(retDay);
        retDayEnd.setUTCHours(23, 59, 59, 999);

        // Only calculate if the retention day has passed
        if (retDay > today) return 0;

        const retained = await this.prisma.playerSession.findMany({
          where: {
            userId: { in: userIds },
            createdAt: { gte: retDay, lte: retDayEnd },
          },
          select: { userId: true },
          distinct: ['userId'],
        });

        return parseFloat(((retained.length / cohortSize) * 100).toFixed(2));
      };

      const [d1, d7, d30] = await Promise.all([
        retentionForOffset(1),
        retentionForOffset(7),
        retentionForOffset(30),
      ]);

      results.push({ date: cohortDay.toISOString().split('T')[0], cohortSize, d1, d7, d30 });
    }

    return results;
  }

  // ---------------------------------------------------------------------------
  // getMatchStats
  // Aggregates completed match data: average duration, most-played map,
  // and per-civilization win rate from MatchPlayer records.
  // ---------------------------------------------------------------------------
  async getMatchStats() {
    // Average match duration (only completed matches with durationTicks set)
    const durationAgg = await this.prisma.match.aggregate({
      where: { status: 'completed', durationTicks: { not: null } },
      _avg: { durationTicks: true },
      _count: { id: true },
    });

    // Most-played maps (completed matches only)
    const mapGroups = await this.prisma.match.groupBy({
      by: ['mapId'],
      where: { status: 'completed', mapId: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    // Civ win rate: group MatchPlayer by civId, count total games and wins
    const civTotals = await this.prisma.matchPlayer.groupBy({
      by: ['civId'],
      where: { civId: { not: null } },
      _count: { id: true },
    });

    const civWins = await this.prisma.matchPlayer.groupBy({
      by: ['civId'],
      where: { civId: { not: null }, isWinner: true },
      _count: { id: true },
    });

    const winMap = new Map(civWins.map((r) => [r.civId, r._count.id]));

    const civWinRates = civTotals
      .filter((r) => r.civId !== null)
      .map((r) => ({
        civId: r.civId,
        totalGames: r._count.id,
        wins: winMap.get(r.civId!) ?? 0,
        winRate: parseFloat((((winMap.get(r.civId!) ?? 0) / r._count.id) * 100).toFixed(2)),
      }))
      .sort((a, b) => b.winRate - a.winRate);

    return {
      completedMatches: durationAgg._count.id,
      avgDurationTicks: durationAgg._avg.durationTicks ?? 0,
      topMaps: mapGroups.map((m) => ({ mapId: m.mapId, count: m._count.id })),
      civWinRates,
    };
  }

  // ---------------------------------------------------------------------------
  // getRevenueReport
  // Returns a daily revenue breakdown for the given date range,
  // sourced from PlayerPurchase (status = 'completed' verified purchases).
  // ---------------------------------------------------------------------------
  async getRevenueReport(startDate: string, endDate: string) {
    const start = new Date(startDate);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(`${endDate}T23:59:59.999Z`);

    // Fetch all verified purchases in range — group in-process for daily buckets
    const purchases = await this.prisma.playerPurchase.findMany({
      where: {
        status: 'completed',
        createdAt: { gte: start, lte: end },
      },
      select: {
        amountUsd: true,
        platform: true,
        createdAt: true,
        storeProductId: true,
      },
    });

    // Aggregate into per-day buckets
    const dayMap = new Map<string, { revenue: number; transactions: number; byPlatform: Record<string, number> }>();

    for (const p of purchases) {
      const day = p.createdAt.toISOString().split('T')[0];
      if (!dayMap.has(day)) {
        dayMap.set(day, { revenue: 0, transactions: 0, byPlatform: {} });
      }
      const bucket = dayMap.get(day)!;
      bucket.revenue = parseFloat((bucket.revenue + p.amountUsd).toFixed(2));
      bucket.transactions += 1;
      bucket.byPlatform[p.platform] = parseFloat(
        ((bucket.byPlatform[p.platform] ?? 0) + p.amountUsd).toFixed(2),
      );
    }

    const breakdown = Array.from(dayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, stats]) => ({ date, ...stats }));

    const totalRevenue = parseFloat(breakdown.reduce((acc, d) => acc + d.revenue, 0).toFixed(2));
    const totalTransactions = breakdown.reduce((acc, d) => acc + d.transactions, 0);

    return { startDate, endDate, totalRevenue, totalTransactions, breakdown };
  }

  // ---------------------------------------------------------------------------
  // getTopEvents
  // Returns the top N most-triggered event types by count.
  // ---------------------------------------------------------------------------
  async getTopEvents(limit: number = 10) {
    const groups = await this.prisma.analyticsEvent.groupBy({
      by: ['eventType'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: Math.min(limit, 100),
    });

    return groups.map((g) => ({ eventType: g.eventType, count: g._count.id }));
  }

  // ---------------------------------------------------------------------------
  // getUserJourney
  // Returns the most recent 50 analytics events for a given userId,
  // ordered chronologically (oldest first for journey readability).
  // ---------------------------------------------------------------------------
  async getUserJourney(userId: string) {
    const events = await this.prisma.analyticsEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Reverse to chronological order for journey display
    return events.reverse();
  }

  // ---------------------------------------------------------------------------
  // getDashboardSummary
  // Wraps getDashboardStats() and returns the aggregated format expected by the
  // admin panel's /admin/analytics/* dashboard page.
  // ---------------------------------------------------------------------------
  async getDashboardSummary() {
    const stats = await this.getDashboardStats();
    return {
      totalPlayers: stats.newRegistrations ?? 0,
      activePlayers: stats.dau ?? 0,
      totalMatches: stats.totalEvents ?? 0,
      revenue: 0, // Revenue is not scoped to a single day in this summary; use /analytics/revenue for full breakdown
      ...stats,
    };
  }

  // ---------------------------------------------------------------------------
  // getDauTrend
  // Returns daily active user counts for the last `days` days (default 30,
  // max 90). A user is counted as active for a day if they appear in at least
  // one AnalyticsEvent row with a non-null userId on that calendar day (UTC).
  // Empty days (no events) are included in the response with dau: 0.
  // ---------------------------------------------------------------------------
  async getDauTrend(days: number = 30) {
    const since = new Date(Date.now() - days * 86_400_000);

    const events = await this.prisma.analyticsEvent.findMany({
      where: { createdAt: { gte: since } },
      select: { userId: true, createdAt: true },
    });

    // Group distinct userIds per calendar day (UTC)
    const byDay: Record<string, Set<string>> = {};
    for (const e of events) {
      const day = e.createdAt.toISOString().slice(0, 10);
      if (!byDay[day]) byDay[day] = new Set();
      if (e.userId) byDay[day].add(e.userId);
    }

    // Build ordered array covering every day in the window (gaps filled with 0)
    const result: Array<{ date: string; dau: number }> = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
      result.push({ date, dau: byDay[date]?.size ?? 0 });
    }
    return result;
  }

  // ---------------------------------------------------------------------------
  // getCivPicks
  // Returns civilization pick rates computed from MatchPlayer records.
  // Top 20 civs by raw pick count, with pickRate as a percentage (one decimal).
  // ---------------------------------------------------------------------------
  async getCivPicks() {
    const picks = await this.prisma.matchPlayer.groupBy({
      by: ['civId'],
      _count: { civId: true },
      orderBy: { _count: { civId: 'desc' } },
      take: 20,
    });

    const total = picks.reduce((s, p) => s + p._count.civId, 0);
    return picks.map((p) => ({
      civId: p.civId,
      count: p._count.civId,
      pickRate: total > 0 ? Math.round((p._count.civId / total) * 1000) / 10 : 0,
    }));
  }
}
