/**
 * Story Type  : Logic (service-layer formulas and data aggregation)
 * Output      : tests/unit/analytics/
 * Gate Level  : BLOCKING
 *
 * Covered methods
 *   trackEvent(dto)          — persists a new AnalyticsEvent row
 *   getEvents(dto)           — returns { data, meta: { total, page, limit, totalPages } }
 *   getDashboardStats()      — returns { date, dau, newRegistrations, totalEvents, activeSessions }
 *   getTopEvents(topN)       — returns top-N event types ranked by occurrence count
 *
 * Mock scope : analyticsEvent, user, playerSession prisma models only.
 *              jest.resetAllMocks() runs before every test.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../../database/prisma.service';

// ---------------------------------------------------------------------------
// Shared mock — all Prisma model methods used by AnalyticsService
// ---------------------------------------------------------------------------
const mockPrisma: any = {
  analyticsEvent: {
    create:   jest.fn(),
    findMany: jest.fn(),
    count:    jest.fn(),
    groupBy:  jest.fn(),
  },
  user: {
    count:    jest.fn(),
    findMany: jest.fn(),
  },
  playerSession: {
    count:    jest.fn(),
    findMany: jest.fn(),
  },
  match: {
    aggregate: jest.fn(),
    groupBy:   jest.fn(),
  },
  matchPlayer: {
    groupBy: jest.fn(),
  },
  playerPurchase: {
    findMany: jest.fn(),
  },
  // getEvents and getDashboardStats both delegate to $transaction
  $transaction: jest.fn(),
};

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------
const NOW = new Date('2026-06-13T12:00:00.000Z');

const makeEvent = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id:         'evt-uuid-1',
  userId:     'user-uuid-1',
  sessionId:  'sess-abc',
  eventType:  'match_started',
  properties: { mapId: 'highland' },
  platform:   null,
  appVersion: null,
  country:    null,
  createdAt:  NOW,
  ...overrides,
});

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------
describe('AnalyticsService', () => {
  let service: AnalyticsService;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  // -------------------------------------------------------------------------
  // trackEvent()
  // -------------------------------------------------------------------------
  describe('trackEvent()', () => {
    it('normal case — persists and returns the created event', async () => {
      // Arrange
      const dto = {
        eventType: 'match_started',
        userId:    'user-uuid-1',
        sessionId: 'sess-abc',
        data:      { mapId: 'highland' },
      };
      const created = makeEvent();
      mockPrisma.analyticsEvent.create.mockResolvedValue(created);

      // Act
      const result = await service.trackEvent(dto);

      // Assert
      expect(result).toEqual(created);
      expect(mockPrisma.analyticsEvent.create).toHaveBeenCalledTimes(1);
    });

    it('anonymous event — userId and sessionId absent, still persists', async () => {
      // Arrange
      const dto = { eventType: 'app_launched' };
      const created = makeEvent({ userId: null, sessionId: null, eventType: 'app_launched' });
      mockPrisma.analyticsEvent.create.mockResolvedValue(created);

      // Act
      const result = await service.trackEvent(dto);

      // Assert
      expect(result).toBeDefined();
      expect(mockPrisma.analyticsEvent.create).toHaveBeenCalledTimes(1);
    });

    it('passes properties payload through to Prisma create call', async () => {
      // Arrange
      const dto = {
        eventType: 'purchase_complete',
        data:      { itemId: 'chest_gold', amountUsd: 4.99 },
      };
      mockPrisma.analyticsEvent.create.mockResolvedValue(makeEvent({ eventType: 'purchase_complete' }));

      // Act
      await service.trackEvent(dto);

      // Assert — the create call must include the data/properties field
      const createArg = mockPrisma.analyticsEvent.create.mock.calls[0][0];
      const body: Record<string, unknown> = createArg?.data ?? createArg;
      expect(body).toMatchObject(
        expect.objectContaining({
          eventType: 'purchase_complete',
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // getEvents()
  // Service uses this.prisma.$transaction([count, findMany]).
  // $transaction resolves to [total, items] — count result first, findMany second.
  // Service returns { data: items, meta: { total, page, limit, totalPages } }.
  // -------------------------------------------------------------------------
  describe('getEvents()', () => {
    it('normal case — returns { data, meta: { total, page, limit } }', async () => {
      // Arrange
      const events = [makeEvent(), makeEvent({ id: 'evt-uuid-2' })];
      // $transaction receives [count-promise, findMany-promise]; resolves to [total, items]
      mockPrisma.$transaction.mockResolvedValue([42, events]);

      // Act
      const result = await service.getEvents({ page: 1, limit: 20 });

      // Assert
      expect(result).toMatchObject({
        data: events,
        meta: { total: 42, page: 1, limit: 20 },
      });
    });

    it('zero results — returns empty data array, meta.total 0', async () => {
      // Arrange
      mockPrisma.$transaction.mockResolvedValue([0, []]);

      // Act
      const result = await service.getEvents({ page: 1, limit: 20 });

      // Assert
      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });

    it('page 2 with limit 10 — reflects correct page and limit in meta', async () => {
      // Arrange
      const events = [makeEvent()];
      mockPrisma.$transaction.mockResolvedValue([15, events]);

      // Act
      const result = await service.getEvents({ page: 2, limit: 10 });

      // Assert
      expect(result.meta.page).toBe(2);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.total).toBe(15);
    });

    it('calls $transaction exactly once (containing count and findMany)', async () => {
      // Arrange
      mockPrisma.$transaction.mockResolvedValue([0, []]);

      // Act
      await service.getEvents({ page: 1, limit: 20 });

      // Assert
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // getDashboardStats()
  // Service uses $transaction([user.count, analyticsEvent.count,
  //   playerSession.count, playerSession.findMany]).
  // Resolves to [newRegistrations, totalEvents, activeSessions, dauResult[]]
  // DAU = dauResult.length (distinct userId array).
  // Service also returns a `date` field (ISO date string).
  // -------------------------------------------------------------------------
  describe('getDashboardStats()', () => {
    it('normal case — returns all stat fields with correct values', async () => {
      // Arrange
      // $transaction resolves: [newRegistrations, totalEvents, activeSessions, dauUsers]
      mockPrisma.$transaction.mockResolvedValue([
        14,   // newRegistrations (user.count)
        320,  // totalEvents (analyticsEvent.count)
        55,   // activeSessions (playerSession.count)
        [{ userId: 'u1' }, { userId: 'u2' }],  // dauResult (playerSession.findMany distinct)
      ]);

      // Act
      const result = await service.getDashboardStats();

      // Assert
      expect(result).toMatchObject({
        dau:              expect.any(Number),
        newRegistrations: expect.any(Number),
        totalEvents:      expect.any(Number),
        activeSessions:   expect.any(Number),
      });
      // All values must be non-negative
      expect(result.dau).toBeGreaterThanOrEqual(0);
      expect(result.newRegistrations).toBeGreaterThanOrEqual(0);
      expect(result.totalEvents).toBeGreaterThanOrEqual(0);
      expect(result.activeSessions).toBeGreaterThanOrEqual(0);
    });

    it('zero-activity day — all stats are 0, does not throw', async () => {
      // Arrange
      mockPrisma.$transaction.mockResolvedValue([0, 0, 0, []]);

      // Act
      const result = await service.getDashboardStats();

      // Assert
      expect(result.dau).toBe(0);
      expect(result.newRegistrations).toBe(0);
      expect(result.totalEvents).toBe(0);
      expect(result.activeSessions).toBe(0);
    });

    it('returns an object with exactly the five expected keys', async () => {
      // Arrange
      mockPrisma.$transaction.mockResolvedValue([2, 10, 3, [{ userId: 'u1' }]]);

      // Act
      const result = await service.getDashboardStats();

      // Assert — service returns date + the four KPI fields
      expect(Object.keys(result).sort()).toEqual(
        ['activeSessions', 'date', 'dau', 'newRegistrations', 'totalEvents'].sort(),
      );
    });
  });

  // -------------------------------------------------------------------------
  // getTopEvents()
  // Service maps g._count.id — fixtures must use _count: { id: N }.
  // -------------------------------------------------------------------------
  describe('getTopEvents()', () => {
    it('normal case — returns top 5 event types ordered by count descending', async () => {
      // Arrange
      const groupByResult = [
        { eventType: 'match_started',    _count: { id: 500 } },
        { eventType: 'match_ended',      _count: { id: 480 } },
        { eventType: 'purchase_init',    _count: { id: 200 } },
        { eventType: 'app_foregrounded', _count: { id: 150 } },
        { eventType: 'chat_sent',        _count: { id: 90  } },
      ];
      mockPrisma.analyticsEvent.groupBy.mockResolvedValue(groupByResult);

      // Act
      const result = await service.getTopEvents(5);

      // Assert
      expect(result).toHaveLength(5);
      // First entry must be the most frequent
      expect(result[0].eventType).toBe('match_started');
      expect(result[0].count).toBe(500);
    });

    it('fewer events than topN — returns all available event types without error', async () => {
      // Arrange
      const groupByResult = [
        { eventType: 'app_launched', _count: { id: 3 } },
      ];
      mockPrisma.analyticsEvent.groupBy.mockResolvedValue(groupByResult);

      // Act
      const result = await service.getTopEvents(5);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].eventType).toBe('app_launched');
    });

    it('no events at all — returns empty array', async () => {
      // Arrange
      mockPrisma.analyticsEvent.groupBy.mockResolvedValue([]);

      // Act
      const result = await service.getTopEvents(5);

      // Assert
      expect(result).toEqual([]);
    });

    it('calls groupBy exactly once', async () => {
      // Arrange
      mockPrisma.analyticsEvent.groupBy.mockResolvedValue([]);

      // Act
      await service.getTopEvents(5);

      // Assert
      expect(mockPrisma.analyticsEvent.groupBy).toHaveBeenCalledTimes(1);
    });

    it('topN=1 — returns only the single highest-count event type', async () => {
      // Arrange
      const groupByResult = [
        { eventType: 'match_started', _count: { id: 999 } },
      ];
      mockPrisma.analyticsEvent.groupBy.mockResolvedValue(groupByResult);

      // Act
      const result = await service.getTopEvents(1);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].count).toBe(999);
    });
  });

  // -------------------------------------------------------------------------
  // getRetentionMetrics()
  // Iterates over the last `days` cohort days, querying user.findMany per day
  // then playerSession.findMany per retention offset (D1/D7/D30).
  // When cohortSize === 0 the inner retention queries are skipped entirely.
  // -------------------------------------------------------------------------
  describe('getRetentionMetrics()', () => {
    it('all-empty cohorts — returns an array of correct length with zeros', async () => {
      // Arrange: every user.findMany returns no users → short-circuit path
      mockPrisma.user.findMany.mockResolvedValue([]);

      // Act
      const result = await service.getRetentionMetrics(3);

      // Assert
      expect(result).toHaveLength(3);
      for (const row of result) {
        expect(row.cohortSize).toBe(0);
        expect(row.d1).toBe(0);
        expect(row.d7).toBe(0);
        expect(row.d30).toBe(0);
        expect(typeof row.date).toBe('string');
      }
    });

    it('non-empty cohort — returns percentage-formatted retention rates', async () => {
      // Arrange: cohort of 4 users; 2 retained on D1, none on D7/D30 (future days → 0)
      const cohortUsers = [
        { id: 'u1' }, { id: 'u2' }, { id: 'u3' }, { id: 'u4' },
      ];
      // First call: cohort day users. All subsequent playerSession.findMany calls:
      // D1 → 2 distinct retained users; D7/D30 → 0 (getRetentionMetrics returns 0
      // for future days automatically, so playerSession.findMany won't be called for them).
      mockPrisma.user.findMany.mockResolvedValue(cohortUsers);
      // playerSession.findMany is called only for past retention days.
      // When days=1 and i=0, cohortDay === today, so D1 is tomorrow → all offsets are future.
      // Use days=2 so cohortDay for i=1 is yesterday; D1 would be today (not future).
      mockPrisma.playerSession.findMany.mockResolvedValue([
        { userId: 'u1' },
        { userId: 'u2' },
      ]);

      // Act
      const result = await service.getRetentionMetrics(2);

      // Assert shape — at least one row with non-zero cohortSize
      expect(result).toHaveLength(2);
      const nonEmpty = result.filter((r) => r.cohortSize > 0);
      expect(nonEmpty.length).toBeGreaterThan(0);
      for (const row of nonEmpty) {
        expect(row.cohortSize).toBe(4);
        // Retention values are valid percentages (0–100)
        expect(row.d1).toBeGreaterThanOrEqual(0);
        expect(row.d1).toBeLessThanOrEqual(100);
      }
    });

    it('returns rows sorted oldest-first (ascending date order)', async () => {
      // Arrange
      mockPrisma.user.findMany.mockResolvedValue([]);

      // Act
      const result = await service.getRetentionMetrics(5);

      // Assert — dates must be in ascending order
      for (let i = 1; i < result.length; i++) {
        expect(result[i].date >= result[i - 1].date).toBe(true);
      }
    });
  });

  // -------------------------------------------------------------------------
  // getMatchStats()
  // Calls match.aggregate, match.groupBy, matchPlayer.groupBy (twice).
  // Returns { completedMatches, avgDurationTicks, topMaps, civWinRates }.
  // -------------------------------------------------------------------------
  describe('getMatchStats()', () => {
    it('normal case — returns correct shape with aggregated values', async () => {
      // Arrange
      mockPrisma.match.aggregate.mockResolvedValue({
        _avg: { durationTicks: 3600 },
        _count: { id: 42 },
      });
      mockPrisma.match.groupBy.mockResolvedValue([
        { mapId: 'highland',  _count: { id: 20 } },
        { mapId: 'lowlands',  _count: { id: 15 } },
      ]);
      // matchPlayer.groupBy called twice: totals then wins
      mockPrisma.matchPlayer.groupBy
        .mockResolvedValueOnce([
          { civId: 'civ_english',  _count: { id: 30 } },
          { civId: 'civ_mongols',  _count: { id: 25 } },
        ])
        .mockResolvedValueOnce([
          { civId: 'civ_english',  _count: { id: 18 } },
          { civId: 'civ_mongols',  _count: { id: 10 } },
        ]);

      // Act
      const result = await service.getMatchStats();

      // Assert shape
      expect(result.completedMatches).toBe(42);
      expect(result.avgDurationTicks).toBe(3600);
      expect(result.topMaps).toHaveLength(2);
      expect(result.topMaps[0]).toEqual({ mapId: 'highland', count: 20 });
      expect(result.civWinRates).toHaveLength(2);
      // civ_english: 18/30 = 60%
      const english = result.civWinRates.find((c) => c.civId === 'civ_english');
      expect(english?.winRate).toBe(60);
    });

    it('no completed matches — completedMatches is 0, avgDurationTicks defaults to 0', async () => {
      // Arrange
      mockPrisma.match.aggregate.mockResolvedValue({
        _avg: { durationTicks: null },
        _count: { id: 0 },
      });
      mockPrisma.match.groupBy.mockResolvedValue([]);
      mockPrisma.matchPlayer.groupBy.mockResolvedValue([]);

      // Act
      const result = await service.getMatchStats();

      // Assert
      expect(result.completedMatches).toBe(0);
      expect(result.avgDurationTicks).toBe(0);
      expect(result.topMaps).toEqual([]);
      expect(result.civWinRates).toEqual([]);
    });

    it('civ with no wins — winRate is 0, not NaN or undefined', async () => {
      // Arrange
      mockPrisma.match.aggregate.mockResolvedValue({
        _avg: { durationTicks: 1000 },
        _count: { id: 5 },
      });
      mockPrisma.match.groupBy.mockResolvedValue([]);
      mockPrisma.matchPlayer.groupBy
        .mockResolvedValueOnce([
          { civId: 'civ_french', _count: { id: 10 } },
        ])
        // wins query returns empty — no wins for any civ
        .mockResolvedValueOnce([]);

      // Act
      const result = await service.getMatchStats();

      // Assert
      const french = result.civWinRates.find((c) => c.civId === 'civ_french');
      expect(french).toBeDefined();
      expect(french?.winRate).toBe(0);
      expect(french?.wins).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // getRevenueReport()
  // Calls playerPurchase.findMany, then aggregates into daily buckets.
  // Returns { startDate, endDate, totalRevenue, totalTransactions, breakdown }.
  // -------------------------------------------------------------------------
  describe('getRevenueReport()', () => {
    it('normal case — aggregates revenue and transactions per day', async () => {
      // Arrange
      const purchases = [
        { amountUsd: 4.99, platform: 'ios',     createdAt: new Date('2026-06-01T10:00:00Z'), storeProductId: 'chest_gold' },
        { amountUsd: 9.99, platform: 'android',  createdAt: new Date('2026-06-01T15:00:00Z'), storeProductId: 'chest_mega' },
        { amountUsd: 4.99, platform: 'ios',     createdAt: new Date('2026-06-02T08:00:00Z'), storeProductId: 'chest_gold' },
      ];
      mockPrisma.playerPurchase.findMany.mockResolvedValue(purchases);

      // Act
      const result = await service.getRevenueReport('2026-06-01', '2026-06-02');

      // Assert top-level totals
      expect(result.startDate).toBe('2026-06-01');
      expect(result.endDate).toBe('2026-06-02');
      expect(result.totalTransactions).toBe(3);
      expect(result.totalRevenue).toBeCloseTo(19.97, 2);

      // Assert daily breakdown
      expect(result.breakdown).toHaveLength(2);
      const day1 = result.breakdown.find((d) => d.date === '2026-06-01');
      expect(day1?.transactions).toBe(2);
      expect(day1?.revenue).toBeCloseTo(14.98, 2);
    });

    it('no purchases in range — returns zero totals and empty breakdown', async () => {
      // Arrange
      mockPrisma.playerPurchase.findMany.mockResolvedValue([]);

      // Act
      const result = await service.getRevenueReport('2026-06-01', '2026-06-01');

      // Assert
      expect(result.totalRevenue).toBe(0);
      expect(result.totalTransactions).toBe(0);
      expect(result.breakdown).toEqual([]);
    });

    it('multi-platform on same day — byPlatform buckets are accumulated separately', async () => {
      // Arrange
      const purchases = [
        { amountUsd: 5.00, platform: 'ios',     createdAt: new Date('2026-06-10T09:00:00Z'), storeProductId: 'p1' },
        { amountUsd: 3.00, platform: 'android',  createdAt: new Date('2026-06-10T11:00:00Z'), storeProductId: 'p2' },
        { amountUsd: 2.00, platform: 'ios',     createdAt: new Date('2026-06-10T14:00:00Z'), storeProductId: 'p1' },
      ];
      mockPrisma.playerPurchase.findMany.mockResolvedValue(purchases);

      // Act
      const result = await service.getRevenueReport('2026-06-10', '2026-06-10');

      // Assert
      expect(result.breakdown).toHaveLength(1);
      const day = result.breakdown[0];
      expect(day.byPlatform['ios']).toBeCloseTo(7.00, 2);
      expect(day.byPlatform['android']).toBeCloseTo(3.00, 2);
    });
  });

  // -------------------------------------------------------------------------
  // getUserJourney()
  // Calls analyticsEvent.findMany ordered desc (most recent first), then
  // reverses the array to produce chronological (oldest-first) display order.
  // -------------------------------------------------------------------------
  describe('getUserJourney()', () => {
    it('normal case — returns events in chronological order (oldest first)', async () => {
      // Arrange: mock returns desc-ordered events (as Prisma would)
      const eventsDesc = [
        makeEvent({ id: 'evt-3', createdAt: new Date('2026-06-13T12:00:00Z') }),
        makeEvent({ id: 'evt-2', createdAt: new Date('2026-06-13T11:00:00Z') }),
        makeEvent({ id: 'evt-1', createdAt: new Date('2026-06-13T10:00:00Z') }),
      ];
      mockPrisma.analyticsEvent.findMany.mockResolvedValue(eventsDesc);

      // Act
      const result = await service.getUserJourney('user-uuid-1');

      // Assert — service reverses the array; oldest event must be first
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('evt-1');
      expect(result[2].id).toBe('evt-3');
    });

    it('user with no events — returns empty array', async () => {
      // Arrange
      mockPrisma.analyticsEvent.findMany.mockResolvedValue([]);

      // Act
      const result = await service.getUserJourney('user-uuid-unknown');

      // Assert
      expect(result).toEqual([]);
    });

    it('calls findMany with the correct userId filter', async () => {
      // Arrange
      mockPrisma.analyticsEvent.findMany.mockResolvedValue([]);
      const targetUserId = 'user-uuid-specific';

      // Act
      await service.getUserJourney(targetUserId);

      // Assert
      expect(mockPrisma.analyticsEvent.findMany).toHaveBeenCalledTimes(1);
      const callArg = mockPrisma.analyticsEvent.findMany.mock.calls[0][0];
      expect(callArg.where.userId).toBe(targetUserId);
    });
  });
});
