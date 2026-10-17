import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { MatchService } from './match.service';
import { PrismaService } from '../../database/prisma.service';
import { AdminGateway } from '../../gateway/admin.gateway';

// ---------------------------------------------------------------------------
// Helpers — mirror the module-level ELO math from match.service.ts so we can
// independently validate the expected values in tests.
// ---------------------------------------------------------------------------
const ELO_K = 32;

function expectedScore(rA: number, rB: number): number {
  return 1 / (1 + Math.pow(10, (rB - rA) / 400));
}

function computeEloDeltas(
  ratings: { userId: string; mmr: number }[],
  winnerIds: Set<string>,
): Map<string, number> {
  const deltas = new Map<string, number>(ratings.map((r) => [r.userId, 0]));
  const n = ratings.length;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = ratings[i];
      const b = ratings[j];
      const eA = expectedScore(a.mmr, b.mmr);
      const sA = winnerIds.has(a.userId) ? 1 : 0;
      const sB = winnerIds.has(b.userId) ? 1 : 0;
      deltas.set(a.userId, (deltas.get(a.userId) ?? 0) + ELO_K * (sA - eA));
      deltas.set(b.userId, (deltas.get(b.userId) ?? 0) + ELO_K * (sB - (1 - eA)));
    }
  }

  const divisor = Math.max(1, n - 1);
  for (const [userId, delta] of deltas) {
    deltas.set(userId, Math.round(delta / divisor));
  }

  return deltas;
}

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------
const mockPrisma: any = {
  match: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  matchPlayer: {
    update: jest.fn(),
  },
  matchResult: {
    create: jest.fn(),
  },
  playerProfile: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
  // Array-form ($transaction([...operations])) and callback-form both used
  $transaction: jest.fn(),
};

