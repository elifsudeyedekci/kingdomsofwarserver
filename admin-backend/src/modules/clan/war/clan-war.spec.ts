/**
 * ClanWarService unit tests
 *
 * Story Type  : Logic (service methods, state transitions, scoring)
 * Gate Level  : BLOCKING — must pass before merge
 *
 * Implements: Clan War System design spec — test coverage
 */

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ClanWarService } from './clan-war.service';
import { PrismaService } from '../../../database/prisma.service';

// ─── Tx mock builder ──────────────────────────────────────────────────────────

function makeTxMock() {
  return {
    clanWarParticipant: {
      createMany: jest.fn(),
    },
    clanWar: {
      update: jest.fn(),
    },
    clanWarAttack: {
      create: jest.fn(),
    },
    playerWallet: {
      upsert: jest.fn(),
    },
  };
}

let tx = makeTxMock();

// ─── Top-level Prisma mock ────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma: any = {
  clan: {
    findUnique: jest.fn(),
  },
  clanWar: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  clanWarParticipant: {
    createMany: jest.fn(),
  },
  clanWarAttack: {
    count: jest.fn(),
    create: jest.fn(),
  },
  playerProfile: {
    findMany: jest.fn(),
  },
  playerWallet: {
    upsert: jest.fn(),
  },
  $transaction: jest.fn(),
};

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ATTACKING_CLAN_ID = 'clan-atk-001';
const DEFENDING_CLAN_ID = 'clan-def-002';
const WAR_ID = 'war-001';

const fakeAttackingClan = {
  id: ATTACKING_CLAN_ID,
  name: 'Iron Legion',
  tag: 'IRL',
  leaderId: 'leader-atk',
};

const fakeDefendingClan = {
  id: DEFENDING_CLAN_ID,
  name: 'Stone Guard',
  tag: 'STG',
  leaderId: 'leader-def',
};

const fakeWar = {
  id: WAR_ID,
  clanId: ATTACKING_CLAN_ID,
  opponentId: DEFENDING_CLAN_ID,
  status: 'scheduled',
  clanScore: 0,
  opponentScore: 0,
  scheduledAt: new Date('2026-07-01T12:00:00Z'),
  startedAt: null,
  endedAt: null,
  winnerId: null,
};

const fakeActiveWar = { ...fakeWar, status: 'active', startedAt: new Date() };

