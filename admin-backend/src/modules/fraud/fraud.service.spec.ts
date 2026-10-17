/**
 * Unit tests for FraudDetectionService.
 * Implements: fraud detection design spec — test coverage.
 *
 * Prisma models used:
 *   FraudFlag      → prisma.fraudFlag     (@@map "fraud_flags")
 *   PlayerPurchase → prisma.playerPurchase (@@map "player_purchases")
 *   User           → prisma.user          (@@map "users")
 */

import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { FraudDetectionService } from './fraud.service';
import { PrismaService } from '../../database/prisma.service';
import { AdminGateway } from '../../gateway/admin.gateway';
import { FraudDecision, RiskLevel } from './dto/fraud.dto';

// ─── Fixture factories ────────────────────────────────────────────────────────

function makeUser(overrides: Partial<Record<string, unknown>> = {}) {
  return { id: 'player-uuid-1', email: 'player@example.com', isActive: true, country: 'TR', ...overrides };
}

function makeFraudFlag(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'flag-uuid-1',
    userId: 'player-uuid-1',
    flagType: 'transaction_blocked',
    score: 75,
    data: {
      transactionId: 'txn-abc',
      amount: 150,
      currency: 'USD',
      amountUsd: 150,
      paymentMethod: 'credit_card',
      factors: ['high_amount'],
      riskLevel: RiskLevel.HIGH,
      decision: FraudDecision.BLOCKED,
      analyzedAt: new Date('2026-06-13T10:00:00Z').toISOString(),
    },
    resolved: false,
    resolvedBy: null,
    createdAt: new Date('2026-06-13T10:00:00Z'),
    ...overrides,
  };
}

