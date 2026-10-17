/**
 * Story Type  : Logic (state mutation + DB reads/writes)
 * Output Dir  : tests/unit/anticheat/  (mirrored here as NestJS convention)
 * Gate Level  : BLOCKING — must pass before merging anticheat feature branch
 *
 * Prisma model map (schema.prisma):
 *   AntiCheatFlag  → prisma.antiCheatFlag   (@@map "anti_cheat_flags")
 *   Ban            → prisma.ban              (@@map "bans")
 *
 * NOTE: Tests marked [TDD CONTRACT] document behaviour the service SHOULD
 * implement but does not yet. They will intentionally fail until the service
 * adds the corresponding guard. Do NOT skip or comment out these tests to make
 * the suite green prematurely — that defeats the purpose of TDD contracts.
 */

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BanType } from '@prisma/client';
import { AnticheatService } from './anticheat.service';
import { PrismaService } from '../../database/prisma.service';
import { FlagPlayerDto, FlagSeverity } from './dto/flag-player.dto';
import { ReviewFlagDto, ReviewDecision } from './dto/review-flag.dto';
import { BanPlayerDto } from './dto/ban-player.dto';
import { MatchDataDto } from './dto/auto-flag-check.dto';

// ---------------------------------------------------------------------------
// Shared fixture factories
// ---------------------------------------------------------------------------

function makeUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'player-uuid-1',
    email: 'player@example.com',
    isActive: true,
    ...overrides,
  };
}

function makeFlag(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'flag-uuid-1',
    userId: 'player-uuid-1',
    matchId: 'match-uuid-1',
    flagType: 'speed_hack_detected',
    severity: FlagSeverity.medium,
    data: { tickDelta: 42 },
    reviewed: false,
    reviewedBy: null,
    reviewNote: null,
    createdAt: new Date('2026-06-13T10:00:00Z'),
    ...overrides,
  };
}

