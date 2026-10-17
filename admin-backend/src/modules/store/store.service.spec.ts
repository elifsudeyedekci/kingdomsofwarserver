/**
 * Story Type : Logic (service-layer data operations)
 * Output     : tests/unit/store/  (co-located NestJS convention)
 * Gate Level : BLOCKING
 *
 * Covers every public method of StoreService as implemented:
 *   getProducts · getProductById · createProduct · updateProduct
 *   toggleProduct · getWallet · adjustWallet
 *
 * playerPurchase / playerInventory are NOT yet part of StoreService;
 * those tables will get their own suite when the purchase flow is added.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { StoreService } from './store.service';
import { PrismaService } from '../../database/prisma.service';

// ---------------------------------------------------------------------------
// Prisma mock — only the tables that StoreService actually touches
// ---------------------------------------------------------------------------

const mockPrisma: any = {
  storeProduct: {
    findMany:   jest.fn(),
    findUnique: jest.fn(),
    create:     jest.fn(),
    update:     jest.fn(),
    count:      jest.fn(),
  },
  playerWallet: {
    findUnique: jest.fn(),
    update:     jest.fn(),
  },
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PRODUCT_ID = 'product-uuid-1';
const USER_ID = 'user-uuid-1';

const activeProduct = {
  id: PRODUCT_ID,
  skuAndroid: 'com.kowgame.gems_500',
  skuIos: 'gems_500',
  nameKey: 'store.gems_500.name',
  descKey: 'store.gems_500.desc',
  priceUsd: 4.99,
  localPrices: { TR: 149.99 },
  contents: { gems: 500 },
  isActive: true,
  isConsumable: true,
  segment: null,
  countries: [],
  minVersion: null,
  sortOrder: 1,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const inactiveProduct = { ...activeProduct, id: 'product-uuid-inactive', isActive: false };

const playerWallet = {
  id: 'wallet-uuid-1',
  userId: USER_ID,
  coins: 1000,
  gems: 200,
  chestKeys: 5,
  eventTokens: 0,
  bpXp: 0,
  updatedAt: new Date(),
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('StoreService', () => {
  let service: StoreService;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoreService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<StoreService>(StoreService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // getProducts()
  // -------------------------------------------------------------------------
  describe('getProducts()', () => {
    it('returns only active products by default', async () => {
      mockPrisma.storeProduct.findMany.mockResolvedValue([activeProduct]);
      mockPrisma.storeProduct.count.mockResolvedValue(1);

      const result = await service.getProducts({ page: 1, limit: 20 });

      expect(mockPrisma.storeProduct.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }),
        }),
      );
      expect(result.items).toHaveLength(1);
      expect(result.items[0].isActive).toBe(true);
    });

    it('includes inactive products when includeInactive flag is true', async () => {
      mockPrisma.storeProduct.findMany.mockResolvedValue([activeProduct, inactiveProduct]);
      mockPrisma.storeProduct.count.mockResolvedValue(2);

      const result = await service.getProducts({ page: 1, limit: 20, includeInactive: true });

      expect(mockPrisma.storeProduct.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.not.objectContaining({ isActive: true }) }),
      );
      expect(result.total).toBe(2);
    });

    it('returns empty list when no products exist', async () => {
      mockPrisma.storeProduct.findMany.mockResolvedValue([]);
      mockPrisma.storeProduct.count.mockResolvedValue(0);

      const result = await service.getProducts({ page: 1, limit: 20 });

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('orders results by sortOrder ascending', async () => {
      mockPrisma.storeProduct.findMany.mockResolvedValue([activeProduct]);
      mockPrisma.storeProduct.count.mockResolvedValue(1);

      await service.getProducts({ page: 1, limit: 20 });

      expect(mockPrisma.storeProduct.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: expect.objectContaining({ sortOrder: 'asc' }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // getProductById()
  // -------------------------------------------------------------------------
  describe('getProductById()', () => {
    it('returns the product when found', async () => {
      mockPrisma.storeProduct.findUnique.mockResolvedValue(activeProduct);

      const result = await service.getProductById(PRODUCT_ID);

      expect(mockPrisma.storeProduct.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: PRODUCT_ID } }),
      );
      expect(result).toEqual(activeProduct);
    });

    it('throws NotFoundException when product does not exist', async () => {
      mockPrisma.storeProduct.findUnique.mockResolvedValue(null);

      await expect(service.getProductById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // createProduct()
  // -------------------------------------------------------------------------
  describe('createProduct()', () => {
    const createDto = {
      skuAndroid: 'com.kowgame.gems_1000',
      skuIos: 'gems_1000',
      nameKey: 'store.gems_1000.name',
      priceUsd: 9.99,
      contents: { gems: 1000 },
      isConsumable: true,
    };

    it('creates and returns a new store product', async () => {
      const newProduct = { id: 'product-uuid-new', ...createDto, isActive: true, sortOrder: 0 };
      mockPrisma.storeProduct.create.mockResolvedValue(newProduct);

      const result = await service.createProduct(createDto);

      expect(mockPrisma.storeProduct.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining(createDto) }),
      );
      expect(result.id).toBe('product-uuid-new');
    });

    it('throws BadRequestException when priceUsd is negative', async () => {
      await expect(
        service.createProduct({ ...createDto, priceUsd: -1 }),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.storeProduct.create).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // updateProduct()
  // -------------------------------------------------------------------------
  describe('updateProduct()', () => {
    it('updates allowed fields and returns the updated product', async () => {
      const updated = { ...activeProduct, priceUsd: 5.99, sortOrder: 2 };
      mockPrisma.storeProduct.findUnique.mockResolvedValue(activeProduct);
      mockPrisma.storeProduct.update.mockResolvedValue(updated);

      const result = await service.updateProduct(PRODUCT_ID, { priceUsd: 5.99, sortOrder: 2 });

      expect(mockPrisma.storeProduct.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: PRODUCT_ID },
          data: expect.objectContaining({ priceUsd: 5.99, sortOrder: 2 }),
        }),
      );
      expect(result.priceUsd).toBe(5.99);
    });

    it('throws NotFoundException when product to update does not exist', async () => {
      mockPrisma.storeProduct.findUnique.mockResolvedValue(null);

      await expect(service.updateProduct('nonexistent', { priceUsd: 5.99 })).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.storeProduct.update).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // toggleProduct()
  // -------------------------------------------------------------------------
  describe('toggleProduct()', () => {
    it('deactivates an active product', async () => {
      const toggled = { ...activeProduct, isActive: false };
      mockPrisma.storeProduct.findUnique.mockResolvedValue(activeProduct);
      mockPrisma.storeProduct.update.mockResolvedValue(toggled);

      const result = await service.toggleProduct(PRODUCT_ID);

      expect(mockPrisma.storeProduct.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: PRODUCT_ID },
          data:  { isActive: false },
        }),
      );
      expect(result.isActive).toBe(false);
    });

    it('activates an inactive product', async () => {
      const toggled = { ...inactiveProduct, isActive: true };
      mockPrisma.storeProduct.findUnique.mockResolvedValue(inactiveProduct);
      mockPrisma.storeProduct.update.mockResolvedValue(toggled);

      const result = await service.toggleProduct(inactiveProduct.id);

      expect(mockPrisma.storeProduct.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: inactiveProduct.id },
          data:  { isActive: true },
        }),
      );
      expect(result.isActive).toBe(true);
    });

    it('throws NotFoundException when product does not exist', async () => {
      mockPrisma.storeProduct.findUnique.mockResolvedValue(null);

      await expect(service.toggleProduct('nonexistent')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.storeProduct.update).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // getWallet()
  // -------------------------------------------------------------------------
  describe('getWallet()', () => {
    it('returns the wallet for the given user', async () => {
      mockPrisma.playerWallet.findUnique.mockResolvedValue(playerWallet);

      const result = await service.getWallet(USER_ID);

      expect(mockPrisma.playerWallet.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: USER_ID } }),
      );
      expect(result.gems).toBe(200);
    });

    it('throws NotFoundException when wallet does not exist for user', async () => {
      mockPrisma.playerWallet.findUnique.mockResolvedValue(null);

      await expect(service.getWallet('unknown-user')).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // adjustWallet()
  // -------------------------------------------------------------------------
  describe('adjustWallet()', () => {
    it('credits gems to player wallet and returns updated wallet', async () => {
      const updatedWallet = { ...playerWallet, gems: 700 };
      mockPrisma.playerWallet.findUnique.mockResolvedValue(playerWallet);
      mockPrisma.playerWallet.update.mockResolvedValue(updatedWallet);

      const result = await service.adjustWallet(USER_ID, { gems: 500 });

      expect(mockPrisma.playerWallet.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: USER_ID },
          data: expect.objectContaining({ gems: 700 }),
        }),
      );
      expect(result.gems).toBe(700);
    });

    it('throws NotFoundException when wallet does not exist for the user', async () => {
      mockPrisma.playerWallet.findUnique.mockResolvedValue(null);

      await expect(service.adjustWallet('unknown-user', { gems: 100 })).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.playerWallet.update).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when adjustment would make a currency negative', async () => {
      mockPrisma.playerWallet.findUnique.mockResolvedValue(playerWallet);

      // playerWallet.gems = 200; deducting 500 should fail
      await expect(service.adjustWallet(USER_ID, { gems: -500 })).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrisma.playerWallet.update).not.toHaveBeenCalled();
    });

    it('applies delta only for fields supplied in the dto', async () => {
      // Only coins supplied — gems must NOT appear in the update payload
      const updatedWallet = { ...playerWallet, coins: 1500 };
      mockPrisma.playerWallet.findUnique.mockResolvedValue(playerWallet);
      mockPrisma.playerWallet.update.mockResolvedValue(updatedWallet);

      const result = await service.adjustWallet(USER_ID, { coins: 500 });

      const updateCall = mockPrisma.playerWallet.update.mock.calls[0][0];
      expect(updateCall.data).not.toHaveProperty('gems');
      expect(updateCall.data.coins).toBe(1500);
      expect(result.coins).toBe(1500);
    });

    it('allows deducting a currency to exactly zero (boundary)', async () => {
      // playerWallet.gems = 200; deducting exactly 200 must succeed
      const updatedWallet = { ...playerWallet, gems: 0 };
      mockPrisma.playerWallet.findUnique.mockResolvedValue(playerWallet);
      mockPrisma.playerWallet.update.mockResolvedValue(updatedWallet);

      await expect(service.adjustWallet(USER_ID, { gems: -200 })).resolves.toEqual(updatedWallet);
    });

    it('throws BadRequestException on coins underflow even when gems delta is valid', async () => {
      // coins = 1000; deducting 2000 must fail regardless of other valid fields
      mockPrisma.playerWallet.findUnique.mockResolvedValue(playerWallet);

      await expect(service.adjustWallet(USER_ID, { gems: 50, coins: -2000 })).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrisma.playerWallet.update).not.toHaveBeenCalled();
    });
  });
});