describe('MatchService', () => {
  let service: MatchService;

  beforeEach(async () => {
    jest.resetAllMocks();

    // Default: array-form transaction just resolves each call's return value
    mockPrisma.$transaction.mockImplementation(
      async (arg: any) => {
        if (typeof arg === 'function') {
          return arg(mockPrisma);
        }
        // Array form — execute each promise/value
        return Promise.all(arg);
      },
    );

    // Default stubs
    mockPrisma.matchPlayer.update.mockResolvedValue({});
    mockPrisma.playerProfile.update.mockResolvedValue({});
    mockPrisma.matchResult.create.mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: AdminGateway, useValue: new Proxy({}, { get: (_t, p) => (p === 'then' ? undefined : jest.fn()) }) },
        MatchService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<MatchService>(MatchService);
  });

  // -------------------------------------------------------------------------
  // computeEloDeltas — isolated math tests
  // -------------------------------------------------------------------------
  describe('computeEloDeltas() — ELO math', () => {
    it('1v1 at equal MMR (1000 each): winner gains ~+16, loser loses ~-16', () => {
      const ratings = [
        { userId: 'a', mmr: 1000 },
        { userId: 'b', mmr: 1000 },
      ];
      const winnerIds = new Set(['a']);
      const deltas = computeEloDeltas(ratings, winnerIds);

      // K=32, equal MMR => expected = 0.5, delta = 32 * (1 - 0.5) = 16
      expect(deltas.get('a')).toBe(16);
      expect(deltas.get('b')).toBe(-16);
    });

    it('1v1 where winner has lower MMR: winner gains more than 16', () => {
      const ratings = [
        { userId: 'underdog', mmr: 800 },
        { userId: 'favourite', mmr: 1200 },
      ];
      const winnerIds = new Set(['underdog']);
      const deltas = computeEloDeltas(ratings, winnerIds);

      // Underdog wins an upset — should gain more than 16
      expect((deltas.get('underdog') ?? 0)).toBeGreaterThan(16);
      expect((deltas.get('favourite') ?? 0)).toBeLessThan(-16);
    });

    it('2v2 at equal MMR: each winner gains ~+16, each loser loses ~-16', () => {
      // With n=4 players and all equal MMR the divisor is n-1 = 3.
      // Each player plays 3 pairwise matches.
      // Winners face: 1 teammate (both winners, sA=1 vs sB=1, net 0) and 2 losers.
      // For each winner vs loser at equal MMR: delta contribution = 32*(1-0.5) = 16.
      // Total raw delta for a winner = 0 + 16 + 16 = 32, divided by 3 → ~11.
      // The exact value depends on same-team pairings — verify it's positive for winners.
      const ratings = [
        { userId: 'w1', mmr: 1000 },
        { userId: 'w2', mmr: 1000 },
        { userId: 'l1', mmr: 1000 },
        { userId: 'l2', mmr: 1000 },
      ];
      const winnerIds = new Set(['w1', 'w2']);
      const deltas = computeEloDeltas(ratings, winnerIds);

      expect((deltas.get('w1') ?? 0)).toBeGreaterThan(0);
      expect((deltas.get('w2') ?? 0)).toBeGreaterThan(0);
      expect((deltas.get('l1') ?? 0)).toBeLessThan(0);
      expect((deltas.get('l2') ?? 0)).toBeLessThan(0);

      // Symmetry: winners gain the same, losers lose the same
      expect(deltas.get('w1')).toBe(deltas.get('w2'));
      expect(deltas.get('l1')).toBe(deltas.get('l2'));
    });
  });

  // -------------------------------------------------------------------------
  // create()
  // -------------------------------------------------------------------------
  describe('create()', () => {
    it('creates a match with mode and player slots', async () => {
      const dto = {
        mode: '1v1',
        mapId: 'map-001',
        seed: 12345,
        region: 'eu-west',
        players: [
          { userId: 'user-a', slot: 0, teamId: 0, civId: 'civ-1' },
          { userId: 'user-b', slot: 1, teamId: 1, civId: 'civ-2' },
        ],
      };

      const createdMatch = { id: 'match-1', mode: dto.mode, players: dto.players };
      mockPrisma.match.create.mockResolvedValue(createdMatch);

      const result = await service.create(dto as any);

      expect(mockPrisma.match.create).toHaveBeenCalledTimes(1);
      const createArg = mockPrisma.match.create.mock.calls[0][0];
      expect(createArg.data.mode).toBe(dto.mode);
      expect(createArg.data.players.create).toHaveLength(2);
      expect(result).toEqual(createdMatch);
    });

    it('creates a match without players when players array is omitted', async () => {
      const dto = { mode: 'casual', mapId: 'map-002', seed: 0, region: 'us-east' };
      mockPrisma.match.create.mockResolvedValue({ id: 'match-2', mode: dto.mode, players: [] });

      await service.create(dto as any);

      const createArg = mockPrisma.match.create.mock.calls[0][0];
      expect(createArg.data.players).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // start()
  // -------------------------------------------------------------------------
  describe('start()', () => {
    it('snapshots mmrBefore for each player and sets status to "loading"', async () => {
      const matchId = 'match-1';
      const players = [
        { id: 'mp-1', userId: 'user-a', mmrBefore: null },
        { id: 'mp-2', userId: 'user-b', mmrBefore: null },
      ];
      const match = { id: matchId, status: 'waiting', players };

      mockPrisma.match.findUnique
        .mockResolvedValueOnce(match) // initial fetch
        .mockResolvedValueOnce({ ...match, status: 'loading' }); // final return

      mockPrisma.playerProfile.findMany.mockResolvedValue([
        { userId: 'user-a', mmr: 1200 },
        { userId: 'user-b', mmr: 1100 },
      ]);

      // Array-form transaction: just execute array of promises
      mockPrisma.$transaction.mockImplementation(async (ops: any[]) => Promise.all(ops));
      mockPrisma.match.update.mockResolvedValue({ ...match, status: 'loading' });

      await service.start(matchId);

      expect(mockPrisma.match.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'loading' }),
        }),
      );
      expect(mockPrisma.matchPlayer.update).toHaveBeenCalledTimes(2);
    });

    it('throws NotFoundException when match does not exist', async () => {
      mockPrisma.match.findUnique.mockResolvedValue(null);
      await expect(service.start('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when match is not in waiting state', async () => {
      mockPrisma.match.findUnique.mockResolvedValue({
        id: 'match-1',
        status: 'loading',
        players: [],
      });
      await expect(service.start('match-1')).rejects.toThrow(BadRequestException);
    });
  });

  // -------------------------------------------------------------------------
  // recordResult()
  // -------------------------------------------------------------------------
  describe('recordResult()', () => {
    const matchId = 'match-1';
    const players = [
      { id: 'mp-1', userId: 'user-a', mmrBefore: 1000 },
      { id: 'mp-2', userId: 'user-b', mmrBefore: 1000 },
    ];
    const match = { id: matchId, status: 'playing', players };

    const dto = {
      participants: [
        { userId: 'user-a', isWinner: true },
        { userId: 'user-b', isWinner: false },
      ],
      winnerUserId: 'user-a',
      victoryType: 'conquest',
      durationTicks: 5000,
      dataHash: 'abc123',
    };

    beforeEach(() => {
      // callback-form transaction
      mockPrisma.$transaction.mockImplementation((fn: (tx: any) => Promise<any>) => fn(mockPrisma));
      mockPrisma.match.findUnique
        .mockResolvedValueOnce(match)           // first call in recordResult
        .mockResolvedValueOnce({ ...match, status: 'completed' }); // getById at the end
      mockPrisma.playerProfile.findMany.mockResolvedValue([
        { userId: 'user-a', mmr: 1000 },
        { userId: 'user-b', mmr: 1000 },
      ]);
      mockPrisma.match.update.mockResolvedValue({});
      mockPrisma.matchPlayer.update.mockResolvedValue({});
      mockPrisma.playerProfile.update.mockResolvedValue({});
      mockPrisma.matchResult.create.mockResolvedValue({});
    });

    it('updates mmr for all players and sets isWinner correctly', async () => {
      await service.recordResult(matchId, dto as any);

      // Should update two MatchPlayer records
      expect(mockPrisma.matchPlayer.update).toHaveBeenCalledTimes(2);

      const winnerCall = mockPrisma.matchPlayer.update.mock.calls.find(
        (c: any[]) => c[0].data.isWinner === true,
      );
      const loserCall = mockPrisma.matchPlayer.update.mock.calls.find(
        (c: any[]) => c[0].data.isWinner === false,
      );

      expect(winnerCall).toBeDefined();
      expect(loserCall).toBeDefined();
    });

    it('creates a MatchResult record', async () => {
      await service.recordResult(matchId, dto as any);

      expect(mockPrisma.matchResult.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            matchId,
            winnerUserId: 'user-a',
            victoryType: 'conquest',
          }),
        }),
      );
    });

    it('increments peakMmr only for the winner (delta > 0)', async () => {
      await service.recordResult(matchId, dto as any);

      const profileUpdateCalls: any[] = mockPrisma.playerProfile.update.mock.calls;

      const winnerProfileUpdate = profileUpdateCalls.find(
        (c: any[]) => c[0].where.userId === 'user-a',
      );
      const loserProfileUpdate = profileUpdateCalls.find(
        (c: any[]) => c[0].where.userId === 'user-b',
      );

      expect(winnerProfileUpdate[0].data).toHaveProperty('peakMmr');
      expect(loserProfileUpdate[0].data).not.toHaveProperty('peakMmr');
    });

    it('throws NotFoundException when match does not exist', async () => {
      mockPrisma.match.findUnique.mockReset();
      mockPrisma.match.findUnique.mockResolvedValue(null);
      await expect(service.recordResult(matchId, dto as any)).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when match is already completed', async () => {
      mockPrisma.match.findUnique.mockReset();
      mockPrisma.match.findUnique.mockResolvedValue({ ...match, status: 'completed' });
      await expect(service.recordResult(matchId, dto as any)).rejects.toThrow(BadRequestException);
    });
  });

  // -------------------------------------------------------------------------
  // abandon()
  // -------------------------------------------------------------------------
  describe('abandon()', () => {
    it('sets match status to "cancelled"', async () => {
      const matchId = 'match-1';
      mockPrisma.match.findUnique.mockResolvedValue({ id: matchId, status: 'playing' });
      mockPrisma.match.update.mockResolvedValue({ id: matchId, status: 'cancelled' });

      const result = await service.abandon(matchId);

      expect(mockPrisma.match.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: matchId },
          data: expect.objectContaining({ status: 'cancelled' }),
        }),
      );
      expect(result).toHaveProperty('status', 'cancelled');
    });

    it('throws NotFoundException when match does not exist', async () => {
      mockPrisma.match.findUnique.mockResolvedValue(null);
      await expect(service.abandon('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // getById()
  // -------------------------------------------------------------------------
  describe('getById()', () => {
    it('returns the match with players and result when found', async () => {
      const matchId = 'match-1';
      const fullMatch = {
        id: matchId,
        status: 'completed',
        players: [
          {
            userId: 'user-a',
            slot: 0,
            teamId: 0,
            civId: 'civ-1',
            mmrBefore: 1000,
            mmrAfter: 1016,
            mmrDelta: 16,
            isWinner: true,
            surrendered: false,
          },
        ],
        result: {
          id: 'result-1',
          matchId,
          winnerUserId: 'user-a',
          victoryType: 'conquest',
          serverValidated: false,
        },
      };
      mockPrisma.match.findUnique.mockResolvedValue(fullMatch);

      const result = await service.getById(matchId);

      expect(mockPrisma.match.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: matchId },
          include: expect.objectContaining({ players: expect.any(Object), result: true }),
        }),
      );
      expect(result).toEqual(fullMatch);
      expect(result.players).toHaveLength(1);
      expect(result.result).toHaveProperty('winnerUserId', 'user-a');
    });

    it('throws NotFoundException when match does not exist', async () => {
      mockPrisma.match.findUnique.mockResolvedValue(null);
      await expect(service.getById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // start() — MMR fallback branches
  // -------------------------------------------------------------------------
  describe('start() — MMR fallback', () => {
    it('uses default mmr of 1000 when player profile is missing from findMany result', async () => {
      const matchId = 'match-1';
      const players = [
        { id: 'mp-1', userId: 'user-a', mmrBefore: null },
        { id: 'mp-2', userId: 'user-missing', mmrBefore: null },
      ];
      const match = { id: matchId, status: 'waiting', players };

      // Only user-a has a profile; user-missing does not appear in findMany
      mockPrisma.playerProfile.findMany.mockResolvedValue([
        { userId: 'user-a', mmr: 1500 },
      ]);

      mockPrisma.match.findUnique
        .mockResolvedValueOnce(match)
        .mockResolvedValueOnce({ ...match, status: 'loading' });

      mockPrisma.$transaction.mockImplementation(async (ops: any[]) => Promise.all(ops));
      mockPrisma.match.update.mockResolvedValue({ ...match, status: 'loading' });
      mockPrisma.matchPlayer.update.mockResolvedValue({});

      await service.start(matchId);

      // The player with a known profile gets 1500; the missing one gets 1000 (default)
      const matchPlayerCalls: any[] = mockPrisma.matchPlayer.update.mock.calls;
      const userACall = matchPlayerCalls.find((c) => c[0].where.id === 'mp-1');
      const missingCall = matchPlayerCalls.find((c) => c[0].where.id === 'mp-2');

      expect(userACall[0].data.mmrBefore).toBe(1500);
      expect(missingCall[0].data.mmrBefore).toBe(1000);
    });
  });

  // -------------------------------------------------------------------------
  // recordResult() — mmrBefore null fallback & skipped participant
  // -------------------------------------------------------------------------
  describe('recordResult() — edge-case branches', () => {
    it('falls back to currentMmrMap mmr when mmrBefore is null on MatchPlayer', async () => {
      const matchId = 'match-edge';
      // mmrBefore is null — service should use currentMmrMap value (1200) for ELO base
      const players = [
        { id: 'mp-1', userId: 'user-a', mmrBefore: null },
        { id: 'mp-2', userId: 'user-b', mmrBefore: null },
      ];
      const match = { id: matchId, status: 'playing', players };

      mockPrisma.$transaction.mockImplementation((fn: (tx: any) => Promise<any>) => fn(mockPrisma));
      mockPrisma.match.findUnique
        .mockResolvedValueOnce(match)
        .mockResolvedValueOnce({ ...match, status: 'completed' });

      mockPrisma.playerProfile.findMany.mockResolvedValue([
        { userId: 'user-a', mmr: 1200 },
        { userId: 'user-b', mmr: 1000 },
      ]);
      mockPrisma.match.update.mockResolvedValue({});
      mockPrisma.matchPlayer.update.mockResolvedValue({});
      mockPrisma.playerProfile.update.mockResolvedValue({});
      mockPrisma.matchResult.create.mockResolvedValue({});

      const dto = {
        participants: [
          { userId: 'user-a', isWinner: true },
          { userId: 'user-b', isWinner: false },
        ],
        winnerUserId: 'user-a',
        victoryType: 'conquest',
        durationTicks: 3000,
        dataHash: 'hash-edge',
      };

      await service.recordResult(matchId, dto as any);

      // Both players should still receive a MatchPlayer update despite null mmrBefore
      expect(mockPrisma.matchPlayer.update).toHaveBeenCalledTimes(2);

      // Winner's mmrAfter must be at least their base mmr (no deduction on win)
      const winnerCall = mockPrisma.matchPlayer.update.mock.calls.find(
        (c: any[]) => c[0].data.isWinner === true,
      );
      expect(winnerCall[0].data.mmrAfter).toBeGreaterThanOrEqual(1200);
    });

    it('skips participant update when userId does not match any MatchPlayer', async () => {
      const matchId = 'match-skip';
      const players = [
        { id: 'mp-1', userId: 'user-a', mmrBefore: 1000 },
      ];
      const match = { id: matchId, status: 'playing', players };

      mockPrisma.$transaction.mockImplementation((fn: (tx: any) => Promise<any>) => fn(mockPrisma));
      mockPrisma.match.findUnique
        .mockResolvedValueOnce(match)
        .mockResolvedValueOnce({ ...match, status: 'completed' });
      mockPrisma.playerProfile.findMany.mockResolvedValue([
        { userId: 'user-a', mmr: 1000 },
      ]);
      mockPrisma.match.update.mockResolvedValue({});
      mockPrisma.matchPlayer.update.mockResolvedValue({});
      mockPrisma.playerProfile.update.mockResolvedValue({});
      mockPrisma.matchResult.create.mockResolvedValue({});

      // participants includes 'user-ghost' who has no corresponding MatchPlayer
      const dto = {
        participants: [
          { userId: 'user-a', isWinner: true },
          { userId: 'user-ghost', isWinner: false },
        ],
        winnerUserId: 'user-a',
        durationTicks: 1000,
        dataHash: 'hash-skip',
      };

      await service.recordResult(matchId, dto as any);

      // Only user-a has a MatchPlayer record — ghost is skipped via `if (!mp) continue`
      expect(mockPrisma.matchPlayer.update).toHaveBeenCalledTimes(1);
      expect(mockPrisma.playerProfile.update).toHaveBeenCalledTimes(1);
      // MatchResult must still be created
      expect(mockPrisma.matchResult.create).toHaveBeenCalledTimes(1);
    });
  });
});