function makeBan(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'ban-uuid-1',
    userId: 'player-uuid-1',
    type: BanType.temporary,
    reason: 'Confirmed speed hack',
    evidence: null,
    bannedBy: 'admin-uuid-1',
    matchId: 'match-uuid-1',
    startsAt: new Date('2026-06-13T10:00:00Z'),
    endsAt: new Date('2026-06-20T10:00:00Z'),
    isActive: true,
    liftedBy: null,
    liftedAt: null,
    liftNote: null,
    createdAt: new Date('2026-06-13T10:00:00Z'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Prisma mock
// NOTE: accessor key must match the Prisma client property the service uses.
// The service calls this.prisma.antiCheatFlag (PascalCase middle) — NOT
// anticheatFlag. The mock key here must be identical or calls will not be
// intercepted.
// ---------------------------------------------------------------------------

const mockPrisma: any = {
  antiCheatFlag: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  ban: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  // $transaction receives an array of PrismaPromise — mock returns their resolved values
  $transaction: jest.fn(),
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('AnticheatService', () => {
  let service: AnticheatService;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnticheatService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AnticheatService>(AnticheatService);
  });

  // -------------------------------------------------------------------------
  // getFlags()
  // -------------------------------------------------------------------------

  describe('getFlags()', () => {
    it('returns paginated flags with total and page metadata', async () => {
      // Arrange
      const flags = [makeFlag(), makeFlag({ id: 'flag-uuid-2' })];
      mockPrisma.antiCheatFlag.findMany.mockResolvedValue(flags);
      mockPrisma.antiCheatFlag.count.mockResolvedValue(2);

      // Act
      const result = await service.getFlags(1, 20);

      // Assert
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('applies the pending status filter (reviewed=false)', async () => {
      // Arrange
      mockPrisma.antiCheatFlag.findMany.mockResolvedValue([]);
      mockPrisma.antiCheatFlag.count.mockResolvedValue(0);

      // Act
      await service.getFlags(1, 20, 'pending');

      // Assert
      const callArg = mockPrisma.antiCheatFlag.findMany.mock.calls[0][0];
      expect(callArg.where).toMatchObject({ reviewed: false });
    });

    it('applies the reviewed status filter (reviewed=true)', async () => {
      // Arrange
      mockPrisma.antiCheatFlag.findMany.mockResolvedValue([]);
      mockPrisma.antiCheatFlag.count.mockResolvedValue(0);

      // Act
      await service.getFlags(1, 20, 'reviewed');

      // Assert
      const callArg = mockPrisma.antiCheatFlag.findMany.mock.calls[0][0];
      expect(callArg.where).toMatchObject({ reviewed: true });
    });

    it('applies a severity filter when provided', async () => {
      // Arrange
      mockPrisma.antiCheatFlag.findMany.mockResolvedValue([]);
      mockPrisma.antiCheatFlag.count.mockResolvedValue(0);

      // Act
      await service.getFlags(1, 20, undefined, 'high');

      // Assert
      const callArg = mockPrisma.antiCheatFlag.findMany.mock.calls[0][0];
      expect(callArg.where).toMatchObject({ severity: 'high' });
    });

    it('calculates the correct skip offset for page 2', async () => {
      // Arrange
      mockPrisma.antiCheatFlag.findMany.mockResolvedValue([]);
      mockPrisma.antiCheatFlag.count.mockResolvedValue(25);

      // Act
      await service.getFlags(2, 10);

      // Assert
      const callArg = mockPrisma.antiCheatFlag.findMany.mock.calls[0][0];
      expect(callArg.skip).toBe(10);
      expect(callArg.take).toBe(10);
    });

    it('returns totalPages=0 when no flags exist', async () => {
      // Arrange
      mockPrisma.antiCheatFlag.findMany.mockResolvedValue([]);
      mockPrisma.antiCheatFlag.count.mockResolvedValue(0);

      // Act
      const result = await service.getFlags();

      // Assert
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // getFlagById()
  // -------------------------------------------------------------------------

  describe('getFlagById()', () => {
    it('returns the flag when it exists', async () => {
      // Arrange
      const flag = makeFlag();
      mockPrisma.antiCheatFlag.findUnique.mockResolvedValue(flag);

      // Act
      const result = await service.getFlagById('flag-uuid-1');

      // Assert
      expect(mockPrisma.antiCheatFlag.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'flag-uuid-1' } }),
      );
      expect(result).toEqual(flag);
    });

    it('throws NotFoundException when the flag does not exist', async () => {
      // Arrange
      mockPrisma.antiCheatFlag.findUnique.mockResolvedValue(null);

      // Act / Assert
      await expect(service.getFlagById('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException with a message containing the missing id', async () => {
      // Arrange
      mockPrisma.antiCheatFlag.findUnique.mockResolvedValue(null);

      // Act / Assert
      await expect(service.getFlagById('missing-uuid')).rejects.toThrow(
        /missing-uuid/,
      );
    });
  });

  // -------------------------------------------------------------------------
  // flagPlayer()
  // -------------------------------------------------------------------------

  describe('flagPlayer()', () => {
    const dto: FlagPlayerDto = {
      userId: 'player-uuid-1',
      reason: 'speed_hack_detected',
      severity: FlagSeverity.medium,
      matchId: 'match-uuid-1',
      evidence: { tickDelta: 42, recordedAt: '2026-06-13T10:00:00Z' },
    };

    beforeEach(() => {
      mockPrisma.user.findUnique.mockResolvedValue(makeUser());
    });

    it('creates and returns an AntiCheatFlag record', async () => {
      // Arrange
      const created = makeFlag();
      mockPrisma.antiCheatFlag.create.mockResolvedValue(created);

      // Act
      const result = await service.flagPlayer(dto);

      // Assert
      expect(mockPrisma.antiCheatFlag.create).toHaveBeenCalledTimes(1);
      expect(result).toEqual(created);
    });

    it('passes userId, reason/flagType, severity, matchId, and evidence to prisma', async () => {
      // Arrange
      const created = makeFlag();
      mockPrisma.antiCheatFlag.create.mockResolvedValue(created);

      // Act
      await service.flagPlayer(dto);

      // Assert
      const callArg = mockPrisma.antiCheatFlag.create.mock.calls[0][0];
      expect(callArg.data).toMatchObject({
        userId: dto.userId,
        severity: dto.severity,
      });
    });

    it('creates a flag with no matchId or evidence when optional fields are omitted', async () => {
      // Arrange
      const minimalDto: FlagPlayerDto = {
        userId: 'player-uuid-2',
        reason: 'wall_hack',
        severity: FlagSeverity.low,
      };
      mockPrisma.user.findUnique.mockResolvedValue(makeUser({ id: 'player-uuid-2' }));
      const created = makeFlag({ userId: 'player-uuid-2', matchId: null, data: null });
      mockPrisma.antiCheatFlag.create.mockResolvedValue(created);

      // Act
      const result = await service.flagPlayer(minimalDto);

      // Assert
      expect(result.userId).toBe('player-uuid-2');
      expect(mockPrisma.antiCheatFlag.create).toHaveBeenCalledTimes(1);
    });

    it('stores an empty object in data when evidence is null/undefined', async () => {
      // Arrange — service coalesces null evidence to {} before storing
      const noEvidenceDto: FlagPlayerDto = {
        userId: 'player-uuid-1',
        reason: 'suspicious_apm',
        severity: FlagSeverity.low,
        evidence: undefined,
      };
      const created = makeFlag({ data: {} });
      mockPrisma.antiCheatFlag.create.mockResolvedValue(created);

      // Act
      const result = await service.flagPlayer(noEvidenceDto);

      // Assert — create is called and the service does not throw
      expect(mockPrisma.antiCheatFlag.create).toHaveBeenCalledTimes(1);
      const callArg = mockPrisma.antiCheatFlag.create.mock.calls[0][0];
      // evidence ?? {} means the data field should be an object (not null)
      expect(callArg.data.data).toBeDefined();
      expect(result).toEqual(created);
    });

    it('throws NotFoundException when the player does not exist', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(null);

      // Act / Assert
      await expect(service.flagPlayer(dto)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.antiCheatFlag.create).not.toHaveBeenCalled();
    });

    it('does not suppress a prisma error — propagates on DB failure', async () => {
      // Arrange
      mockPrisma.antiCheatFlag.create.mockRejectedValue(new Error('DB down'));

      // Act / Assert
      await expect(service.flagPlayer(dto)).rejects.toThrow('DB down');
    });
  });

  // -------------------------------------------------------------------------
  // reviewFlag()
  // -------------------------------------------------------------------------

  describe('reviewFlag()', () => {
    const flagId = 'flag-uuid-1';

    const reviewedDto: ReviewFlagDto = {
      decision: ReviewDecision.reviewed,
      reviewNote: 'Confirmed via replay',
      reviewedBy: 'admin-uuid-1',
    };

    const dismissedDto: ReviewFlagDto = {
      decision: ReviewDecision.dismissed,
      reviewNote: 'False positive — lag spike',
      reviewedBy: 'admin-uuid-1',
    };

    it('updates and returns the flag when it exists (decision: reviewed)', async () => {
      // Arrange
      const existing = makeFlag();
      const updated = makeFlag({
        reviewed: true,
        reviewedBy: 'admin-uuid-1',
        reviewNote: '[REVIEWED] Confirmed via replay',
      });
      mockPrisma.antiCheatFlag.findUnique.mockResolvedValue(existing);
      mockPrisma.antiCheatFlag.update.mockResolvedValue(updated);

      // Act
      const result = await service.reviewFlag(flagId, reviewedDto);

      // Assert
      expect(mockPrisma.antiCheatFlag.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: flagId } }),
      );
      expect(mockPrisma.antiCheatFlag.update).toHaveBeenCalledTimes(1);
      expect(result.reviewed).toBe(true);
    });

    it('updates the flag when decision is dismissed', async () => {
      // Arrange
      const existing = makeFlag();
      const updated = makeFlag({
        reviewed: true,
        reviewedBy: 'admin-uuid-1',
        reviewNote: '[DISMISSED] False positive — lag spike',
      });
      mockPrisma.antiCheatFlag.findUnique.mockResolvedValue(existing);
      mockPrisma.antiCheatFlag.update.mockResolvedValue(updated);

      // Act
      const result = await service.reviewFlag(flagId, dismissedDto);

      // Assert
      expect(result.reviewNote).toBe('[DISMISSED] False positive — lag spike');
    });

    it('prefixes the reviewNote with [REVIEWED] for reviewed decisions', async () => {
      // Arrange
      const existing = makeFlag();
      mockPrisma.antiCheatFlag.findUnique.mockResolvedValue(existing);
      mockPrisma.antiCheatFlag.update.mockResolvedValue(makeFlag({ reviewed: true }));

      // Act
      await service.reviewFlag(flagId, reviewedDto);

      // Assert — verify the prefix is applied in the update call
      const updateArg = mockPrisma.antiCheatFlag.update.mock.calls[0][0];
      expect(updateArg.data.reviewNote).toMatch(/^\[REVIEWED\]/);
    });

    it('prefixes the reviewNote with [DISMISSED] for dismissed decisions', async () => {
      // Arrange
      const existing = makeFlag();
      mockPrisma.antiCheatFlag.findUnique.mockResolvedValue(existing);
      mockPrisma.antiCheatFlag.update.mockResolvedValue(makeFlag({ reviewed: true }));

      // Act
      await service.reviewFlag(flagId, dismissedDto);

      // Assert
      const updateArg = mockPrisma.antiCheatFlag.update.mock.calls[0][0];
      expect(updateArg.data.reviewNote).toMatch(/^\[DISMISSED\]/);
    });

    it('throws NotFoundException when the flag does not exist', async () => {
      // Arrange
      mockPrisma.antiCheatFlag.findUnique.mockResolvedValue(null);

      // Act / Assert
      await expect(
        service.reviewFlag('nonexistent-id', reviewedDto),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.antiCheatFlag.update).not.toHaveBeenCalled();
    });

    it('does not call update when flag lookup returns null', async () => {
      // Arrange
      mockPrisma.antiCheatFlag.findUnique.mockResolvedValue(null);

      // Act
      await service.reviewFlag('ghost-id', reviewedDto).catch(() => null);

      // Assert
      expect(mockPrisma.antiCheatFlag.update).toHaveBeenCalledTimes(0);
    });

    /**
     * [TDD CONTRACT] — reviewing an already-reviewed flag should throw
     * ConflictException to prevent accidental double-review overwriting the
     * original decision. The service does not implement this guard yet.
     * This test will fail until the service adds:
     *   if (existing.reviewed) throw new ConflictException(...)
     */
    it('[TDD CONTRACT] throws ConflictException when the flag is already reviewed', async () => {
      // Arrange — flag already has reviewed=true
      const alreadyReviewed = makeFlag({ reviewed: true, reviewedBy: 'admin-uuid-1' });
      mockPrisma.antiCheatFlag.findUnique.mockResolvedValue(alreadyReviewed);

      // Act / Assert
      await expect(service.reviewFlag(flagId, reviewedDto)).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrisma.antiCheatFlag.update).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // banPlayer()
  // -------------------------------------------------------------------------

  describe('banPlayer()', () => {
    const temporaryBanDto: BanPlayerDto = {
      userId: 'player-uuid-1',
      banType: BanType.temporary,
      durationDays: 7,
      reason: 'Confirmed speed hack',
      bannedBy: 'admin-uuid-1',
      matchId: 'match-uuid-1',
    };

    const permanentBanDto: BanPlayerDto = {
      userId: 'player-uuid-1',
      banType: BanType.permanent,
      reason: 'Severe and repeated cheating',
      bannedBy: 'admin-uuid-1',
    };

    beforeEach(() => {
      mockPrisma.user.findUnique.mockResolvedValue(makeUser());
    });

    it('creates and returns a Ban record for a temporary ban', async () => {
      // Arrange
      const created = makeBan();
      mockPrisma.ban.create.mockResolvedValue(created);

      // Act
      const result = await service.banPlayer(temporaryBanDto);

      // Assert
      expect(mockPrisma.ban.create).toHaveBeenCalledTimes(1);
      expect(result).toEqual(created);
    });

    it('creates a permanent ban with no endsAt date and deactivates the user account', async () => {
      // Arrange — $transaction resolves with [ban, updatedUser]
      const created = makeBan({ type: BanType.permanent, endsAt: null });
      mockPrisma.ban.create.mockReturnValue('ban-promise-stub');
      mockPrisma.user.update.mockReturnValue('user-update-stub');
      mockPrisma.$transaction.mockResolvedValue([created, { id: 'player-uuid-1', isActive: false }]);

      // Act
      const result = await service.banPlayer(permanentBanDto);

      // Assert
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(result.type).toBe(BanType.permanent);
      expect(result.endsAt).toBeNull();
    });

    it('sets endsAt based on durationDays for a temporary ban', async () => {
      // Arrange
      const expectedEndsAt = new Date('2026-06-20T10:00:00Z');
      const created = makeBan({ endsAt: expectedEndsAt });
      mockPrisma.ban.create.mockResolvedValue(created);

      // Act
      const result = await service.banPlayer(temporaryBanDto);

      // Assert
      expect(result.endsAt).toEqual(expectedEndsAt);
    });

    it('creates a ranked_only ban without crashing', async () => {
      // Arrange
      const rankedDto: BanPlayerDto = {
        userId: 'player-uuid-3',
        banType: BanType.ranked_only,
        reason: 'Smurf account confirmed',
        bannedBy: 'admin-uuid-1',
      };
      mockPrisma.user.findUnique.mockResolvedValue(makeUser({ id: 'player-uuid-3' }));
      const created = makeBan({ type: BanType.ranked_only, endsAt: null });
      mockPrisma.ban.create.mockResolvedValue(created);

      // Act
      const result = await service.banPlayer(rankedDto);

      // Assert
      expect(result.type).toBe(BanType.ranked_only);
    });

    it('throws BadRequestException when banType is temporary but durationDays is missing', async () => {
      // Arrange
      const missingDuration: BanPlayerDto = {
        userId: 'player-uuid-1',
        banType: BanType.temporary,
        reason: 'Speed hack',
        bannedBy: 'admin-uuid-1',
        // durationDays intentionally omitted
      };

      // Act / Assert
      await expect(service.banPlayer(missingDuration)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrisma.ban.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the player does not exist', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(null);

      // Act / Assert
      await expect(service.banPlayer(temporaryBanDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.ban.create).not.toHaveBeenCalled();
    });

    /**
     * [TDD CONTRACT] — banning an already-banned player should throw
     * BadRequestException to prevent stacking bans that conflict with each
     * other. The service does not implement this guard yet.
     * This test will fail until the service adds:
     *   const existingBan = await this.prisma.ban.findFirst({ where: { userId, isActive: true } })
     *   if (existingBan) throw new BadRequestException(...)
     */
    it('[TDD CONTRACT] throws BadRequestException when the player is already actively banned', async () => {
      // Arrange — mock an existing active ban for this player
      const existingBan = makeBan({ isActive: true });
      mockPrisma.ban.findFirst = jest.fn().mockResolvedValue(existingBan);

      // Act / Assert
      await expect(service.banPlayer(temporaryBanDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrisma.ban.create).not.toHaveBeenCalled();
    });

    it('propagates prisma error on DB failure', async () => {
      // Arrange
      mockPrisma.ban.create.mockRejectedValue(new Error('unique constraint violation'));

      // Act / Assert
      await expect(service.banPlayer(temporaryBanDto)).rejects.toThrow(
        'unique constraint violation',
      );
    });
  });

  // -------------------------------------------------------------------------
  // liftBan()
  // -------------------------------------------------------------------------

  describe('liftBan()', () => {
    const banId = 'ban-uuid-1';

    it('sets isActive=false and returns the updated ban', async () => {
      // Arrange
      const existing = makeBan();
      const lifted = makeBan({ isActive: false, liftedBy: 'admin-uuid-1', liftedAt: new Date() });
      mockPrisma.ban.findUnique.mockResolvedValue(existing);
      mockPrisma.ban.update.mockResolvedValue(lifted);

      // Act
      const result = await service.liftBan(banId);

      // Assert
      expect(mockPrisma.ban.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: banId },
          data: expect.objectContaining({ isActive: false }),
        }),
      );
      expect(result.isActive).toBe(false);
    });

    it('throws NotFoundException when the ban does not exist', async () => {
      // Arrange
      mockPrisma.ban.findUnique.mockResolvedValue(null);

      // Act / Assert
      await expect(service.liftBan('ghost-ban-id')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.ban.update).not.toHaveBeenCalled();
    });

    it('does not call update when ban lookup returns null', async () => {
      // Arrange
      mockPrisma.ban.findUnique.mockResolvedValue(null);

      // Act
      await service.liftBan('ghost-ban-id').catch(() => null);

      // Assert
      expect(mockPrisma.ban.update).toHaveBeenCalledTimes(0);
    });

    it('does not crash when lifting an already-inactive ban (idempotent)', async () => {
      // Arrange — ban already inactive; service should still process without error
      const alreadyLifted = makeBan({ isActive: false });
      mockPrisma.ban.findUnique.mockResolvedValue(alreadyLifted);
      mockPrisma.ban.update.mockResolvedValue(alreadyLifted);

      // Act / Assert
      await expect(service.liftBan(banId)).resolves.not.toThrow();
    });

    it('records liftedAt as a Date when lifting a ban', async () => {
      // Arrange
      const existing = makeBan();
      const lifted = makeBan({ isActive: false, liftedAt: new Date() });
      mockPrisma.ban.findUnique.mockResolvedValue(existing);
      mockPrisma.ban.update.mockResolvedValue(lifted);

      // Act
      await service.liftBan(banId);

      // Assert — liftedAt must be set in the update call
      const updateArg = mockPrisma.ban.update.mock.calls[0][0];
      expect(updateArg.data.liftedAt).toBeInstanceOf(Date);
    });
  });

  // -------------------------------------------------------------------------
  // getActiveBans()
  // -------------------------------------------------------------------------

  describe('getActiveBans()', () => {
    it('returns paginated active bans with metadata', async () => {
      // Arrange
      const bans = [makeBan(), makeBan({ id: 'ban-uuid-2' })];
      mockPrisma.ban.findMany.mockResolvedValue(bans);
      mockPrisma.ban.count.mockResolvedValue(2);

      // Act
      const result = await service.getActiveBans(1, 20);

      // Assert
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('filters only active bans (isActive=true)', async () => {
      // Arrange
      mockPrisma.ban.findMany.mockResolvedValue([]);
      mockPrisma.ban.count.mockResolvedValue(0);

      // Act
      await service.getActiveBans();

      // Assert
      const callArg = mockPrisma.ban.findMany.mock.calls[0][0];
      expect(callArg.where).toMatchObject({ isActive: true });
    });

    it('returns an empty result set when no bans are active', async () => {
      // Arrange
      mockPrisma.ban.findMany.mockResolvedValue([]);
      mockPrisma.ban.count.mockResolvedValue(0);

      // Act
      const result = await service.getActiveBans();

      // Assert
      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });

    it('applies pagination skip correctly for page 3, limit 5', async () => {
      // Arrange
      mockPrisma.ban.findMany.mockResolvedValue([]);
      mockPrisma.ban.count.mockResolvedValue(0);

      // Act
      await service.getActiveBans(3, 5);

      // Assert
      const callArg = mockPrisma.ban.findMany.mock.calls[0][0];
      expect(callArg.skip).toBe(10); // (3-1) * 5
      expect(callArg.take).toBe(5);
    });

    it('orders bans by createdAt descending', async () => {
      // Arrange
      mockPrisma.ban.findMany.mockResolvedValue([]);
      mockPrisma.ban.count.mockResolvedValue(0);

      // Act
      await service.getActiveBans();

      // Assert
      const callArg = mockPrisma.ban.findMany.mock.calls[0][0];
      expect(callArg.orderBy).toMatchObject({ createdAt: 'desc' });
    });
  });

  // -------------------------------------------------------------------------
  // getPlayerFlags()
  // -------------------------------------------------------------------------

  describe('getPlayerFlags()', () => {
    const userId = 'player-uuid-1';

    beforeEach(() => {
      mockPrisma.user.findUnique.mockResolvedValue(makeUser());
    });

    it('returns all flags for a given userId', async () => {
      // Arrange
      const flags = [
        makeFlag({ id: 'flag-uuid-1', severity: FlagSeverity.medium }),
        makeFlag({ id: 'flag-uuid-2', severity: FlagSeverity.high, reviewed: true }),
      ];
      mockPrisma.antiCheatFlag.findMany.mockResolvedValue(flags);

      // Act
      const result = await service.getPlayerFlags(userId);

      // Assert
      expect(mockPrisma.antiCheatFlag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId } }),
      );
      expect(result).toHaveLength(2);
      expect(result).toEqual(flags);
    });

    it('returns an empty array when the player has no flags', async () => {
      // Arrange
      mockPrisma.antiCheatFlag.findMany.mockResolvedValue([]);

      // Act
      const result = await service.getPlayerFlags('clean-player-uuid');

      // Assert
      expect(result).toEqual([]);
    });

    it('returns flags ordered by createdAt descending (newest first)', async () => {
      // Arrange
      const older = makeFlag({ id: 'flag-old', createdAt: new Date('2026-06-10T00:00:00Z') });
      const newer = makeFlag({ id: 'flag-new', createdAt: new Date('2026-06-13T00:00:00Z') });
      mockPrisma.antiCheatFlag.findMany.mockResolvedValue([newer, older]);

      // Act
      const result = await service.getPlayerFlags(userId);

      // Assert — orderBy must be forwarded to Prisma
      const callArg = mockPrisma.antiCheatFlag.findMany.mock.calls[0][0];
      expect(callArg).toMatchObject({
        orderBy: expect.objectContaining({ createdAt: 'desc' }),
      });
      expect(result[0].id).toBe('flag-new');
    });

    it('does not return flags belonging to a different userId', async () => {
      // Arrange
      const flags = [makeFlag({ userId })];
      mockPrisma.antiCheatFlag.findMany.mockResolvedValue(flags);

      // Act
      const result = await service.getPlayerFlags(userId);

      // Assert
      result.forEach((f: any) => expect(f.userId).toBe(userId));
    });

    it('throws NotFoundException when the player does not exist', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(null);

      // Act / Assert
      await expect(service.getPlayerFlags('unknown-user')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.antiCheatFlag.findMany).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // getBanHistory()
  // -------------------------------------------------------------------------

  describe('getBanHistory()', () => {
    const userId = 'player-uuid-1';

    beforeEach(() => {
      mockPrisma.user.findUnique.mockResolvedValue(makeUser());
    });

    it('returns all bans for a given userId ordered newest first', async () => {
      // Arrange
      const bans = [
        makeBan({ id: 'ban-uuid-1', isActive: false }),
        makeBan({ id: 'ban-uuid-2', isActive: true }),
      ];
      mockPrisma.ban.findMany.mockResolvedValue(bans);

      // Act
      const result = await service.getBanHistory(userId);

      // Assert
      expect(mockPrisma.ban.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId },
          orderBy: { createdAt: 'desc' },
        }),
      );
      expect(result).toHaveLength(2);
    });

    it('returns an empty array when the player has no ban history', async () => {
      // Arrange
      mockPrisma.ban.findMany.mockResolvedValue([]);

      // Act
      const result = await service.getBanHistory(userId);

      // Assert
      expect(result).toEqual([]);
    });

    it('includes both active and lifted bans in history', async () => {
      // Arrange — history should be unfiltered
      const activeBan = makeBan({ id: 'ban-active', isActive: true });
      const liftedBan = makeBan({ id: 'ban-lifted', isActive: false });
      mockPrisma.ban.findMany.mockResolvedValue([activeBan, liftedBan]);

      // Act
      const result = await service.getBanHistory(userId);

      // Assert — no isActive filter on the where clause
      const callArg = mockPrisma.ban.findMany.mock.calls[0][0];
      expect(callArg.where).not.toHaveProperty('isActive');
      expect(result).toHaveLength(2);
    });

    it('throws NotFoundException when the player does not exist', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(null);

      // Act / Assert
      await expect(service.getBanHistory('unknown-user')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.ban.findMany).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // autoFlagCheck()
  // -------------------------------------------------------------------------

  describe('autoFlagCheck()', () => {
    const userId = 'player-uuid-1';

    const cleanStats: MatchDataDto = {
      winRate: 0.55,
      avgCommandsPerSecond: 10,
      matchId: 'match-uuid-1',
    };

    const highWinRateStats: MatchDataDto = {
      winRate: 0.97, // > 0.95 threshold
      avgCommandsPerSecond: 10,
      matchId: 'match-uuid-1',
    };

    const highApmStats: MatchDataDto = {
      winRate: 0.60,
      avgCommandsPerSecond: 25, // > 20 threshold
      matchId: 'match-uuid-1',
    };

    const bothTriggeredStats: MatchDataDto = {
      winRate: 0.99,
      avgCommandsPerSecond: 30,
      matchId: 'match-uuid-1',
    };

    beforeEach(() => {
      mockPrisma.user.findUnique.mockResolvedValue(makeUser());
    });

    it('returns { flagged: false, reasons: [] } when stats are within thresholds', async () => {
      // Arrange — no flag creation should occur
      // Act
      const result = await service.autoFlagCheck(userId, cleanStats);

      // Assert
      expect(result.flagged).toBe(false);
      expect(result.reasons).toHaveLength(0);
      expect(mockPrisma.antiCheatFlag.create).not.toHaveBeenCalled();
    });

    it('does not create an AntiCheatFlag when stats are clean', async () => {
      // Act
      await service.autoFlagCheck(userId, cleanStats);

      // Assert
      expect(mockPrisma.antiCheatFlag.create).not.toHaveBeenCalled();
    });

    it('creates a flag and returns { flagged: true } when avgCommandsPerSecond exceeds threshold', async () => {
      // Arrange
      const createdFlag = makeFlag({
        flagType: 'auto_heuristic_flag',
        severity: 'high',
      });
      mockPrisma.antiCheatFlag.create.mockResolvedValue(createdFlag);

      // Act
      const result = await service.autoFlagCheck(userId, highApmStats);

      // Assert
      expect(result.flagged).toBe(true);
      expect(result.flag).toEqual(createdFlag);
      expect(mockPrisma.antiCheatFlag.create).toHaveBeenCalledTimes(1);
    });

    it('includes a commands_per_second_anomaly reason when APM exceeds threshold', async () => {
      // Arrange
      mockPrisma.antiCheatFlag.create.mockResolvedValue(makeFlag());

      // Act
      const result = await service.autoFlagCheck(userId, highApmStats);

      // Assert
      expect(result.reasons.some((r: string) => r.includes('commands_per_second_anomaly'))).toBe(true);
    });

    it('creates a flag when winRate exceeds the threshold', async () => {
      // Arrange
      const createdFlag = makeFlag({ flagType: 'auto_heuristic_flag', severity: 'high' });
      mockPrisma.antiCheatFlag.create.mockResolvedValue(createdFlag);

      // Act
      const result = await service.autoFlagCheck(userId, highWinRateStats);

      // Assert
      expect(result.flagged).toBe(true);
      expect(mockPrisma.antiCheatFlag.create).toHaveBeenCalledTimes(1);
    });

    it('includes a win_rate_anomaly reason when winRate exceeds threshold', async () => {
      // Arrange
      mockPrisma.antiCheatFlag.create.mockResolvedValue(makeFlag());

      // Act
      const result = await service.autoFlagCheck(userId, highWinRateStats);

      // Assert
      expect(result.reasons.some((r: string) => r.includes('win_rate_anomaly'))).toBe(true);
    });

    it('includes both reasons when both thresholds are exceeded', async () => {
      // Arrange
      mockPrisma.antiCheatFlag.create.mockResolvedValue(makeFlag());

      // Act
      const result = await service.autoFlagCheck(userId, bothTriggeredStats);

      // Assert
      expect(result.reasons).toHaveLength(2);
      expect(result.reasons.some((r: string) => r.includes('win_rate_anomaly'))).toBe(true);
      expect(result.reasons.some((r: string) => r.includes('commands_per_second_anomaly'))).toBe(true);
    });

    it('creates the flag with severity="high" regardless of which threshold triggered', async () => {
      // Arrange
      mockPrisma.antiCheatFlag.create.mockResolvedValue(makeFlag({ severity: 'high' }));

      // Act
      await service.autoFlagCheck(userId, highApmStats);

      // Assert
      const createArg = mockPrisma.antiCheatFlag.create.mock.calls[0][0];
      expect(createArg.data.severity).toBe('high');
    });

    it('creates the flag with flagType="auto_heuristic_flag"', async () => {
      // Arrange
      mockPrisma.antiCheatFlag.create.mockResolvedValue(makeFlag());

      // Act
      await service.autoFlagCheck(userId, highApmStats);

      // Assert
      const createArg = mockPrisma.antiCheatFlag.create.mock.calls[0][0];
      expect(createArg.data.flagType).toBe('auto_heuristic_flag');
    });

    it('embeds matchId from matchData into the created flag', async () => {
      // Arrange
      mockPrisma.antiCheatFlag.create.mockResolvedValue(makeFlag());

      // Act
      await service.autoFlagCheck(userId, highApmStats);

      // Assert
      const createArg = mockPrisma.antiCheatFlag.create.mock.calls[0][0];
      expect(createArg.data.matchId).toBe('match-uuid-1');
    });

    it('handles missing matchId gracefully (stores null)', async () => {
      // Arrange
      const noMatchStats: MatchDataDto = {
        winRate: 0.99,
        avgCommandsPerSecond: 25,
        // matchId omitted
      };
      mockPrisma.antiCheatFlag.create.mockResolvedValue(makeFlag({ matchId: null }));

      // Act
      const result = await service.autoFlagCheck(userId, noMatchStats);

      // Assert
      expect(result.flagged).toBe(true);
      const createArg = mockPrisma.antiCheatFlag.create.mock.calls[0][0];
      expect(createArg.data.matchId).toBeNull();
    });

    it('throws NotFoundException when the player does not exist', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(null);

      // Act / Assert
      await expect(service.autoFlagCheck('unknown-user', cleanStats)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.antiCheatFlag.create).not.toHaveBeenCalled();
    });
  });
});
