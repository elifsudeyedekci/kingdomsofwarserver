/**
 * Story Type : Controller (route delegation)
 * Output     : src/modules/store/store.controller.spec.ts
 * Gate Level : BLOCKING
 */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { StoreController } from './store.controller';
import { StoreService } from './store.service';

// ---------------------------------------------------------------------------
// Service mock
// ---------------------------------------------------------------------------

const mockService = {
  getProducts: jest.fn(),
  getProductById: jest.fn(),
  createProduct: jest.fn(),
  updateProduct: jest.fn(),
  toggleProduct: jest.fn(),
  getWallet: jest.fn(),
  adjustWallet: jest.fn(),
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PRODUCT_ID = 'product-uuid-1';
const USER_ID = 'user-uuid-1';

const baseProduct = {
  id: PRODUCT_ID,
  name: 'Starter Pack',
  description: 'A starter pack for new players',
  priceUsd: 4.99,
  currencyReward: 500,
  isActive: true,
  sortOrder: 1,
  createdAt: new Date('2026-01-01T10:00:00Z'),
  updatedAt: new Date('2026-01-01T10:00:00Z'),
};

const baseWallet = {
  id: 'wallet-uuid-1',
  userId: USER_ID,
  gems: 100,
  coins: 2000,
  chestKeys: 5,
  eventTokens: 0,
  bpXp: 0,
  updatedAt: new Date('2026-01-01T10:00:00Z'),
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('StoreController', () => {
  let controller: StoreController;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StoreController],
      providers: [
        { provide: StoreService, useValue: mockService },
      ],
    }).compile();

    controller = module.get<StoreController>(StoreController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // GET /store/products
  // -------------------------------------------------------------------------
  describe('getProducts()', () => {
    it('delegates to service with parsed page, limit and includeInactive args', async () => {
      // Arrange
      const expected = { items: [baseProduct], total: 1, page: 1, limit: 20 };
      mockService.getProducts.mockResolvedValue(expected);

      // Act
      const result = await controller.getProducts(1, 20, false);

      // Assert
      expect(mockService.getProducts).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        includeInactive: false,
      });
      expect(result).toEqual(expected);
    });

    it('caps limit at 100 before passing to service', async () => {
      // Arrange
      mockService.getProducts.mockResolvedValue({ items: [], total: 0, page: 1, limit: 100 });

      // Act
      await controller.getProducts(1, 999, false);

      // Assert — controller applies Math.min(limit, 100)
      expect(mockService.getProducts).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 100 }),
      );
    });

    it('players never get inactive products, admins can ask for them', async () => {
      mockService.getProducts.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });
      await controller.getProducts(1, 20, true, { user: { kind: 'player' } });
      expect(mockService.getProducts).toHaveBeenLastCalledWith(expect.objectContaining({ includeInactive: false }));
    });

    it('passes includeInactive: true when query flag is set', async () => {
      // Arrange
      mockService.getProducts.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });

      // Act
      await controller.getProducts(1, 20, true, { user: { kind: 'admin' } });

      // Assert
      expect(mockService.getProducts).toHaveBeenCalledWith(
        expect.objectContaining({ includeInactive: true }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // GET /store/products/:id
  // -------------------------------------------------------------------------
  describe('getProductById()', () => {
    it('returns the product returned by the service', async () => {
      // Arrange
      mockService.getProductById.mockResolvedValue(baseProduct);

      // Act
      const result = await controller.getProductById(PRODUCT_ID);

      // Assert
      expect(mockService.getProductById).toHaveBeenCalledWith(PRODUCT_ID);
      expect(result).toEqual(baseProduct);
    });

    it('propagates NotFoundException when product does not exist', async () => {
      // Arrange
      mockService.getProductById.mockRejectedValue(
        new NotFoundException(`StoreProduct nonexistent not found`),
      );

      // Act + Assert
      await expect(controller.getProductById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // POST /store/products
  // -------------------------------------------------------------------------
  describe('createProduct()', () => {
    const createDto: any = {
      name: 'Starter Pack',
      description: 'A starter pack for new players',
      priceUsd: 4.99,
      currencyReward: 500,
    };

    it('returns the created product returned by the service', async () => {
      // Arrange
      mockService.createProduct.mockResolvedValue(baseProduct);

      // Act
      const result = await controller.createProduct(createDto);

      // Assert
      expect(mockService.createProduct).toHaveBeenCalledWith(createDto);
      expect(result).toEqual(baseProduct);
    });

    it('propagates BadRequestException when priceUsd is negative', async () => {
      // Arrange
      const badDto: any = { ...createDto, priceUsd: -1 };
      mockService.createProduct.mockRejectedValue(
        new BadRequestException('priceUsd must be non-negative'),
      );

      // Act + Assert
      await expect(controller.createProduct(badDto)).rejects.toThrow(BadRequestException);
    });
  });

  // -------------------------------------------------------------------------
  // PATCH /store/products/:id
  // -------------------------------------------------------------------------
  describe('updateProduct()', () => {
    const updateDto: any = { name: 'Updated Pack', priceUsd: 9.99 };

    it('delegates to service with id and dto, returns updated product', async () => {
      // Arrange
      const updatedProduct = { ...baseProduct, ...updateDto };
      mockService.updateProduct.mockResolvedValue(updatedProduct);

      // Act
      const result = await controller.updateProduct(PRODUCT_ID, updateDto);

      // Assert
      expect(mockService.updateProduct).toHaveBeenCalledWith(PRODUCT_ID, updateDto);
      expect(result).toEqual(updatedProduct);
    });

    it('propagates NotFoundException when the product does not exist', async () => {
      // Arrange
      mockService.updateProduct.mockRejectedValue(
        new NotFoundException(`StoreProduct nonexistent not found`),
      );

      // Act + Assert
      await expect(controller.updateProduct('nonexistent', updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // -------------------------------------------------------------------------
  // POST /store/products/:id/toggle
  // -------------------------------------------------------------------------
  describe('toggleProduct()', () => {
    it('delegates to service with the product id and returns toggled product', async () => {
      // Arrange
      const toggled = { ...baseProduct, isActive: false };
      mockService.toggleProduct.mockResolvedValue(toggled);

      // Act
      const result = await controller.toggleProduct(PRODUCT_ID);

      // Assert
      expect(mockService.toggleProduct).toHaveBeenCalledWith(PRODUCT_ID);
      expect(result).toEqual(toggled);
    });

    it('propagates NotFoundException when product to toggle does not exist', async () => {
      // Arrange
      mockService.toggleProduct.mockRejectedValue(
        new NotFoundException(`StoreProduct nonexistent not found`),
      );

      // Act + Assert
      await expect(controller.toggleProduct('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // GET /store/wallet/:userId
  // -------------------------------------------------------------------------
  describe('getWallet()', () => {
    it('returns the wallet for the given userId', async () => {
      // Arrange
      mockService.getWallet.mockResolvedValue(baseWallet);

      // Act
      const result = await controller.getWallet(USER_ID);

      // Assert
      expect(mockService.getWallet).toHaveBeenCalledWith(USER_ID);
      expect(result).toEqual(baseWallet);
    });

    it('propagates NotFoundException when wallet does not exist', async () => {
      // Arrange
      mockService.getWallet.mockRejectedValue(
        new NotFoundException(`Wallet not found for user unknown`),
      );

      // Act + Assert
      await expect(controller.getWallet('unknown')).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // POST /store/wallet/:userId/adjust
  // -------------------------------------------------------------------------
  describe('adjustWallet()', () => {
    const adjustDto: any = { gems: 50, coins: -100 };

    it('delegates to service with userId and dto, returns updated wallet', async () => {
      // Arrange
      const updatedWallet = { ...baseWallet, gems: 150, coins: 1900 };
      mockService.adjustWallet.mockResolvedValue(updatedWallet);

      // Act
      const result = await controller.adjustWallet(USER_ID, adjustDto);

      // Assert
      expect(mockService.adjustWallet).toHaveBeenCalledWith(USER_ID, adjustDto);
      expect(result).toEqual(updatedWallet);
    });

    it('propagates BadRequestException when deduction would drive a currency below zero', async () => {
      // Arrange
      const overdraftDto: any = { coins: -999999 };
      mockService.adjustWallet.mockRejectedValue(
        new BadRequestException('Insufficient coins: current 2000, requested delta -999999'),
      );

      // Act + Assert
      await expect(controller.adjustWallet(USER_ID, overdraftDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
