import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service';
import { PrismaService } from '../../database/prisma.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntry(
  overrides: Partial<{
    id: string;
    userId: string;
    type: string;
    score: number;
    rank: number | null;
    seasonId: string | null;
    metadata: unknown;
    updatedAt: Date;
  }> = {},
) {
  return {
    id: overrides.id ?? 'entry-1',
    userId: overrides.userId ?? 'user-1',
    type: overrides.type ?? 'global',
    score: overrides.score ?? 1000,
    rank: overrides.rank ?? null,
    seasonId: overrides.seasonId ?? null,
    metadata: overrides.metadata ?? null,
    updatedAt: overrides.updatedAt ?? new Date('2025-01-01'),
  };
}

// ---------------------------------------------------------------------------
// Prisma mock — includes all methods the service actually calls
// ---------------------------------------------------------------------------

const mockPrisma: any = {
  $transaction: jest.fn(),
  leaderboardEntry: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
  season: {
    findUnique: jest.fn(),
  },
};

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('LeaderboardService', () => {
  let service: LeaderboardService;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaderboardService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<LeaderboardService>(LeaderboardService);
  });

  // ── 1. getGlobalLeaderboard ───────────────────────────────────────────────

  describe('getGlobalLeaderboard()', () => {
    it('returns paged results on the happy path', async () => {
      const entries = [
        makeEntry({ userId: 'u1', score: 500 }),
        makeEntry({ id: 'e2', userId: 'u2', score: 300 }),
      ];
      // Service uses $transaction([count, findMany])
      mockPrisma.$transaction.mockResolvedValue([2, entries]);

      const result = await service.getGlobalLeaderboard(1, 20);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].userId).toBe('u1');
    });

    it('returns empty data array when no global entries exist', async () => {
      mockPrisma.$transaction.mockResolvedValue([0, []]);

      const result = await service.getGlobalLeaderboard(1, 20);

      expect(result.total).toBe(0);
      expect(result.data).toEqual([]);
      expect(result.totalPages).toBe(0);
    });

    it('returns empty data when page exceeds total pages', async () => {
      // 5 total entries, page=3 with limit=5 → skip=10, DB returns nothing
      mockPrisma.$transaction.mockResolvedValue([5, []]);

      const result = await service.getGlobalLeaderboard(3, 5);

      expect(result.total).toBe(5);
      expect(result.data).toEqual([]);
      expect(result.page).toBe(3);
    });
  });

  // ── 2. getSeasonLeaderboard ──────────────────────────────────────────────

  describe('getSeasonLeaderboard()', () => {
    const SEASON_ID = 'season-abc';

    it('returns paged season entries on the happy path', async () => {
      mockPrisma.season.findUnique.mockResolvedValue({ id: SEASON_ID });
      const entries = [makeEntry({ userId: 'u1', score: 900, seasonId: SEASON_ID, type: 'season' })];
      mockPrisma.$transaction.mockResolvedValue([1, entries]);

      const result = await service.getSeasonLeaderboard(SEASON_ID, 1, 20);

      expect(result.total).toBe(1);
      expect(result.data[0].seasonId).toBe(SEASON_ID);
      expect(result.totalPages).toBe(1);
    });

    it('applies correct pagination offset for page > 1', async () => {
      mockPrisma.season.findUnique.mockResolvedValue({ id: SEASON_ID });
      // 50 total entries, page=3 limit=10 → totalPages=5
      mockPrisma.$transaction.mockResolvedValue([50, []]);

      const result = await service.getSeasonLeaderboard(SEASON_ID, 3, 10);

      expect(result.page).toBe(3);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(5);
    });

    it('returns empty data when the season has no entries', async () => {
      mockPrisma.season.findUnique.mockResolvedValue({ id: SEASON_ID });
      mockPrisma.$transaction.mockResolvedValue([0, []]);

      const result = await service.getSeasonLeaderboard(SEASON_ID, 1, 20);

      expect(result.total).toBe(0);
      expect(result.data).toEqual([]);
    });

    it('throws NotFoundException for an unknown season', async () => {
      mockPrisma.season.findUnique.mockResolvedValue(null);

      await expect(service.getSeasonLeaderboard('ghost-season', 1, 20)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── 3. getPlayerRank ─────────────────────────────────────────────────────
  // Service returns a PlayerRankDto object — access .rank, not the result directly.

  describe('getPlayerRank()', () => {
    it('returns a PlayerRankDto with the correct rank for a global entry', async () => {
      const entry = makeEntry({ userId: 'u1', score: 500 });
      // No seasonId → findFirst path (seasonId null)
      mockPrisma.leaderboardEntry.findFirst.mockResolvedValue(entry);
      // 2 players have a strictly higher score → rank = 3
      mockPrisma.leaderboardEntry.count.mockResolvedValue(2);

      const result = await service.getPlayerRank('u1');

      expect(result.rank).toBe(3);
      expect(result.userId).toBe('u1');
      expect(result.score).toBe(500);
      expect(result.seasonId).toBeNull();
    });

    it('throws NotFoundException when the player has no leaderboard entry', async () => {
      mockPrisma.leaderboardEntry.findFirst.mockResolvedValue(null);

      await expect(service.getPlayerRank('no-one')).rejects.toThrow(NotFoundException);
    });

    it('returns rank 1 when no player has a higher score', async () => {
      const entry = makeEntry({ userId: 'u1', score: 9999 });
      mockPrisma.leaderboardEntry.findFirst.mockResolvedValue(entry);
      mockPrisma.leaderboardEntry.count.mockResolvedValue(0);

      const result = await service.getPlayerRank('u1');

      expect(result.rank).toBe(1);
    });

    it('calculates rank correctly for a seasonal entry via findUnique path', async () => {
      const entry = makeEntry({ userId: 'u1', score: 200, seasonId: 'season-xyz', type: 'season' });
      // seasonId is provided → findUnique path
      mockPrisma.leaderboardEntry.findUnique.mockResolvedValue(entry);
      mockPrisma.leaderboardEntry.count.mockResolvedValue(4);

      const result = await service.getPlayerRank('u1', 'season-xyz');

      expect(result.rank).toBe(5);
      expect(result.seasonId).toBe('season-xyz');
    });
  });

  // ── 4. updatePlayerScore ─────────────────────────────────────────────────

  describe('updatePlayerScore()', () => {
    it('increments score with delta semantics for a seasonal entry via upsert', async () => {
      const updated = makeEntry({ userId: 'u1', score: 1500, seasonId: 'season-1', type: 'season' });
      mockPrisma.leaderboardEntry.upsert.mockResolvedValue(updated);

      const result = await service.updatePlayerScore('u1', 'season-1', 500);

      expect(mockPrisma.leaderboardEntry.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ score: { increment: 500 } }),
          create: expect.objectContaining({ score: 500 }),
        }),
      );
      expect(result.score).toBe(1500);
    });

    it('creates a new seasonal entry when the player does not yet exist', async () => {
      const created = makeEntry({ userId: 'new-player', score: 200, seasonId: 'season-1', type: 'season' });
      mockPrisma.leaderboardEntry.upsert.mockResolvedValue(created);

      const result = await service.updatePlayerScore('new-player', 'season-1', 200);

      expect(result.userId).toBe('new-player');
      expect(result.score).toBe(200);
    });

    it('uses $transaction for global entries (seasonId null) — existing player is updated', async () => {
      const existing = makeEntry({ id: 'e1', userId: 'u1', score: 800 });
      const updated = makeEntry({ id: 'e1', userId: 'u1', score: 1100 });

      mockPrisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => {
        const tx = {
          leaderboardEntry: {
            findFirst: jest.fn().mockResolvedValue(existing),
            update: jest.fn().mockResolvedValue(updated),
            create: jest.fn(),
          },
        };
        return cb(tx);
      });

      const result = await service.updatePlayerScore('u1', null, 300);

      expect(result.score).toBe(1100);
    });

    it('creates a new global entry via $transaction when player does not yet exist', async () => {
      const created = makeEntry({ userId: 'brand-new', score: 150 });

      mockPrisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => {
        const tx = {
          leaderboardEntry: {
            findFirst: jest.fn().mockResolvedValue(null),
            update: jest.fn(),
            create: jest.fn().mockResolvedValue(created),
          },
        };
        return cb(tx);
      });

      const result = await service.updatePlayerScore('brand-new', null, 150);

      expect(result.userId).toBe('brand-new');
      expect(result.score).toBe(150);
    });
  });

  // ── 5. resetSeasonLeaderboard ────────────────────────────────────────────

  describe('resetSeasonLeaderboard()', () => {
    it('calls deleteMany with the correct where clause and returns { deleted: count }', async () => {
      mockPrisma.season.findUnique.mockResolvedValue({ id: 'season-1' });
      mockPrisma.leaderboardEntry.deleteMany.mockResolvedValue({ count: 42 });

      const result = await service.resetSeasonLeaderboard('season-1');

      expect(mockPrisma.leaderboardEntry.deleteMany).toHaveBeenCalledWith({
        where: { type: 'season', seasonId: 'season-1' },
      });
      expect(result).toEqual({ deleted: 42 });
    });

    it('throws NotFoundException when the season does not exist', async () => {
      mockPrisma.season.findUnique.mockResolvedValue(null);

      await expect(service.resetSeasonLeaderboard('unknown')).rejects.toThrow(NotFoundException);
    });
  });

  // ── 6. getTopN ───────────────────────────────────────────────────────────

  describe('getTopN()', () => {
    it('returns the top 5 global entries ordered by score descending', async () => {
      const entries = Array.from({ length: 5 }, (_, i) =>
        makeEntry({ id: `e${i}`, userId: `u${i}`, score: (5 - i) * 100 }),
      );
      mockPrisma.leaderboardEntry.findMany.mockResolvedValue(entries);

      const result = await service.getTopN(5);

      expect(mockPrisma.leaderboardEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5, orderBy: { score: 'desc' } }),
      );
      expect(result).toHaveLength(5);
      expect(result[0].score).toBe(500);
    });

    it('honours a custom N value', async () => {
      const entries = Array.from({ length: 3 }, (_, i) =>
        makeEntry({ id: `e${i}`, userId: `u${i}`, score: (3 - i) * 50 }),
      );
      mockPrisma.leaderboardEntry.findMany.mockResolvedValue(entries);

      const result = await service.getTopN(3);

      expect(mockPrisma.leaderboardEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 3 }),
      );
      expect(result).toHaveLength(3);
    });

    it('returns an empty array when the leaderboard is empty', async () => {
      mockPrisma.leaderboardEntry.findMany.mockResolvedValue([]);

      const result = await service.getTopN(10);

      expect(result).toEqual([]);
    });
  });

  // ── 7. getAroundPlayer ───────────────────────────────────────────────────

  describe('getAroundPlayer()', () => {
    it('returns players above, the target player, and players below within the window', async () => {
      const player = makeEntry({ userId: 'u5', score: 500 });
      // global → findFirst path
      mockPrisma.leaderboardEntry.findFirst.mockResolvedValue(player);
      // count of players with score > 500
      mockPrisma.leaderboardEntry.count.mockResolvedValue(2);
      // first findMany = aboveRows, second findMany = belowRows
      mockPrisma.leaderboardEntry.findMany
        .mockResolvedValueOnce([
          makeEntry({ userId: 'u4', score: 600 }),
          makeEntry({ userId: 'u3', score: 700 }),
        ])
        .mockResolvedValueOnce([
          makeEntry({ userId: 'u6', score: 400 }),
          makeEntry({ userId: 'u7', score: 300 }),
        ]);

      const result = await service.getAroundPlayer('u5', 5);

      expect(result.player.userId).toBe('u5');
      expect(result.above).toHaveLength(2);
      expect(result.below).toHaveLength(2);
    });

    it('returns an empty above array when the player is at the top of the leaderboard', async () => {
      const player = makeEntry({ userId: 'u1', score: 9999 });
      mockPrisma.leaderboardEntry.findFirst.mockResolvedValue(player);
      mockPrisma.leaderboardEntry.count.mockResolvedValue(0);
      mockPrisma.leaderboardEntry.findMany
        .mockResolvedValueOnce([]) // nobody above
        .mockResolvedValueOnce([
          makeEntry({ userId: 'u2', score: 800 }),
          makeEntry({ userId: 'u3', score: 700 }),
        ]);

      const result = await service.getAroundPlayer('u1', 5);

      expect(result.above).toEqual([]);
      expect(result.player.userId).toBe('u1');
      expect(result.below).toHaveLength(2);
    });

    it('throws NotFoundException when the player has no leaderboard entry', async () => {
      mockPrisma.leaderboardEntry.findFirst.mockResolvedValue(null);

      await expect(service.getAroundPlayer('ghost', 5)).rejects.toThrow(NotFoundException);
    });
  });
});