// Participants: 2 attackers, 2 defenders
const fakeParticipants = [
  { userId: 'atk-user-1', clanId: ATTACKING_CLAN_ID },
  { userId: 'atk-user-2', clanId: ATTACKING_CLAN_ID },
  { userId: 'def-user-1', clanId: DEFENDING_CLAN_ID },
  { userId: 'def-user-2', clanId: DEFENDING_CLAN_ID },
];

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('ClanWarService', () => {
  let service: ClanWarService;

  beforeEach(async () => {
    jest.resetAllMocks();
    tx = makeTxMock();

    // Default: $transaction executes the callback with the tx mock
    mockPrisma.$transaction.mockImplementation(
      (cb: (t: typeof tx) => Promise<unknown>) => cb(tx),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClanWarService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ClanWarService>(ClanWarService);
  });

  // ─── declareWar ─────────────────────────────────────────────────────────────

  describe('declareWar()', () => {
    const scheduledAt = new Date('2026-07-01T12:00:00Z');

    beforeEach(() => {
      mockPrisma.clan.findUnique.mockImplementation(
        ({ where }: { where: { id: string } }) => {
          if (where.id === ATTACKING_CLAN_ID) return Promise.resolve(fakeAttackingClan);
          if (where.id === DEFENDING_CLAN_ID) return Promise.resolve(fakeDefendingClan);
          return Promise.resolve(null);
        },
      );
      mockPrisma.clanWar.findFirst.mockResolvedValue(null);
      mockPrisma.clanWar.create.mockResolvedValue(fakeWar);
    });

    it('creates a war record with status "scheduled"', async () => {
      await service.declareWar(ATTACKING_CLAN_ID, DEFENDING_CLAN_ID, scheduledAt);

      expect(mockPrisma.clanWar.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            clanId: ATTACKING_CLAN_ID,
            opponentId: DEFENDING_CLAN_ID,
            status: 'scheduled',
          }),
        }),
      );
    });

    it('returns a ClanWarDTO with correct attackingClanId and defendingClanId mapping', async () => {
      const result = await service.declareWar(
        ATTACKING_CLAN_ID,
        DEFENDING_CLAN_ID,
        scheduledAt,
      );

      expect(result.attackingClanId).toBe(ATTACKING_CLAN_ID);
      expect(result.defendingClanId).toBe(DEFENDING_CLAN_ID);
      expect(result.status).toBe('scheduled');
    });

    it('throws BadRequestException when a clan declares war on itself', async () => {
      await expect(
        service.declareWar(ATTACKING_CLAN_ID, ATTACKING_CLAN_ID, scheduledAt),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when attacking clan does not exist', async () => {
      mockPrisma.clan.findUnique.mockResolvedValue(null);

      await expect(
        service.declareWar('no-clan', DEFENDING_CLAN_ID, scheduledAt),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when an active war already exists between the clans', async () => {
      mockPrisma.clanWar.findFirst.mockResolvedValue({
        id: 'war-existing',
        status: 'active',
      });

      await expect(
        service.declareWar(ATTACKING_CLAN_ID, DEFENDING_CLAN_ID, scheduledAt),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when a scheduled war already exists (reverse order)', async () => {
      mockPrisma.clanWar.findFirst.mockResolvedValue({
        id: 'war-reverse',
        status: 'scheduled',
      });

      await expect(
        service.declareWar(ATTACKING_CLAN_ID, DEFENDING_CLAN_ID, scheduledAt),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─── recordWarAttack ────────────────────────────────────────────────────────

  describe('recordWarAttack()', () => {
    const attackingUser = 'atk-user-1';
    const defendingUser = 'def-user-1';

    const warWithParticipants = {
      ...fakeActiveWar,
      participants: fakeParticipants,
    };

    beforeEach(() => {
      mockPrisma.clanWar.findUnique.mockResolvedValue(warWithParticipants);
      mockPrisma.clanWarAttack.count.mockResolvedValue(0);

      const fakeAttack = {
        id: 'atk-001',
        warId: WAR_ID,
        attackerId: attackingUser,
        defenderId: defendingUser,
        stars: 2,
        destruction: 75,
        createdAt: new Date(),
      };
      tx.clanWarAttack.create.mockResolvedValue(fakeAttack);
      tx.clanWar.update.mockResolvedValue(fakeActiveWar);
    });

    it('throws BadRequestException when stars is less than 0', async () => {
      await expect(
        service.recordWarAttack(WAR_ID, attackingUser, defendingUser, -1, 50),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when stars is greater than 3', async () => {
      await expect(
        service.recordWarAttack(WAR_ID, attackingUser, defendingUser, 4, 50),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts stars = 0 (valid boundary)', async () => {
      await expect(
        service.recordWarAttack(WAR_ID, attackingUser, defendingUser, 0, 50),
      ).resolves.not.toThrow();
    });

    it('accepts stars = 3 (valid boundary)', async () => {
      await expect(
        service.recordWarAttack(WAR_ID, attackingUser, defendingUser, 3, 100),
      ).resolves.not.toThrow();
    });

    it('throws BadRequestException when destruction is less than 0', async () => {
      await expect(
        service.recordWarAttack(WAR_ID, attackingUser, defendingUser, 2, -1),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when destruction exceeds 100', async () => {
      await expect(
        service.recordWarAttack(WAR_ID, attackingUser, defendingUser, 2, 101),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when attacker is not a participant', async () => {
      await expect(
        service.recordWarAttack(WAR_ID, 'ghost-attacker', defendingUser, 2, 50),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when defender is not a participant', async () => {
      await expect(
        service.recordWarAttack(WAR_ID, attackingUser, 'ghost-defender', 2, 50),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when attacker has reached the 2-attack limit', async () => {
      mockPrisma.clanWarAttack.count.mockResolvedValue(2);

      await expect(
        service.recordWarAttack(WAR_ID, attackingUser, defendingUser, 2, 50),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when war does not exist', async () => {
      mockPrisma.clanWar.findUnique.mockResolvedValue(null);

      await expect(
        service.recordWarAttack(WAR_ID, attackingUser, defendingUser, 2, 50),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns a WarAttackDTO with correct fields on success', async () => {
      const result = await service.recordWarAttack(
        WAR_ID,
        attackingUser,
        defendingUser,
        2,
        75,
      );

      expect(result).toMatchObject({
        warId: WAR_ID,
        attackerId: attackingUser,
        defenderId: defendingUser,
        stars: 2,
        destruction: 75,
      });
    });

    it('increments clanScore when the attacking clan scores', async () => {
      await service.recordWarAttack(WAR_ID, attackingUser, defendingUser, 3, 100);

      expect(tx.clanWar.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ clanScore: { increment: 3 } }),
        }),
      );
    });

    it('increments opponentScore when the defending clan scores', async () => {
      await service.recordWarAttack(WAR_ID, 'def-user-1', 'atk-user-1', 2, 60);

      expect(tx.clanWar.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ opponentScore: { increment: 2 } }),
        }),
      );
    });
  });

  // ─── endWar ─────────────────────────────────────────────────────────────────

  describe('endWar()', () => {
    function buildWarWithAttacks(
      attackingAttacks: Array<{ attackerId: string; defenderId: string; stars: number; destruction: number }>,
      defendingAttacks: Array<{ attackerId: string; defenderId: string; stars: number; destruction: number }>,
    ) {
      return {
        ...fakeActiveWar,
        participants: fakeParticipants,
        attacks: [...attackingAttacks, ...defendingAttacks],
      };
    }

    const endedWarRecord = {
      ...fakeActiveWar,
      status: 'ended',
      endedAt: new Date(),
    };

    beforeEach(() => {
      tx.clanWar.update.mockResolvedValue(endedWarRecord);
      tx.playerWallet.upsert.mockResolvedValue({});
      mockPrisma.clan.findUnique.mockResolvedValue(fakeAttackingClan);
    });

    it('sets winner to "attacking" when attacking clan has higher score', async () => {
      // Attacking: atk-user-1 → def-user-1: 3 stars (best), def-user-2: 2 stars → total 5
      // Defending: def-user-1 → atk-user-1: 1 star → total 1
      mockPrisma.clanWar.findUnique.mockResolvedValue(
        buildWarWithAttacks(
          [
            { attackerId: 'atk-user-1', defenderId: 'def-user-1', stars: 3, destruction: 100 },
            { attackerId: 'atk-user-1', defenderId: 'def-user-2', stars: 2, destruction: 80 },
          ],
          [
            { attackerId: 'def-user-1', defenderId: 'atk-user-1', stars: 1, destruction: 30 },
          ],
        ),
      );

      const result = await service.endWar(WAR_ID);

      expect(result.winner).toBe('attacking');
    });

    it('sets winner to "defending" when defending clan has higher score', async () => {
      // Attacking: 1 star total, Defending: 5 stars total
      mockPrisma.clanWar.findUnique.mockResolvedValue(
        buildWarWithAttacks(
          [
            { attackerId: 'atk-user-1', defenderId: 'def-user-1', stars: 1, destruction: 20 },
          ],
          [
            { attackerId: 'def-user-1', defenderId: 'atk-user-1', stars: 3, destruction: 100 },
            { attackerId: 'def-user-1', defenderId: 'atk-user-2', stars: 2, destruction: 90 },
          ],
        ),
      );

      const result = await service.endWar(WAR_ID);

      expect(result.winner).toBe('defending');
    });

    it('returns "draw" when both clans have equal scores and equal destruction', async () => {
      // Both get 3 stars on one defender each, both with 100% destruction
      mockPrisma.clanWar.findUnique.mockResolvedValue(
        buildWarWithAttacks(
          [
            { attackerId: 'atk-user-1', defenderId: 'def-user-1', stars: 3, destruction: 100 },
          ],
          [
            { attackerId: 'def-user-1', defenderId: 'atk-user-1', stars: 3, destruction: 100 },
          ],
        ),
      );

      const result = await service.endWar(WAR_ID);

      expect(result.winner).toBe('draw');
    });

    it('uses destruction as a tie-breaker when star scores are equal', async () => {
      // Both get 3 stars, but attacking has higher destruction
      mockPrisma.clanWar.findUnique.mockResolvedValue(
        buildWarWithAttacks(
          [
            { attackerId: 'atk-user-1', defenderId: 'def-user-1', stars: 3, destruction: 95 },
          ],
          [
            { attackerId: 'def-user-1', defenderId: 'atk-user-1', stars: 3, destruction: 80 },
          ],
        ),
      );

      const result = await service.endWar(WAR_ID);

      expect(result.winner).toBe('attacking');
    });

    it('only counts the best attack per defender (not cumulative stars per target)', async () => {
      // atk-user-1 attacks def-user-1 twice: 1 star then 2 stars
      // Best is 2 stars — should count 2, not 3
      mockPrisma.clanWar.findUnique.mockResolvedValue(
        buildWarWithAttacks(
          [
            { attackerId: 'atk-user-1', defenderId: 'def-user-1', stars: 1, destruction: 30 },
            { attackerId: 'atk-user-1', defenderId: 'def-user-1', stars: 2, destruction: 60 },
          ],
          [],
        ),
      );

      const result = await service.endWar(WAR_ID);

      // Attacking score = 2 (best attack on def-user-1), defending score = 0
      expect(result.winner).toBe('attacking');
      // clanScore passed to update should be 2
      expect(tx.clanWar.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ clanScore: 2, opponentScore: 0 }),
        }),
      );
    });

    it('awards war coins to winning clan members', async () => {
      mockPrisma.clanWar.findUnique.mockResolvedValue(
        buildWarWithAttacks(
          [
            { attackerId: 'atk-user-1', defenderId: 'def-user-1', stars: 3, destruction: 100 },
          ],
          [],
        ),
      );

      await service.endWar(WAR_ID);

      // atk-user-1 and atk-user-2 are in the winning attacking clan
      expect(tx.playerWallet.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'atk-user-1' },
          update: { coins: { increment: 50 } },
        }),
      );
      expect(tx.playerWallet.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'atk-user-2' },
          update: { coins: { increment: 50 } },
        }),
      );
    });

    it('does not award coins to any player when result is a draw', async () => {
      mockPrisma.clanWar.findUnique.mockResolvedValue(
        buildWarWithAttacks(
          [
            { attackerId: 'atk-user-1', defenderId: 'def-user-1', stars: 3, destruction: 100 },
          ],
          [
            { attackerId: 'def-user-1', defenderId: 'atk-user-1', stars: 3, destruction: 100 },
          ],
        ),
      );

      await service.endWar(WAR_ID);

      expect(tx.playerWallet.upsert).not.toHaveBeenCalled();
    });

    it('sets status to "ended" and records endedAt', async () => {
      mockPrisma.clanWar.findUnique.mockResolvedValue(
        buildWarWithAttacks([], []),
      );

      await service.endWar(WAR_ID);

      expect(tx.clanWar.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'ended', endedAt: expect.any(Date) }),
        }),
      );
    });

    it('throws NotFoundException when war does not exist', async () => {
      mockPrisma.clanWar.findUnique.mockResolvedValue(null);

      await expect(service.endWar(WAR_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when war is not in "active" status', async () => {
      mockPrisma.clanWar.findUnique.mockResolvedValue({
        ...fakeWar,
        participants: [],
        attacks: [],
      });

      await expect(service.endWar(WAR_ID)).rejects.toThrow(BadRequestException);
    });

    it('returns warCoinsAwarded = 0 when result is a draw', async () => {
      mockPrisma.clanWar.findUnique.mockResolvedValue(
        buildWarWithAttacks(
          [{ attackerId: 'atk-user-1', defenderId: 'def-user-1', stars: 2, destruction: 50 }],
          [{ attackerId: 'def-user-1', defenderId: 'atk-user-1', stars: 2, destruction: 50 }],
        ),
      );

      const result = await service.endWar(WAR_ID);

      expect(result.warCoinsAwarded).toBe(0);
    });
  });

  // ─── recordWarAttack + endWar — draw-path scenarios ─────────────────────────

  describe('recordWarAttack_WhenBothClansReachMaxAttacks_Draw', () => {
    const attackingUser = 'atk-user-1';
    const defendingUser = 'def-user-1';

    const warWithParticipants = {
      ...fakeActiveWar,
      participants: fakeParticipants,
    };

    beforeEach(() => {
      mockPrisma.clanWar.findUnique.mockResolvedValue(warWithParticipants);
      // One attack already recorded for this attacker (max is 2, so one slot left)
      mockPrisma.clanWarAttack.count.mockResolvedValue(1);

      const fakeAttack = {
        id: 'atk-draw-001',
        warId: WAR_ID,
        attackerId: attackingUser,
        defenderId: defendingUser,
        stars: 2,
        destruction: 50,
        createdAt: new Date(),
      };
      tx.clanWarAttack.create.mockResolvedValue(fakeAttack);
      tx.clanWar.update.mockResolvedValue(fakeActiveWar);
    });

    it('succeeds when attacker uses their final allowed attack (attack count = max - 1)', async () => {
      // Arrange — count is 1, max is 2, so this is the second (final) allowed attack
      await expect(
        service.recordWarAttack(WAR_ID, attackingUser, defendingUser, 2, 50),
      ).resolves.not.toThrow();
    });

    it('rejects the attack when attacker has already used all allowed attacks (count = max)', async () => {
      // Arrange — count is already at the limit
      mockPrisma.clanWarAttack.count.mockResolvedValue(2);

      await expect(
        service.recordWarAttack(WAR_ID, attackingUser, defendingUser, 1, 30),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('endWar() — draw when both clans exhaust attacks with identical scores and destruction', () => {
    function buildFullDrawWar() {
      // Both sides attack each other's 2 members with same stars and destruction
      // Attacking: atk-user-1 → def-user-1 (2 stars, 60%); atk-user-2 → def-user-2 (2 stars, 60%)
      // Defending: def-user-1 → atk-user-1 (2 stars, 60%); def-user-2 → atk-user-2 (2 stars, 60%)
      // Best-per-defender: attacking score = 4 stars, 120% destruction
      //                    defending score = 4 stars, 120% destruction → draw
      return {
        ...fakeActiveWar,
        participants: fakeParticipants,
        attacks: [
          { attackerId: 'atk-user-1', defenderId: 'def-user-1', stars: 2, destruction: 60 },
          { attackerId: 'atk-user-2', defenderId: 'def-user-2', stars: 2, destruction: 60 },
          { attackerId: 'def-user-1', defenderId: 'atk-user-1', stars: 2, destruction: 60 },
          { attackerId: 'def-user-2', defenderId: 'atk-user-2', stars: 2, destruction: 60 },
        ],
      };
    }

    beforeEach(() => {
      tx.clanWar.update.mockResolvedValue({
        ...fakeActiveWar,
        status: 'ended',
        endedAt: new Date(),
        clanScore: 4,
        opponentScore: 4,
        winnerId: null,
      });
      tx.playerWallet.upsert.mockResolvedValue({});
      mockPrisma.clan.findUnique.mockResolvedValue(fakeAttackingClan);
    });

    it('recordAttack_WhenBothClansReachMaxAttacks_Draw — winner is "draw" when all attacks are exhausted with equal scores and destruction', async () => {
      // Arrange
      mockPrisma.clanWar.findUnique.mockResolvedValue(buildFullDrawWar());

      // Act
      const result = await service.endWar(WAR_ID);

      // Assert
      expect(result.winner).toBe('draw');
      expect(result.warCoinsAwarded).toBe(0);
    });

    it('sets winnerId to null in the DB update when result is a draw', async () => {
      // Arrange
      mockPrisma.clanWar.findUnique.mockResolvedValue(buildFullDrawWar());

      // Act
      await service.endWar(WAR_ID);

      // Assert — DB record is written with winnerId: null
      expect(tx.clanWar.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ winnerId: null, status: 'ended' }),
        }),
      );
    });

    it('does not award coins to any player when both clans are fully exhausted in a draw', async () => {
      // Arrange
      mockPrisma.clanWar.findUnique.mockResolvedValue(buildFullDrawWar());

      // Act
      await service.endWar(WAR_ID);

      // Assert — no wallet upserts
      expect(tx.playerWallet.upsert).not.toHaveBeenCalled();
    });
  });
});
