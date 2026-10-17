import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { PrismaService } from '../../database/prisma.service';

// ---------------------------------------------------------------------------
// Shared mock helpers
// ---------------------------------------------------------------------------

const makeProfile = (overrides: Partial<{
  userId: string;
  username: string;
  displayName: string | null;
  level: number;
  mmr: number;
  peakMmr: number;
  currentRank: string;
  isPremium: boolean;
  favoriteCivId: string | null;
  totalMatches: number;
  wins: number;
  losses: number;
}> = {}) => ({
  userId: 'user-1',
  username: 'SteelWarrior',
  displayName: 'Steel Warrior',
  level: 42,
  mmr: 1800,
  peakMmr: 2000,
  currentRank: 'gold',
  isPremium: true,
  favoriteCivId: 'civ-english',
  totalMatches: 300,
  wins: 180,
  losses: 120,
  ...overrides,
});

const makeUser = (overrides: Partial<{
  id: string;
  email: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  registeredAt: Date;
  deletedAt: Date | null;
  profile: ReturnType<typeof makeProfile> | null;
}> = {}) => ({
  id: 'user-1',
  email: 'player@test.com',
  isActive: true,
  lastLoginAt: new Date('2026-01-01T00:00:00Z'),
  registeredAt: new Date('2025-01-01T00:00:00Z'),
  deletedAt: null,
  profile: makeProfile(),
  ...overrides,
});

const makeMatchPlayer = (overrides: Partial<{
  matchId: string;
  userId: string;
  civId: string | null;
  isWinner: boolean | null;
  mmrDelta: number | null;
  match: {
    id: string;
    mode: string;
    status: string;
    startedAt: Date | null;
    endedAt: Date | null;
    durationTicks: number | null;
    tickRate: number;
    createdAt: Date;
  };
}> = {}) => ({
  matchId: 'match-1',
  userId: 'user-1',
  civId: 'civ-english',
  isWinner: true,
  mmrDelta: 25,
  match: {
    id: 'match-1',
    mode: 'ranked_1v1',
    status: 'completed',
    startedAt: new Date('2026-05-01T10:00:00Z'),
    endedAt: new Date('2026-05-01T10:30:00Z'),
    durationTicks: 27000,
    tickRate: 15,
    createdAt: new Date('2026-05-01T09:59:00Z'),
  },
  ...overrides,
});

const makeMatch = (overrides: Partial<{
  id: string;
  mode: string;
  status: string;
  mapId: string | null;
  region: string | null;
  startedAt: Date | null;
  endedAt: Date | null;
  durationTicks: number | null;
  tickRate: number;
  players: ReturnType<typeof makeMatchPlayer>[];
  result: { winnerUserId: string | null; victoryType: string | null; serverValidated: boolean } | null;
  events: { eventType: string; tick: number }[];
}> = {}) => ({
  id: 'match-1',
  mode: 'ranked_1v1',
  status: 'completed',
  mapId: 'map-highlands',
  region: 'eu-west',
  startedAt: new Date('2026-05-01T10:00:00Z'),
  endedAt: new Date('2026-05-01T10:30:00Z'),
  durationTicks: 27000,
  tickRate: 15,
  players: [makeMatchPlayer()],
  result: {
    winnerUserId: 'user-1',
    victoryType: 'conquest',
    serverValidated: true,
  },
  events: [
    { eventType: 'unit_trained', tick: 100 },
    { eventType: 'unit_trained', tick: 200 },
    { eventType: 'building_constructed', tick: 300 },
  ],
  ...overrides,
});

// ---------------------------------------------------------------------------
// Prisma mock
// ---------------------------------------------------------------------------