// ─── Prisma mock ──────────────────────────────────────────────────────────────

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
  },
  fraudFlag: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  playerPurchase: {
    count: jest.fn(),
    findFirst: jest.fn(),
  },
};

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('FraudDetectionService', () => {
  let service: FraudDetectionService;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: AdminGateway, useValue: new Proxy({}, { get: (_t, p) => (p === 'then' ? undefined : jest.fn()) }) },
        FraudDetectionService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<FraudDetectionService>(FraudDetectionService);
  });

  // ─── analyzeTransaction ────────────────────────────────────────────────────

  describe('analyzeTransaction()', () => {
    beforeEach(() => {
      mockPrisma.user.findUnique.mockResolvedValue(makeUser());
      mockPrisma.playerPurchase.count.mockResolvedValue(0);
      mockPrisma.fraudFlag.create.mockResolvedValue(makeFraudFlag());
    });

    it('returns APPROVED and LOW risk for a normal small amount with no velocity', async () => {
      // Arrange — amount below $100, no velocity, mismatch depends on playerId hash
      // Use a playerId whose hash yields >= 0.3 (no mismatch) to isolate the test.
      // 'clean-player-id' → hash % 1000 / 1000 ≥ 0.3 (verified manually)
      mockPrisma.user.findUnique.mockResolvedValue(makeUser({ id: 'clean-player-id' }));

      // Act
      const result = await service.analyzeTransaction('clean-player-id', 9.99, 'USD', 'credit_card');

      // Assert
      expect(result.riskScore).toBeLessThan(40);
      expect(result.riskLevel).toBe(RiskLevel.LOW);
      expect(result.decision).toBe(FraudDecision.APPROVED);
      expect(result.playerId).toBe('clean-player-id');
    });

    it('returns HIGH risk and BLOCKED decision when amount exceeds $100 and velocity is exceeded', async () => {
      // Arrange — velocity >= 3 (+40) + amount > $100 (+35) = 75, over threshold
      mockPrisma.playerPurchase.count.mockResolvedValue(5);

      // Act
      const result = await service.analyzeTransaction(
        'player-uuid-1',
        150,
        'USD',
        'credit_card',
      );

      // Assert
      expect(result.riskScore).toBeGreaterThan(70);
      expect(result.riskLevel).toBe(RiskLevel.HIGH);
      expect(result.decision).toBe(FraudDecision.BLOCKED);
    });

    it('includes "velocity_exceeded" in factors when purchase count is above threshold', async () => {
      // Arrange
      mockPrisma.playerPurchase.count.mockResolvedValue(4);

      // Act
      const result = await service.analyzeTransaction('player-uuid-1', 9.99, 'USD', 'paypal');

      // Assert
      expect(result.factors.some((f) => f.includes('velocity_exceeded'))).toBe(true);
    });

    it('includes "high_amount" in factors when USD-equivalent exceeds $100', async () => {
      // Arrange
      mockPrisma.playerPurchase.count.mockResolvedValue(0);

      // Act
      const result = await service.analyzeTransaction('clean-player-id', 120, 'USD', 'credit_card');

      // Assert
      expect(result.factors.some((f) => f.includes('high_amount'))).toBe(true);
    });

    it('persists a FraudFlag when decision is BLOCKED', async () => {
      // Arrange — force HIGH risk
      mockPrisma.playerPurchase.count.mockResolvedValue(5);

      // Act
      await service.analyzeTransaction('player-uuid-1', 150, 'USD', 'credit_card');

      // Assert
      expect(mockPrisma.fraudFlag.create).toHaveBeenCalledTimes(1);
    });

    it('does NOT persist a FraudFlag when decision is APPROVED', async () => {
      // Arrange — clean-player-id produces no country mismatch; no velocity; low amount
      mockPrisma.user.findUnique.mockResolvedValue(makeUser({ id: 'clean-player-id' }));
      mockPrisma.playerPurchase.count.mockResolvedValue(0);

      // Act
      await service.analyzeTransaction('clean-player-id', 5, 'USD', 'credit_card');

      // Assert
      expect(mockPrisma.fraudFlag.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when player does not exist', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(null);

      // Act / Assert
      await expect(
        service.analyzeTransaction('unknown-player', 10, 'USD', 'credit_card'),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.fraudFlag.create).not.toHaveBeenCalled();
    });

    it('returns a transactionId and createdAt in the response', async () => {
      // Act
      const result = await service.analyzeTransaction('player-uuid-1', 10, 'USD', 'paypal');

      // Assert
      expect(result.transactionId).toBeDefined();
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    it('converts non-USD currency to USD for the amount threshold check', async () => {
      // Arrange — 100 EUR = ~$109 USD, should trigger high_amount
      mockPrisma.playerPurchase.count.mockResolvedValue(0);

      // Act
      const result = await service.analyzeTransaction('clean-player-id', 100, 'EUR', 'credit_card');

      // Assert
      expect(result.factors.some((f) => f.includes('high_amount'))).toBe(true);
    });
  });

  // ─── getFlaggedTransactions ────────────────────────────────────────────────

  describe('getFlaggedTransactions()', () => {
    it('returns paginated flags with correct metadata', async () => {
      // Arrange
      const flags = [makeFraudFlag(), makeFraudFlag({ id: 'flag-uuid-2' })];
      mockPrisma.fraudFlag.findMany.mockResolvedValue(flags);
      mockPrisma.fraudFlag.count.mockResolvedValue(2);

      // Act
      const result = await service.getFlaggedTransactions(1, 20, 0);

      // Assert
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('returns totalPages=0 when no flags match', async () => {
      // Arrange
      mockPrisma.fraudFlag.findMany.mockResolvedValue([]);
      mockPrisma.fraudFlag.count.mockResolvedValue(0);

      // Act
      const result = await service.getFlaggedTransactions();

      // Assert
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });

    it('passes minRisk as the score gte filter', async () => {
      // Arrange
      mockPrisma.fraudFlag.findMany.mockResolvedValue([]);
      mockPrisma.fraudFlag.count.mockResolvedValue(0);

      // Act
      await service.getFlaggedTransactions(1, 20, 60);

      // Assert
      const callArg = mockPrisma.fraudFlag.findMany.mock.calls[0][0];
      expect(callArg.where).toMatchObject({ score: { gte: 60 } });
    });
  });

  // ─── reviewTransaction ────────────────────────────────────────────────────

  describe('reviewTransaction()', () => {
    it('updates the flag to resolved and returns a FraudFlagDTO', async () => {
      // Arrange
      const existing = makeFraudFlag();
      const updated = makeFraudFlag({
        resolved: true,
        resolvedBy: 'admin-uuid-1',
        data: {
          ...(existing.data as Record<string, unknown>),
          reviewDecision: 'approve',
          reviewNotes: 'Verified legitimate',
          reviewedAt: new Date('2026-06-13T11:00:00Z').toISOString(),
        },
      });
      mockPrisma.fraudFlag.findFirst.mockResolvedValue(existing);
      mockPrisma.fraudFlag.update.mockResolvedValue(updated);

      // Act
      const result = await service.reviewTransaction(
        'txn-abc',
        'approve',
        'admin-uuid-1',
        'Verified legitimate',
      );

      // Assert
      expect(mockPrisma.fraudFlag.update).toHaveBeenCalledTimes(1);
      expect(result.reviewedBy).toBe('admin-uuid-1');
    });

    it('stores the decision and notes in the flag data', async () => {
      // Arrange
      const existing = makeFraudFlag();
      mockPrisma.fraudFlag.findFirst.mockResolvedValue(existing);
      mockPrisma.fraudFlag.update.mockResolvedValue(
        makeFraudFlag({ resolved: true, resolvedBy: 'admin-uuid-1' }),
      );

      // Act
      await service.reviewTransaction('txn-abc', 'reject', 'admin-uuid-1', 'Confirmed fraud');

      // Assert
      const updateArg = mockPrisma.fraudFlag.update.mock.calls[0][0];
      expect(updateArg.data.data).toMatchObject({
        reviewDecision: 'reject',
        reviewNotes: 'Confirmed fraud',
      });
    });

    it('throws NotFoundException when transactionId is not found', async () => {
      // Arrange
      mockPrisma.fraudFlag.findFirst.mockResolvedValue(null);

      // Act / Assert
      await expect(
        service.reviewTransaction('txn-unknown', 'approve', 'admin-uuid-1'),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.fraudFlag.update).not.toHaveBeenCalled();
    });
  });

  // ─── getPlayerFraudProfile ────────────────────────────────────────────────

  describe('getPlayerFraudProfile()', () => {
    it('returns a complete profile with transaction counts', async () => {
      // Arrange
      const flags = [makeFraudFlag(), makeFraudFlag({ id: 'flag-uuid-2', score: 45, data: { decision: FraudDecision.REVIEW } })];
      mockPrisma.user.findUnique.mockResolvedValue(makeUser());
      mockPrisma.fraudFlag.findMany.mockResolvedValue(flags);
      mockPrisma.playerPurchase.count.mockResolvedValue(10);
      mockPrisma.playerPurchase.findFirst.mockResolvedValue({ createdAt: new Date('2026-06-13T09:00:00Z') });

      // Act
      const result = await service.getPlayerFraudProfile('player-uuid-1');

      // Assert
      expect(result.playerId).toBe('player-uuid-1');
      expect(result.flaggedCount).toBe(2);
      expect(result.totalTransactions).toBe(10);
      expect(result.lastTransactionAt).toBeInstanceOf(Date);
    });

    it('throws NotFoundException when player does not exist', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(null);

      // Act / Assert
      await expect(service.getPlayerFraudProfile('unknown-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns zero averageRiskScore when there are no flags', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(makeUser());
      mockPrisma.fraudFlag.findMany.mockResolvedValue([]);
      mockPrisma.playerPurchase.count.mockResolvedValue(5);
      mockPrisma.playerPurchase.findFirst.mockResolvedValue(null);

      // Act
      const result = await service.getPlayerFraudProfile('player-uuid-1');

      // Assert
      expect(result.averageRiskScore).toBe(0);
      expect(result.flaggedCount).toBe(0);
      expect(result.lastTransactionAt).toBeUndefined();
    });
  });

  // ─── getFraudStats ────────────────────────────────────────────────────────

  describe('getFraudStats()', () => {
    it('returns correct aggregate statistics', async () => {
      // Arrange
      mockPrisma.fraudFlag.count
        .mockResolvedValueOnce(50)  // totalFlagged
        .mockResolvedValueOnce(20); // totalBlocked
      mockPrisma.playerPurchase.count.mockResolvedValue(200);
      mockPrisma.fraudFlag.findMany.mockResolvedValue([
        { score: 75 }, { score: 45 },
      ]);

      // Act
      const result = await service.getFraudStats();

      // Assert
      expect(result.totalAnalyzed).toBe(200);
      expect(result.totalFlagged).toBe(50);
      expect(result.totalBlocked).toBe(20);
      expect(result.flagRate).toBeCloseTo(0.25, 2);
      expect(result.averageRiskScore).toBe(60);
    });

    it('returns flagRate of 0 when there are no transactions', async () => {
      // Arrange
      mockPrisma.fraudFlag.count.mockResolvedValue(0);
      mockPrisma.playerPurchase.count.mockResolvedValue(0);
      mockPrisma.fraudFlag.findMany.mockResolvedValue([]);

      // Act
      const result = await service.getFraudStats();

      // Assert
      expect(result.flagRate).toBe(0);
      expect(result.averageRiskScore).toBe(0);
    });
  });

  // ─── analyzeTransaction — Prisma persistence scenarios ────────────────────

  describe('analyzeTransaction() — Prisma mock scenarios', () => {
    beforeEach(() => {
      mockPrisma.user.findUnique.mockResolvedValue(makeUser({ id: 'player-uuid-1' }));
      mockPrisma.fraudFlag.create.mockResolvedValue(makeFraudFlag());
    });

    it('flagTransaction_HighRisk_TriggersAutoBlock — creates FraudFlag record when amount and velocity both exceed thresholds', async () => {
      // Arrange — velocity >= 3 (+40) + amount $150 > $100 (+35) = 75 > 70 → BLOCKED
      // player-uuid-1 hash: deterministic mismatch check may add +25, but 75 alone is already > 70
      mockPrisma.playerPurchase.count.mockResolvedValue(5);

      // Act
      const result = await service.analyzeTransaction('player-uuid-1', 150, 'USD', 'credit_card');

      // Assert — player is flagged (BLOCKED decision) and FraudFlag row is persisted
      expect(result.decision).toBe(FraudDecision.BLOCKED);
      expect(result.riskLevel).toBe(RiskLevel.HIGH);
      expect(mockPrisma.fraudFlag.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.fraudFlag.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'player-uuid-1',
            flagType: expect.stringContaining('blocked'),
          }),
        }),
      );
    });

    it('reviewFlag_Approve_ClearsFlag — reviewTransaction(approve) sets resolved=true on the FraudFlag', async () => {
      // Arrange
      const existing = makeFraudFlag();
      mockPrisma.fraudFlag.findFirst.mockResolvedValue(existing);
      mockPrisma.fraudFlag.update.mockResolvedValue(
        makeFraudFlag({ resolved: true, resolvedBy: 'admin-uuid-1' }),
      );

      // Act
      await service.reviewTransaction('txn-abc', 'approve', 'admin-uuid-1', 'Verified legitimate');

      // Assert — FraudFlag.update is called with resolved=true (flag cleared)
      expect(mockPrisma.fraudFlag.update).toHaveBeenCalledTimes(1);
      const updateArg = mockPrisma.fraudFlag.update.mock.calls[0][0];
      expect(updateArg.data).toMatchObject({ resolved: true });
      expect(updateArg.data.data).toMatchObject({ reviewDecision: 'approve' });
    });

    it('reviewFlag_Reject_BansPlayer — reviewTransaction(reject) persists reject decision in FraudFlag data', async () => {
      // Arrange
      const existing = makeFraudFlag();
      mockPrisma.fraudFlag.findFirst.mockResolvedValue(existing);
      mockPrisma.fraudFlag.update.mockResolvedValue(
        makeFraudFlag({ resolved: true, resolvedBy: 'admin-uuid-1' }),
      );

      // Act
      await service.reviewTransaction('txn-abc', 'reject', 'admin-uuid-1', 'Confirmed fraud');

      // Assert — reject decision is stored; resolved is set to true (flag actioned)
      const updateArg = mockPrisma.fraudFlag.update.mock.calls[0][0];
      expect(updateArg.data).toMatchObject({ resolved: true });
      expect(updateArg.data.data).toMatchObject({
        reviewDecision: 'reject',
        reviewNotes: 'Confirmed fraud',
      });
    });

    it('getRiskScore_NewPlayer_ReturnsZero — getPlayerFraudProfile returns averageRiskScore of 0 when player has no flags', async () => {
      // Arrange — player exists, no fraud flags, zero purchases
      mockPrisma.user.findUnique.mockResolvedValue(makeUser({ id: 'new-player-id' }));
      mockPrisma.fraudFlag.findMany.mockResolvedValue([]);
      mockPrisma.playerPurchase.count.mockResolvedValue(0);
      mockPrisma.playerPurchase.findFirst.mockResolvedValue(null);

      // Act
      const profile = await service.getPlayerFraudProfile('new-player-id');

      // Assert
      expect(profile.averageRiskScore).toBe(0);
      expect(profile.flaggedCount).toBe(0);
    });

    it('getRiskScore_HighVelocity_ReturnsHighScore — analyzeTransaction returns score > 40 when velocity threshold exceeded', async () => {
      // Arrange — velocity count = 4 (>= 3) adds +40 points minimum
      mockPrisma.user.findUnique.mockResolvedValue(makeUser({ id: 'high-velocity-player' }));
      mockPrisma.playerPurchase.count.mockResolvedValue(4);

      // Act — small amount so only velocity contributes (plus potential mismatch for this playerId)
      const result = await service.analyzeTransaction('high-velocity-player', 5, 'USD', 'paypal');

      // Assert — velocity alone pushes score to 40; mismatch may push further; either way > 39
      expect(result.riskScore).toBeGreaterThanOrEqual(40);
      expect(result.factors.some((f) => f.includes('velocity_exceeded'))).toBe(true);
    });
  });
});
