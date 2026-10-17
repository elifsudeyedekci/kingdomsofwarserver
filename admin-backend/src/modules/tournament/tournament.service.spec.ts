/**
 * Story Type : Logic (service-layer data operations)
 * Output     : tests/unit/tournament/  (co-located NestJS convention)
 * Gate Level : BLOCKING
 *
 * NOTE: TournamentService is a stub at the time of writing. Tests are written
 * against the domain surface derived from the Prisma schema
 * (Tournament, LeaderboardEntry, RankHistory, PromotionSeries).
 * Method signatures are forward-looking contracts.
 *
 * SCHEMA GAP (flagged for qa-lead):
 *   joinTournament() requires tracking per-tournament membership but the
 *   Prisma schema has no TournamentParticipant model at the time of writing.
 *   Tests below use a forward-looking `tournamentParticipant` mock delegate.
 *   The schema must be extended (or an alternative storage strategy chosen)
 *   before these tests can be promoted from TDD scaffold to green.
 *
 *   getTournamentLeaderboard() is modelled over the existing LeaderboardEntry
 *   model filtered by type='tournament' and metadata.tournamentId — this is a
 *   reasonable convention until a dedicated table is added.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { TournamentService } from './tournament.service';
import { PrismaService } from '../../database/prisma.service';

// ---------------------------------------------------------------------------
// Prisma mock
// ---------------------------------------------------------------------------

const mockPrisma: any = {
  tournament: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  leaderboardEntry: {
    findMany: jest.fn(),
    upsert: jest.fn(),
    count: jest.fn(),
  },
  rankHistory: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  promotionSeries: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = new Date('2026-06-13T12:00:00Z');
const FUTURE = new Date('2026-07-01T00:00:00Z');
const FAR_FUTURE = new Date('2026-07-15T00:00:00Z');
const PAST = new Date('2026-05-01T00:00:00Z');

const TOURNAMENT_ID = 'tournament-uuid-1';
const USER_ID = 'user-uuid-1';
const SEASON_ID = 'season-uuid-1';

const upcomingTournament = {
  id: TOURNAMENT_ID,
  name: 'KoW Summer Cup 2026',
  description: 'Ranked 1v1 bracket tournament',
  startAt: FUTURE,
  endAt: FAR_FUTURE,
  maxPlayers: 64,
  prizePool: { first: '100 USD', second: '50 USD' },
  status: 'upcoming',
  createdBy: 'admin-uuid-1',
  createdAt: NOW,
};

const activeTournament = { ...upcomingTournament, status: 'active' };
const cancelledTournament = { ...upcomingTournament, status: 'cancelled' };

const leaderboardEntry = {
  id: 'lb-uuid-1',
  userId: USER_ID,
  type: 'ranked_1v1',
  seasonId: SEASON_ID,
  score: 1450,
  rank: 12,
  metadata: null,
  updatedAt: NOW,
};

const rankHistoryEntry = {
  id: 'rh-uuid-1',
  userId: USER_ID,
  seasonId: SEASON_ID,
  finalRank: 'gold',
  finalMmr: 1450,
  placementCompleted: true,
  createdAt: NOW,
};

const activePromoSeries = {
  id: 'promo-uuid-1',
  userId: USER_ID,
  targetRank: 'platinum',
  wins: 1,
  losses: 0,
  totalMatches: 1,
  status: 'active',
  createdAt: NOW,
  completedAt: null,
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('TournamentService', () => {
  let service: TournamentService;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TournamentService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<TournamentService>(TournamentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // getTournaments()
  // -------------------------------------------------------------------------
  describe('getTournaments()', () => {
    it('returns paginated tournaments ordered by startAt ascending', async () => {
      mockPrisma.tournament.findMany.mockResolvedValue([upcomingTournament]);
      mockPrisma.tournament.count.mockResolvedValue(1);

      const result = await service.getTournaments({ page: 1, limit: 20 });

      expect(mockPrisma.tournament.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: expect.objectContaining({ startAt: 'asc' }),
          skip: 0,
          take: 20,
        }),
      );
      expect(result.items[0].name).toBe('KoW Summer Cup 2026');
    });

    it('filters by status when provided', async () => {
      mockPrisma.tournament.findMany.mockResolvedValue([upcomingTournament]);
      mockPrisma.tournament.count.mockResolvedValue(1);

      await service.getTournaments({ status: 'upcoming', page: 1, limit: 20 });

      expect(mockPrisma.tournament.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'upcoming' }),
        }),
      );
    });

    it('returns empty list when no tournaments exist', async () => {
      mockPrisma.tournament.findMany.mockResolvedValue([]);
      mockPrisma.tournament.count.mockResolvedValue(0);

      const result = await service.getTournaments({ page: 1, limit: 20 });

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // getTournamentById()
  // -------------------------------------------------------------------------
  describe('getTournamentById()', () => {
    it('returns the tournament when found', async () => {
      mockPrisma.tournament.findUnique.mockResolvedValue(upcomingTournament);

      const result = await service.getTournamentById(TOURNAMENT_ID);

      expect(mockPrisma.tournament.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: TOURNAMENT_ID } }),
      );
      expect(result.status).toBe('upcoming');
    });

    it('throws NotFoundException when tournament does not exist', async () => {
      mockPrisma.tournament.findUnique.mockResolvedValue(null);

      await expect(service.getTournamentById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // createTournament()
  // -------------------------------------------------------------------------
  describe('createTournament()', () => {
    // the fixtures are dates in June/July 2026: pin the clock so the suite does not rot when the real date passes them
    beforeEach(() => { jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'setInterval', 'queueMicrotask'] }); });
    afterEach(() => { jest.useRealTimers(); });
    const createDto = {
      name: 'Winter Clash 2026',
      startAt: FUTURE,
      endAt: FAR_FUTURE,
      maxPlayers: 32,
      createdBy: 'admin-uuid-1',
    };

    it('creates and returns a new tournament with status "upcoming"', async () => {
      const newTournament = { id: 'tournament-uuid-new', ...createDto, status: 'upcoming', createdAt: NOW };
      mockPrisma.tournament.create.mockResolvedValue(newTournament);

      const result = await service.createTournament(createDto);

      expect(mockPrisma.tournament.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: createDto.name, status: 'upcoming' }),
        }),
      );
      expect(result.id).toBe('tournament-uuid-new');
    });

    it('throws BadRequestException when startAt is in the past', async () => {
      await expect(
        service.createTournament({ ...createDto, startAt: PAST }),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.tournament.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when endAt is before or equal to startAt', async () => {
      await expect(
        service.createTournament({ ...createDto, endAt: FUTURE, startAt: FUTURE }),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.tournament.create).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // updateTournamentStatus()
  // -------------------------------------------------------------------------
  describe('updateTournamentStatus()', () => {
    it('transitions upcoming tournament to active', async () => {
      mockPrisma.tournament.findUnique.mockResolvedValue(upcomingTournament);
      mockPrisma.tournament.update.mockResolvedValue(activeTournament);

      const result = await service.updateTournamentStatus(TOURNAMENT_ID, 'active');

      expect(mockPrisma.tournament.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: TOURNAMENT_ID },
          data: expect.objectContaining({ status: 'active' }),
        }),
      );
      expect(result.status).toBe('active');
    });

    it('throws BadRequestException when transitioning a cancelled tournament', async () => {
      mockPrisma.tournament.findUnique.mockResolvedValue(cancelledTournament);

      await expect(
        service.updateTournamentStatus(TOURNAMENT_ID, 'active'),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.tournament.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when tournament does not exist', async () => {
      mockPrisma.tournament.findUnique.mockResolvedValue(null);

      await expect(
        service.updateTournamentStatus('nonexistent', 'active'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // getLeaderboard()
  // -------------------------------------------------------------------------
  describe('getLeaderboard()', () => {
    it('returns leaderboard entries ordered by score descending', async () => {
      mockPrisma.leaderboardEntry.findMany.mockResolvedValue([leaderboardEntry]);
      mockPrisma.leaderboardEntry.count.mockResolvedValue(1);

      const result = await service.getLeaderboard({
        type: 'ranked_1v1',
        seasonId: SEASON_ID,
        page: 1,
        limit: 100,
      });

      expect(mockPrisma.leaderboardEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'ranked_1v1', seasonId: SEASON_ID }),
          orderBy: expect.objectContaining({ score: 'desc' }),
        }),
      );
      expect(result.items[0].score).toBe(1450);
    });

    it('returns empty leaderboard when no entries exist for season', async () => {
      mockPrisma.leaderboardEntry.findMany.mockResolvedValue([]);
      mockPrisma.leaderboardEntry.count.mockResolvedValue(0);

      const result = await service.getLeaderboard({
        type: 'ranked_1v1',
        seasonId: 'new-season',
        page: 1,
        limit: 100,
      });

      expect(result.items).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // upsertLeaderboardEntry()
  // -------------------------------------------------------------------------
  describe('upsertLeaderboardEntry()', () => {
    it('upserts a leaderboard entry and returns the result', async () => {
      mockPrisma.leaderboardEntry.upsert.mockResolvedValue(leaderboardEntry);

      const result = await service.upsertLeaderboardEntry({
        userId: USER_ID,
        type: 'ranked_1v1',
        seasonId: SEASON_ID,
        score: 1450,
      });

      expect(mockPrisma.leaderboardEntry.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId_type_seasonId: { userId: USER_ID, type: 'ranked_1v1', seasonId: SEASON_ID },
          }),
          update: expect.objectContaining({ score: 1450 }),
          create: expect.objectContaining({ userId: USER_ID, score: 1450 }),
        }),
      );
      expect(result.score).toBe(1450);
    });
  });

  // -------------------------------------------------------------------------
  // getPromotionSeries()
  // -------------------------------------------------------------------------
  describe('getPromotionSeries()', () => {
    it('returns active promotion series for the user', async () => {
      mockPrisma.promotionSeries.findFirst.mockResolvedValue(activePromoSeries);

      const result = await service.getPromotionSeries(USER_ID);

      expect(mockPrisma.promotionSeries.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: USER_ID, status: 'active' }),
        }),
      );
      expect(result).not.toBeNull();
      expect(result!.targetRank).toBe('platinum');
    });

    it('returns null when user has no active promotion series', async () => {
      mockPrisma.promotionSeries.findFirst.mockResolvedValue(null);

      const result = await service.getPromotionSeries(USER_ID);

      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // recordPromotionResult()
  // -------------------------------------------------------------------------
  describe('recordPromotionResult()', () => {
    it('increments wins and sets status to "won" when threshold is reached', async () => {
      const series2Wins = { ...activePromoSeries, wins: 2, totalMatches: 3 };
      const wonSeries = { ...series2Wins, wins: 3, status: 'won', completedAt: new Date() };
      mockPrisma.promotionSeries.findFirst.mockResolvedValue(series2Wins);
      mockPrisma.promotionSeries.update.mockResolvedValue(wonSeries);

      const result = await service.recordPromotionResult(USER_ID, { isWin: true });

      expect(mockPrisma.promotionSeries.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ wins: 3, status: 'won' }),
        }),
      );
      expect(result.status).toBe('won');
    });

    it('increments losses and sets status to "lost" when max losses are reached', async () => {
      const series2Losses = { ...activePromoSeries, wins: 1, losses: 1, totalMatches: 2 };
      const lostSeries = { ...series2Losses, losses: 2, status: 'lost', completedAt: new Date() };
      mockPrisma.promotionSeries.findFirst.mockResolvedValue(series2Losses);
      mockPrisma.promotionSeries.update.mockResolvedValue(lostSeries);

      const result = await service.recordPromotionResult(USER_ID, { isWin: false });

      expect(mockPrisma.promotionSeries.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ losses: 2, status: 'lost' }),
        }),
      );
      expect(result.status).toBe('lost');
    });

    it('throws NotFoundException when no active promotion series exists for user', async () => {
      mockPrisma.promotionSeries.findFirst.mockResolvedValue(null);

      await expect(
        service.recordPromotionResult('unknown-user', { isWin: true }),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.promotionSeries.update).not.toHaveBeenCalled();
    });
  });
});
