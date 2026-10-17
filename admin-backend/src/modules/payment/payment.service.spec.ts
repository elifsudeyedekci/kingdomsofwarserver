/**
 * Story Type : Logic (service-layer data operations)
 * Output     : tests/unit/payment/  (co-located NestJS convention)
 * Gate Level : BLOCKING
 */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PrismaService } from '../../database/prisma.service';

// ---------------------------------------------------------------------------
// Prisma mock
// ---------------------------------------------------------------------------

const mockPrisma: any = {
  playerPurchase: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  purchaseReceipt: {
    create: jest.fn(),
    findUnique: jest.fn(),
  },
  refund: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  chargeback: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PURCHASE_ID = 'purchase-uuid-1';
const USER_ID = 'user-uuid-1';
const PRODUCT_ID = 'product-uuid-1';
const TRANSACTION_ID = 'txn-abc-123';

const basePurchase = {
  id: PURCHASE_ID,
  userId: USER_ID,
  storeProductId: PRODUCT_ID,
  platform: 'android',
  transactionId: TRANSACTION_ID,
  receiptData: 'raw-receipt-data',
  amountUsd: 4.99,
  currencyCode: 'USD',
  amountLocal: null,
  status: 'pending',
  verifiedAt: null,
  fraudScore: null,
  createdAt: new Date('2026-01-01T10:00:00Z'),
};

const verifiedPurchase = {
  ...basePurchase,
  status: 'verified',
  verifiedAt: new Date('2026-01-01T10:01:00Z'),
  fraudScore: 0.02,
};

const baseRefund = {
  id: 'refund-uuid-1',
  purchaseId: PURCHASE_ID,
  userId: USER_ID,
  reason: 'player request',
  amountUsd: 4.99,
  status: 'pending',
  processedAt: null,
  createdAt: new Date('2026-01-02T10:00:00Z'),
};

const baseChargeback = {
  id: 'chargeback-uuid-1',
  userId: USER_ID,
  transactionId: TRANSACTION_ID,
  amountUsd: 4.99,
  reason: 'unauthorized',
  status: 'received',
  resolvedAt: null,
  createdAt: new Date('2026-01-03T10:00:00Z'),
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('PaymentService', () => {
  let service: PaymentService;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // createPurchase()
  // -------------------------------------------------------------------------
  describe('createPurchase()', () => {
    const createDto: any = {
      storeProductId: PRODUCT_ID,
      platform: 'android',
      transactionId: TRANSACTION_ID,
      receiptData: 'raw-receipt-data',
      amountUsd: 4.99,
    };

    it('creates a purchase with status "pending" and default currencyCode "USD"', async () => {
      // Arrange
      mockPrisma.playerPurchase.create.mockResolvedValue(basePurchase);

      // Act
      const result = await service.createPurchase(USER_ID, createDto);

      // Assert
      expect(mockPrisma.playerPurchase.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: USER_ID,
            storeProductId: PRODUCT_ID,
            status: 'pending',
            currencyCode: 'USD',
          }),
        }),
      );
      expect(result.status).toBe('pending');
    });

    it('preserves caller-supplied currencyCode when provided', async () => {
      // Arrange
      const dtoWithCurrency: any = { ...createDto, currencyCode: 'EUR', amountLocal: 4.59 };
      const createdWithEur = { ...basePurchase, currencyCode: 'EUR', amountLocal: 4.59 };
      mockPrisma.playerPurchase.create.mockResolvedValue(createdWithEur);

      // Act
      const result = await service.createPurchase(USER_ID, dtoWithCurrency);

      // Assert
      expect(mockPrisma.playerPurchase.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ currencyCode: 'EUR', amountLocal: 4.59 }),
        }),
      );
      expect(result.currencyCode).toBe('EUR');
    });

    it('associates the purchase with the correct userId', async () => {
      // Arrange
      const otherUserId = 'user-uuid-other';
      const purchaseForOther = { ...basePurchase, userId: otherUserId };
      mockPrisma.playerPurchase.create.mockResolvedValue(purchaseForOther);

      // Act
      await service.createPurchase(otherUserId, createDto);

      // Assert
      expect(mockPrisma.playerPurchase.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: otherUserId }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // getPurchases()
  // -------------------------------------------------------------------------
  describe('getPurchases()', () => {
    it('returns paginated purchases for a given user', async () => {
      // Arrange
      mockPrisma.playerPurchase.findMany.mockResolvedValue([basePurchase]);
      mockPrisma.playerPurchase.count.mockResolvedValue(1);

      // Act
      const result = await service.getPurchases(USER_ID, 1, 20);

      // Assert
      expect(mockPrisma.playerPurchase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: USER_ID },
          skip: 0,
          take: 20,
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({ items: [basePurchase], total: 1, page: 1, limit: 20 }),
      );
    });

    it('applies correct skip offset for page 3 with limit 10', async () => {
      // Arrange
      mockPrisma.playerPurchase.findMany.mockResolvedValue([]);
      mockPrisma.playerPurchase.count.mockResolvedValue(25);

      // Act
      await service.getPurchases(USER_ID, 3, 10);

      // Assert
      expect(mockPrisma.playerPurchase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });

    it('returns empty items array when no purchases exist for user', async () => {
      // Arrange
      mockPrisma.playerPurchase.findMany.mockResolvedValue([]);
      mockPrisma.playerPurchase.count.mockResolvedValue(0);

      // Act
      const result = await service.getPurchases('unknown-user', 1, 20);

      // Assert
      expect(result).toEqual(
        expect.objectContaining({ items: [], total: 0 }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // getAllPurchases()
  // -------------------------------------------------------------------------
  describe('getAllPurchases()', () => {
    it('returns all purchases across all users with pagination', async () => {
      // Arrange
      const purchases = [basePurchase, { ...basePurchase, id: 'purchase-uuid-2', userId: 'user-uuid-2' }];
      mockPrisma.playerPurchase.findMany.mockResolvedValue(purchases);
      mockPrisma.playerPurchase.count.mockResolvedValue(2);

      // Act
      const result = await service.getAllPurchases(1, 20);

      // Assert
      expect(mockPrisma.playerPurchase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {}, skip: 0, take: 20 }),
      );
      expect(result).toEqual(
        expect.objectContaining({ data: purchases, total: 2, page: 1, limit: 20 }),
      );
    });

    it('filters by status when status param is provided', async () => {
      // Arrange
      mockPrisma.playerPurchase.findMany.mockResolvedValue([verifiedPurchase]);
      mockPrisma.playerPurchase.count.mockResolvedValue(1);

      // Act
      await service.getAllPurchases(1, 10, 'verified');

      // Assert
      expect(mockPrisma.playerPurchase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'verified' } }),
      );
      expect(mockPrisma.playerPurchase.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'verified' } }),
      );
    });

    it('applies no status filter when status param is omitted', async () => {
      // Arrange
      mockPrisma.playerPurchase.findMany.mockResolvedValue([]);
      mockPrisma.playerPurchase.count.mockResolvedValue(0);

      // Act
      await service.getAllPurchases(1, 10);

      // Assert
      expect(mockPrisma.playerPurchase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it('applies correct skip offset for page 2 with limit 5', async () => {
      // Arrange
      mockPrisma.playerPurchase.findMany.mockResolvedValue([]);
      mockPrisma.playerPurchase.count.mockResolvedValue(10);

      // Act
      await service.getAllPurchases(2, 5);

      // Assert
      expect(mockPrisma.playerPurchase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 5, take: 5 }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // getPurchaseById()
  // -------------------------------------------------------------------------
  describe('getPurchaseById()', () => {
    it('returns the purchase including receipt and refund relations when found', async () => {
      // Arrange
      mockPrisma.playerPurchase.findUnique.mockResolvedValue(basePurchase);

      // Act
      const result = await service.getPurchaseById(PURCHASE_ID);

      // Assert
      expect(mockPrisma.playerPurchase.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: PURCHASE_ID },
          include: { receipt: true, refund: true },
        }),
      );
      expect(result).toEqual(basePurchase);
    });

    it('throws NotFoundException when purchase does not exist', async () => {
      // Arrange
      mockPrisma.playerPurchase.findUnique.mockResolvedValue(null);

      // Act + Assert
      await expect(service.getPurchaseById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // verifyReceipt()
  // -------------------------------------------------------------------------
  describe('verifyReceipt()', () => {
    it('marks purchase as "verified" and creates receipt record on valid receipt', async () => {
      // Arrange
      mockPrisma.playerPurchase.findUnique.mockResolvedValue(basePurchase);
      mockPrisma.purchaseReceipt.create.mockResolvedValue({
        id: 'receipt-uuid-1',
        purchaseId: PURCHASE_ID,
        rawReceipt: basePurchase.receiptData,
        isValid: true,
        validatedAt: new Date(),
      });
      mockPrisma.playerPurchase.update.mockResolvedValue(verifiedPurchase);

      // Act
      const result = await service.verifyReceipt(PURCHASE_ID, {
        rawReceipt: basePurchase.receiptData,
        isValid: true,
        validationResponse: { ok: true },
      });

      // Assert
      expect(mockPrisma.purchaseReceipt.create).toHaveBeenCalled();
      expect(mockPrisma.playerPurchase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: PURCHASE_ID },
          data: expect.objectContaining({ status: 'verified' }),
        }),
      );
      expect(result).toEqual(expect.objectContaining({ status: 'verified' }));
    });

    it('marks purchase as "failed" when receipt is invalid', async () => {
      // Arrange
      const failedPurchase = { ...basePurchase, status: 'failed' };
      mockPrisma.playerPurchase.findUnique.mockResolvedValue(basePurchase);
      mockPrisma.purchaseReceipt.create.mockResolvedValue({});
      mockPrisma.playerPurchase.update.mockResolvedValue(failedPurchase);

      // Act
      const result = await service.verifyReceipt(PURCHASE_ID, {
        rawReceipt: 'bad-receipt',
        isValid: false,
      });

      // Assert
      expect(mockPrisma.playerPurchase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'failed' }),
        }),
      );
      expect(result.status).toBe('failed');
    });

    it('throws NotFoundException when purchase to verify does not exist', async () => {
      // Arrange
      mockPrisma.playerPurchase.findUnique.mockResolvedValue(null);

      // Act + Assert
      await expect(
        service.verifyReceipt('nonexistent', { rawReceipt: 'x', isValid: true }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.playerPurchase.update).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when receipt is already verified', async () => {
      // Arrange
      mockPrisma.playerPurchase.findUnique.mockResolvedValue(verifiedPurchase);

      // Act + Assert
      await expect(
        service.verifyReceipt(PURCHASE_ID, { rawReceipt: 'x', isValid: true }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.purchaseReceipt.create).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // createRefund()
  // -------------------------------------------------------------------------
  describe('createRefund()', () => {
    it('creates a refund record with correct userId and amountUsd from the purchase', async () => {
      // Arrange
      mockPrisma.playerPurchase.findUnique.mockResolvedValue(basePurchase);
      mockPrisma.refund.findUnique.mockResolvedValue(null);
      mockPrisma.refund.create.mockResolvedValue(baseRefund);

      // Act
      const result = await service.createRefund(PURCHASE_ID, { reason: 'player request' });

      // Assert
      expect(mockPrisma.refund.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            purchaseId: PURCHASE_ID,
            userId: USER_ID,
            amountUsd: basePurchase.amountUsd,
            status: 'pending',
          }),
        }),
      );
      expect(result).toEqual(baseRefund);
    });

    it('creates a refund without a reason when reason is omitted', async () => {
      // Arrange
      const refundNoReason = { ...baseRefund, reason: null };
      mockPrisma.playerPurchase.findUnique.mockResolvedValue(basePurchase);
      mockPrisma.refund.findUnique.mockResolvedValue(null);
      mockPrisma.refund.create.mockResolvedValue(refundNoReason);

      // Act
      const result = await service.createRefund(PURCHASE_ID, {});

      // Assert
      expect(mockPrisma.refund.create).toHaveBeenCalled();
      expect(result).toEqual(refundNoReason);
    });

    it('throws NotFoundException when purchase does not exist', async () => {
      // Arrange
      mockPrisma.playerPurchase.findUnique.mockResolvedValue(null);

      // Act + Assert
      await expect(service.createRefund('nonexistent', {})).rejects.toThrow(NotFoundException);
      expect(mockPrisma.refund.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when a refund already exists for the purchase', async () => {
      // Arrange
      mockPrisma.playerPurchase.findUnique.mockResolvedValue(basePurchase);
      mockPrisma.refund.findUnique.mockResolvedValue(baseRefund);

      // Act + Assert
      await expect(service.createRefund(PURCHASE_ID, {})).rejects.toThrow(BadRequestException);
      expect(mockPrisma.refund.create).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // logChargeback()
  // -------------------------------------------------------------------------
  describe('logChargeback()', () => {
    it('creates a chargeback record with status "received"', async () => {
      // Arrange
      mockPrisma.chargeback.create.mockResolvedValue(baseChargeback);

      // Act
      const result = await service.logChargeback({
        userId: USER_ID,
        transactionId: TRANSACTION_ID,
        amountUsd: 4.99,
        reason: 'unauthorized',
      });

      // Assert
      expect(mockPrisma.chargeback.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: USER_ID,
            transactionId: TRANSACTION_ID,
            status: 'received',
          }),
        }),
      );
      expect(result.status).toBe('received');
    });

    it('throws BadRequestException when amountUsd is zero', async () => {
      // Arrange + Act + Assert
      await expect(
        service.logChargeback({ userId: USER_ID, transactionId: 'txn-x', amountUsd: 0 }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.chargeback.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when amountUsd is negative', async () => {
      // Arrange + Act + Assert
      await expect(
        service.logChargeback({ userId: USER_ID, transactionId: 'txn-x', amountUsd: -10 }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.chargeback.create).not.toHaveBeenCalled();
    });

    it('logs chargeback without optional reason field', async () => {
      // Arrange
      const chargebackNoReason = { ...baseChargeback, reason: null };
      mockPrisma.chargeback.create.mockResolvedValue(chargebackNoReason);

      // Act
      const result = await service.logChargeback({
        userId: USER_ID,
        transactionId: TRANSACTION_ID,
        amountUsd: 4.99,
      });

      // Assert
      expect(mockPrisma.chargeback.create).toHaveBeenCalled();
      expect(result.reason).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // getChargebacks()
  // -------------------------------------------------------------------------
  describe('getChargebacks()', () => {
    it('returns paginated chargebacks list without status filter', async () => {
      // Arrange
      mockPrisma.chargeback.findMany.mockResolvedValue([baseChargeback]);
      mockPrisma.chargeback.count.mockResolvedValue(1);

      // Act
      const result = await service.getChargebacks({ page: 1, limit: 20 });

      // Assert
      expect(mockPrisma.chargeback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {}, skip: 0, take: 20 }),
      );
      expect(result).toEqual(
        expect.objectContaining({ items: [baseChargeback], total: 1 }),
      );
    });

    it('filters chargebacks by status when status query param is provided', async () => {
      // Arrange
      const resolvedChargeback = { ...baseChargeback, status: 'resolved' };
      mockPrisma.chargeback.findMany.mockResolvedValue([resolvedChargeback]);
      mockPrisma.chargeback.count.mockResolvedValue(1);

      // Act
      const result = await service.getChargebacks({ page: 1, limit: 20, status: 'resolved' });

      // Assert
      expect(mockPrisma.chargeback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'resolved' } }),
      );
      expect(result.items[0].status).toBe('resolved');
    });

    it('defaults page to 1 and limit to 20 when not provided in query', async () => {
      // Arrange
      mockPrisma.chargeback.findMany.mockResolvedValue([]);
      mockPrisma.chargeback.count.mockResolvedValue(0);

      // Act
      const result = await service.getChargebacks({});

      // Assert
      expect(mockPrisma.chargeback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('returns empty items array when no chargebacks exist', async () => {
      // Arrange
      mockPrisma.chargeback.findMany.mockResolvedValue([]);
      mockPrisma.chargeback.count.mockResolvedValue(0);

      // Act
      const result = await service.getChargebacks({ page: 1, limit: 20 });

      // Assert
      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // getRevenueReport()
  // -------------------------------------------------------------------------
  describe('getRevenueReport()', () => {
    const START = new Date('2026-01-01T00:00:00Z');
    const END = new Date('2026-01-31T23:59:59Z');

    it('calculates totalRevenue, transactionCount and averageAmount correctly', async () => {
      // Arrange — three verified purchases: 4.99 + 9.99 + 14.99 = 29.97
      mockPrisma.playerPurchase.findMany.mockResolvedValue([
        { amountUsd: 4.99 },
        { amountUsd: 9.99 },
        { amountUsd: 14.99 },
      ]);

      // Act
      const result = await service.getRevenueReport(START, END);

      // Assert
      expect(result.totalRevenue).toBeCloseTo(29.97, 2);
      expect(result.transactionCount).toBe(3);
      expect(result.averageAmount).toBeCloseTo(9.99, 2);
    });

    it('queries only "verified" purchases within the date range', async () => {
      // Arrange
      mockPrisma.playerPurchase.findMany.mockResolvedValue([]);

      // Act
      await service.getRevenueReport(START, END);

      // Assert
      expect(mockPrisma.playerPurchase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'verified',
            createdAt: { gte: START, lte: END },
          }),
        }),
      );
    });

    it('returns zero totalRevenue and averageAmount when no verified purchases exist', async () => {
      // Arrange
      mockPrisma.playerPurchase.findMany.mockResolvedValue([]);

      // Act
      const result = await service.getRevenueReport(START, END);

      // Assert
      expect(result.totalRevenue).toBe(0);
      expect(result.transactionCount).toBe(0);
      expect(result.averageAmount).toBe(0);
    });

    it('handles a single purchase — averageAmount equals totalRevenue', async () => {
      // Arrange
      mockPrisma.playerPurchase.findMany.mockResolvedValue([{ amountUsd: 9.99 }]);

      // Act
      const result = await service.getRevenueReport(START, END);

      // Assert
      expect(result.totalRevenue).toBeCloseTo(9.99, 2);
      expect(result.transactionCount).toBe(1);
      expect(result.averageAmount).toBeCloseTo(9.99, 2);
    });

    it('rounds totalRevenue and averageAmount to 2 decimal places', async () => {
      // Arrange — 0.1 + 0.2 = 0.30000000000000004 in IEEE-754; must round to 0.30
      mockPrisma.playerPurchase.findMany.mockResolvedValue([
        { amountUsd: 0.1 },
        { amountUsd: 0.2 },
      ]);

      // Act
      const result = await service.getRevenueReport(START, END);

      // Assert
      expect(result.totalRevenue).toBe(0.3);
      expect(result.averageAmount).toBe(0.15);
    });

    it('echoes back the startDate and endDate in the response', async () => {
      // Arrange
      mockPrisma.playerPurchase.findMany.mockResolvedValue([]);

      // Act
      const result = await service.getRevenueReport(START, END);

      // Assert
      expect(result.startDate).toEqual(START);
      expect(result.endDate).toEqual(END);
    });

    it('handles same-day date range where startDate equals endDate', async () => {
      // Arrange
      const SAME_DAY = new Date('2026-03-15T00:00:00Z');
      mockPrisma.playerPurchase.findMany.mockResolvedValue([{ amountUsd: 19.99 }]);

      // Act
      const result = await service.getRevenueReport(SAME_DAY, SAME_DAY);

      // Assert
      expect(mockPrisma.playerPurchase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { gte: SAME_DAY, lte: SAME_DAY },
          }),
        }),
      );
      expect(result.totalRevenue).toBeCloseTo(19.99, 2);
      expect(result.transactionCount).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // createPurchase() — amountUsd forwarded to Prisma
  // -------------------------------------------------------------------------
  describe('createPurchase() — amountUsd persistence', () => {
    it('passes amountUsd through to Prisma create call unchanged', async () => {
      // Arrange
      const dto: any = {
        storeProductId: PRODUCT_ID,
        platform: 'ios',
        transactionId: 'txn-ios-1',
        receiptData: 'ios-receipt',
        amountUsd: 14.99,
      };
      mockPrisma.playerPurchase.create.mockResolvedValue({ ...basePurchase, amountUsd: 14.99 });

      // Act
      await service.createPurchase(USER_ID, dto);

      // Assert
      expect(mockPrisma.playerPurchase.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ amountUsd: 14.99 }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // verifyReceipt() — validationResponse is optional
  // -------------------------------------------------------------------------
  describe('verifyReceipt() — optional validationResponse', () => {
    it('succeeds and updates purchase status when validationResponse is omitted', async () => {
      // Arrange
      mockPrisma.playerPurchase.findUnique.mockResolvedValue(basePurchase);
      mockPrisma.purchaseReceipt.create.mockResolvedValue({
        id: 'receipt-uuid-2',
        purchaseId: PURCHASE_ID,
        rawReceipt: basePurchase.receiptData,
        isValid: true,
        validatedAt: new Date(),
      });
      mockPrisma.playerPurchase.update.mockResolvedValue(verifiedPurchase);

      // Act — no validationResponse field in the dto
      const result = await service.verifyReceipt(PURCHASE_ID, {
        rawReceipt: basePurchase.receiptData,
        isValid: true,
      });

      // Assert
      expect(mockPrisma.purchaseReceipt.create).toHaveBeenCalled();
      expect(mockPrisma.playerPurchase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'verified' }),
        }),
      );
      expect(result.status).toBe('verified');
    });
  });

  // -------------------------------------------------------------------------
  // createRefund() — amountUsd inherited from purchase
  // -------------------------------------------------------------------------
  describe('createRefund() — amountUsd inheritance', () => {
    it('inherits amountUsd from the purchase record rather than requiring it in the dto', async () => {
      // Arrange
      const purchase = { ...basePurchase, amountUsd: 9.99 };
      const refund = { ...baseRefund, amountUsd: 9.99 };
      mockPrisma.playerPurchase.findUnique.mockResolvedValue(purchase);
      mockPrisma.refund.findUnique.mockResolvedValue(null);
      mockPrisma.refund.create.mockResolvedValue(refund);

      // Act — dto deliberately omits amountUsd
      await service.createRefund(PURCHASE_ID, { reason: 'wrong item' });

      // Assert — Prisma receives amountUsd from the fetched purchase, not the dto
      expect(mockPrisma.refund.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ amountUsd: 9.99 }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // getPurchases() — ordering
  // -------------------------------------------------------------------------
  describe('getPurchases() — ordering', () => {
    it('orders results by createdAt descending', async () => {
      // Arrange
      mockPrisma.playerPurchase.findMany.mockResolvedValue([basePurchase]);
      mockPrisma.playerPurchase.count.mockResolvedValue(1);

      // Act
      await service.getPurchases(USER_ID, 1, 20);

      // Assert
      expect(mockPrisma.playerPurchase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // getChargebacks() — page 2 offset
  // -------------------------------------------------------------------------
  describe('getChargebacks() — page 2 pagination offset', () => {
    it('calculates correct skip offset for page 2 with limit 10', async () => {
      // Arrange
      mockPrisma.chargeback.findMany.mockResolvedValue([]);
      mockPrisma.chargeback.count.mockResolvedValue(15);

      // Act
      await service.getChargebacks({ page: 2, limit: 10 });

      // Assert — skip must be (2 - 1) * 10 = 10
      expect(mockPrisma.chargeback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // logChargeback() — reason string stored
  // -------------------------------------------------------------------------
  describe('logChargeback() — reason persistence', () => {
    it('stores the provided reason string in the chargeback record', async () => {
      // Arrange
      const reason = 'duplicate charge detected';
      const chargebackWithReason = { ...baseChargeback, reason };
      mockPrisma.chargeback.create.mockResolvedValue(chargebackWithReason);

      // Act
      const result = await service.logChargeback({
        userId: USER_ID,
        transactionId: TRANSACTION_ID,
        amountUsd: 4.99,
        reason,
      });

      // Assert
      expect(mockPrisma.chargeback.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ reason }),
        }),
      );
      expect(result.reason).toBe(reason);
    });
  });
});