const mockPrisma: any = {
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  matchPlayer: {
    findMany: jest.fn(),
  },
  match: {
    findUnique: jest.fn(),
  },
  playerPurchase: {
    findMany: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
  },
  playerProfile: {
    findMany: jest.fn(),
  },
  analyticsEvent: {
    findMany: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  },
  crashReport: {
    findMany: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  },
  auditLog: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

const NOW = new Date('2026-06-13T00:00:00Z');
const YESTERDAY = new Date('2026-06-12T00:00:00Z');

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('ReportsService', () => {
  let service: ReportsService;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getPlayerReport(userId)
  // ─────────────────────────────────────────────────────────────────────────

  describe('getPlayerReport()', () => {
    it('returns full report shape for a player with match history', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(makeUser());
      mockPrisma.matchPlayer.findMany.mockResolvedValue([
        makeMatchPlayer({ isWinner: true }),
        makeMatchPlayer({ matchId: 'match-2', isWinner: false, civId: 'civ-french', mmrDelta: -20 }),
      ]);

      const result = await service.getPlayerReport('user-1');

      expect(result).toMatchObject({
        userId: 'user-1',
        profile: expect.objectContaining({ username: 'SteelWarrior', mmr: 1800 }),
        stats: expect.objectContaining({ totalMatches: 2, wins: 1, losses: 1 }),
        recentMatches: expect.any(Array),
      });
    });

    it('calculates winRate correctly from match history', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(makeUser());
      mockPrisma.matchPlayer.findMany.mockResolvedValue([
        makeMatchPlayer({ isWinner: true }),
        makeMatchPlayer({ matchId: 'match-2', isWinner: true }),
        makeMatchPlayer({ matchId: 'match-3', isWinner: false }),
        makeMatchPlayer({ matchId: 'match-4', isWinner: false }),
      ]);

      const result = await service.getPlayerReport('user-1');

      expect(result.stats.winRate).toBe(50);
    });

    it('returns winRate of 0 when player has no matches', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(makeUser());
      mockPrisma.matchPlayer.findMany.mockResolvedValue([]);

      const result = await service.getPlayerReport('user-1');

      expect(result.stats.winRate).toBe(0);
      expect(result.stats.totalMatches).toBe(0);
    });

    it('derives favoriteCivId from most-played civ in match history', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(makeUser({ profile: makeProfile({ favoriteCivId: null }) }));
      mockPrisma.matchPlayer.findMany.mockResolvedValue([
        makeMatchPlayer({ civId: 'civ-french' }),
        makeMatchPlayer({ matchId: 'match-2', civId: 'civ-french' }),
        makeMatchPlayer({ matchId: 'match-3', civId: 'civ-english' }),
      ]);

      const result = await service.getPlayerReport('user-1');

      expect(result.stats.favoriteCivId).toBe('civ-french');
    });

    it('accumulates totalPlaytimeSeconds from durationTicks / tickRate', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(makeUser());
      mockPrisma.matchPlayer.findMany.mockResolvedValue([
        makeMatchPlayer({
          match: {
            id: 'match-1', mode: 'ranked_1v1', status: 'completed',
            startedAt: null, endedAt: null,
            durationTicks: 15000, tickRate: 15, createdAt: new Date(),
          },
        }),
        makeMatchPlayer({
          matchId: 'match-2',
          match: {
            id: 'match-2', mode: 'ranked_1v1', status: 'completed',
            startedAt: null, endedAt: null,
            durationTicks: 30000, tickRate: 15, createdAt: new Date(),
          },
        }),
      ]);

      const result = await service.getPlayerReport('user-1');

      expect(result.stats.totalPlaytimeSeconds).toBe(3000);
    });

    it('returns profile: null when user has no PlayerProfile', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(makeUser({ profile: null }));
      mockPrisma.matchPlayer.findMany.mockResolvedValue([]);

      const result = await service.getPlayerReport('user-1');

      expect(result.profile).toBeNull();
    });

    it('throws NotFoundException when userId does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getPlayerReport('ghost-user'))
        .rejects.toThrow(NotFoundException);
    });

    it('caps recentMatches at 10 entries regardless of total match count', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(makeUser());
      const manyMatches = Array.from({ length: 15 }, (_, i) =>
        makeMatchPlayer({ matchId: `match-${i}` }),
      );
      mockPrisma.matchPlayer.findMany.mockResolvedValue(manyMatches);

      const result = await service.getPlayerReport('user-1');

      expect(result.recentMatches).toHaveLength(10);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getMatchReport(matchId)
  // ─────────────────────────────────────────────────────────────────────────

  describe('getMatchReport()', () => {
    it('returns full match report shape for a completed match', async () => {
      mockPrisma.match.findUnique.mockResolvedValue(makeMatch());

      const result = await service.getMatchReport('match-1');

      expect(result).toMatchObject({
        matchId: 'match-1',
        mode: 'ranked_1v1',
        durationSeconds: 1800,
        participants: expect.any(Array),
        result: expect.objectContaining({ victoryType: 'conquest' }),
        eventSummary: expect.any(Object),
        totalEvents: 3,
      });
    });

    it('aggregates eventSummary counts correctly by eventType', async () => {
      mockPrisma.match.findUnique.mockResolvedValue(makeMatch({
        events: [
          { eventType: 'unit_trained', tick: 10 },
          { eventType: 'unit_trained', tick: 20 },
          { eventType: 'building_constructed', tick: 30 },
          { eventType: 'unit_trained', tick: 40 },
        ],
      }));

      const result = await service.getMatchReport('match-1');

      expect(result.eventSummary).toEqual({
        unit_trained: 3,
        building_constructed: 1,
      });
    });

    it('returns durationSeconds: null when durationTicks is null', async () => {
      mockPrisma.match.findUnique.mockResolvedValue(makeMatch({ durationTicks: null }));

      const result = await service.getMatchReport('match-1');

      expect(result.durationSeconds).toBeNull();
    });

    it('returns result: null when match has no MatchResult record', async () => {
      mockPrisma.match.findUnique.mockResolvedValue(makeMatch({ result: null }));

      const result = await service.getMatchReport('match-1');

      expect(result.result).toBeNull();
    });

    it('throws NotFoundException when matchId does not exist', async () => {
      mockPrisma.match.findUnique.mockResolvedValue(null);

      await expect(service.getMatchReport('ghost-match'))
        .rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getRevenueReport(query)
  // ─────────────────────────────────────────────────────────────────────────

  describe('getRevenueReport()', () => {
    it('returns aggregated totalUsd and purchaseCount for the date range', async () => {
      mockPrisma.playerPurchase.aggregate.mockResolvedValue({
        _sum: { amountUsd: 1299.5 },
        _count: { id: 260 },
      });

      const result = await service.getRevenueReport({ from: YESTERDAY, to: NOW });

      expect(result).toMatchObject({
        totalUsd: 1299.5,
        purchaseCount: 260,
        from: YESTERDAY,
        to: NOW,
      });
    });

    it('returns totalUsd: 0 when aggregate _sum is null (no purchases in range)', async () => {
      mockPrisma.playerPurchase.aggregate.mockResolvedValue({
        _sum: { amountUsd: null },
        _count: { id: 0 },
      });

      const result = await service.getRevenueReport({ from: YESTERDAY, to: NOW });

      expect(result.totalUsd).toBe(0);
      expect(result.purchaseCount).toBe(0);
    });

    it('queries only verified purchases within the date range', async () => {
      mockPrisma.playerPurchase.aggregate.mockResolvedValue({
        _sum: { amountUsd: 0 },
        _count: { id: 0 },
      });

      await service.getRevenueReport({ from: YESTERDAY, to: NOW });

      expect(mockPrisma.playerPurchase.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'verified',
            createdAt: { gte: YESTERDAY, lte: NOW },
          }),
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getChurnReport(days, page, limit)
  // ─────────────────────────────────────────────────────────────────────────

  describe('getChurnReport()', () => {
    it('returns paginated churn list with correct metadata shape', async () => {
      const churnedUsers = [
        makeUser({ id: 'user-2', lastLoginAt: new Date('2025-12-01T00:00:00Z') }),
        makeUser({ id: 'user-3', lastLoginAt: new Date('2025-11-01T00:00:00Z') }),
      ];
      mockPrisma.user.findMany.mockResolvedValue(churnedUsers);
      mockPrisma.user.count.mockResolvedValue(2);

      const result = await service.getChurnReport(30, 1, 20);

      expect(result).toMatchObject({
        inactiveSinceDays: 30,
        total: 2,
        page: 1,
        limit: 20,
        items: churnedUsers,
      });
    });

    it('applies correct skip offset for page 2', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      await service.getChurnReport(30, 2, 10);

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });

    it('filters only active non-deleted users with lastLoginAt before cutoff', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      await service.getChurnReport(7, 1, 20);

      const callArg = mockPrisma.user.findMany.mock.calls[0][0];
      expect(callArg.where).toMatchObject({
        deletedAt: null,
        isActive: true,
        lastLoginAt: { lt: expect.any(Date) },
      });
    });

    it('returns empty items array when no churned users exist', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      const result = await service.getChurnReport(90, 1, 20);

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('cutoffDate is a Date computed approximately days ago', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      const result = await service.getChurnReport(14, 1, 20);

      expect(result.cutoffDate).toBeInstanceOf(Date);
      const diffDays = (Date.now() - result.cutoffDate.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeGreaterThanOrEqual(13.9);
      expect(diffDays).toBeLessThanOrEqual(14.1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getTopPlayersReport(limit)
  // ─────────────────────────────────────────────────────────────────────────

  describe('getTopPlayersReport()', () => {
    it('returns topByMmr and topByMatches arrays with sequential rank fields', async () => {
      const byMmr = [
        makeProfile({ userId: 'user-1', mmr: 2500, totalMatches: 100 }),
        makeProfile({ userId: 'user-2', mmr: 2200, totalMatches: 300 }),
      ];
      const byMatches = [
        makeProfile({ userId: 'user-2', mmr: 2200, totalMatches: 300 }),
        makeProfile({ userId: 'user-1', mmr: 2500, totalMatches: 100 }),
      ];
      mockPrisma.playerProfile.findMany
        .mockResolvedValueOnce(byMmr)
        .mockResolvedValueOnce(byMatches);

      const result = await service.getTopPlayersReport(50);

      expect(result.topByMmr[0]).toMatchObject({ rank: 1, mmr: 2500 });
      expect(result.topByMmr[1]).toMatchObject({ rank: 2, mmr: 2200 });
      expect(result.topByMatches[0]).toMatchObject({ rank: 1, totalMatches: 300 });
      expect(result.topByMatches[1]).toMatchObject({ rank: 2, totalMatches: 100 });
    });

    it('calls playerProfile.findMany twice (once per ranking dimension)', async () => {
      mockPrisma.playerProfile.findMany.mockResolvedValue([]);

      await service.getTopPlayersReport(10);

      expect(mockPrisma.playerProfile.findMany).toHaveBeenCalledTimes(2);
    });

    it('applies the limit parameter as take for both queries', async () => {
      mockPrisma.playerProfile.findMany.mockResolvedValue([]);

      await service.getTopPlayersReport(25);

      const calls = mockPrisma.playerProfile.findMany.mock.calls;
      expect(calls[0][0]).toMatchObject({ take: 25 });
      expect(calls[1][0]).toMatchObject({ take: 25 });
    });

    it('orders the first query by mmr descending', async () => {
      mockPrisma.playerProfile.findMany.mockResolvedValue([]);

      await service.getTopPlayersReport(10);

      expect(mockPrisma.playerProfile.findMany.mock.calls[0][0]).toMatchObject({
        orderBy: { mmr: 'desc' },
      });
    });

    it('orders the second query by totalMatches descending', async () => {
      mockPrisma.playerProfile.findMany.mockResolvedValue([]);

      await service.getTopPlayersReport(10);

      expect(mockPrisma.playerProfile.findMany.mock.calls[1][0]).toMatchObject({
        orderBy: { totalMatches: 'desc' },
      });
    });

    it('returns empty arrays when no player profiles exist', async () => {
      mockPrisma.playerProfile.findMany.mockResolvedValue([]);

      const result = await service.getTopPlayersReport(50);

      expect(result.topByMmr).toHaveLength(0);
      expect(result.topByMatches).toHaveLength(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getAnalyticsEvents(query)
  // ─────────────────────────────────────────────────────────────────────────

  describe('getAnalyticsEvents()', () => {
    it('returns paginated analytics events filtered by date range', async () => {
      const event = { id: 'event-1', eventType: 'match_start', createdAt: YESTERDAY };
      mockPrisma.analyticsEvent.findMany.mockResolvedValue([event]);
      mockPrisma.analyticsEvent.count.mockResolvedValue(1);

      const result = await service.getAnalyticsEvents({ from: YESTERDAY, to: NOW, page: 1, limit: 50 });

      expect(mockPrisma.analyticsEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ createdAt: { gte: YESTERDAY, lte: NOW } }),
          skip: 0,
          take: 50,
        }),
      );
      expect(result).toMatchObject({ items: [event], total: 1 });
    });

    it('filters by eventType when provided', async () => {
      mockPrisma.analyticsEvent.findMany.mockResolvedValue([]);
      mockPrisma.analyticsEvent.count.mockResolvedValue(0);

      await service.getAnalyticsEvents({ eventType: 'match_start', page: 1, limit: 50 });

      expect(mockPrisma.analyticsEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ eventType: 'match_start' }) }),
      );
    });

    it('throws BadRequestException when "from" is after "to"', async () => {
      await expect(
        service.getAnalyticsEvents({ from: NOW, to: YESTERDAY, page: 1, limit: 50 }),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.analyticsEvent.findMany).not.toHaveBeenCalled();
    });
  });
});
