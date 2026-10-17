/**
 * InventoryService — unit tests
 *
 * Key invariant: there is NO `equipped` boolean column in the Prisma schema.
 * The equip state is encoded entirely in the `source` column using the sentinel
 * prefix "equipped:" (e.g. source "equipped:purchase" means equipped, source
 * "purchase" means not equipped, null means not equipped).
 *
 * All tests exercise this sentinel encoding directly — no `equipped` field
 * appears in raw DB rows, and `equipped` on response objects is always DERIVED
 * by the service's mapItem() function from source.startsWith("equipped:").
 */

import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from './inventory.service';
import { PrismaService } from '../../database/prisma.service';
import { GrantItemDto } from './dto/grant-item.dto';

// ---------------------------------------------------------------------------
// Prisma mock — includes findFirst and $transaction for equip/unequip paths
// ---------------------------------------------------------------------------
const mockPrisma: any = {
  playerInventory: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
  },
  user: { findUnique: jest.fn() },
  $transaction: jest.fn(),
};

// ---------------------------------------------------------------------------
// Raw DB row helper — NO `equipped` field; equipped state lives in `source`
// ---------------------------------------------------------------------------
const makeRawRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'item-uuid-1',
  userId: 'user-uuid-1',
  itemType: 'skin',
  itemId: 'skin_001',
  quantity: 1,
  expiresAt: null,
  obtainedAt: new Date('2026-01-01'),
  source: 'purchase',
  ...overrides,
});

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------
describe('InventoryService', () => {
  let service: InventoryService;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
  });

  // -------------------------------------------------------------------------
  // getInventory(userId, page, limit)
  // -------------------------------------------------------------------------
  describe('getInventory()', () => {
    const USER_ID = 'user-uuid-1';

    it('returns paginated result with the key "items" (not "data")', async () => {
      const rows = [makeRawRow(), makeRawRow({ id: 'item-uuid-2', itemId: 'skin_002' })];
      mockPrisma.playerInventory.findMany.mockResolvedValue(rows);
      mockPrisma.playerInventory.count.mockResolvedValue(2);

      const result = await service.getInventory(USER_ID, 1, 20);

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('total', 2);
      expect(result).toHaveProperty('page', 1);
      expect(result).toHaveProperty('limit', 20);
      // Confirm it is NOT using the "data" key from the old stub spec
      expect(result).not.toHaveProperty('data');
    });

    it('derives equipped=false from source "purchase" (no sentinel prefix)', async () => {
      const row = makeRawRow({ source: 'purchase' });
      mockPrisma.playerInventory.findMany.mockResolvedValue([row]);
      mockPrisma.playerInventory.count.mockResolvedValue(1);

      const result = await service.getInventory(USER_ID, 1, 20);

      expect(result.items[0].equipped).toBe(false);
    });

    it('derives equipped=true from source "equipped:purchase" (sentinel prefix)', async () => {
      const row = makeRawRow({ source: 'equipped:purchase' });
      mockPrisma.playerInventory.findMany.mockResolvedValue([row]);
      mockPrisma.playerInventory.count.mockResolvedValue(1);

      const result = await service.getInventory(USER_ID, 1, 20);

      expect(result.items[0].equipped).toBe(true);
    });

    it('strips "equipped:" prefix from source in the response', async () => {
      const row = makeRawRow({ source: 'equipped:purchase' });
      mockPrisma.playerInventory.findMany.mockResolvedValue([row]);
      mockPrisma.playerInventory.count.mockResolvedValue(1);

      const result = await service.getInventory(USER_ID, 1, 20);

      // The response source should be the decoded original, not the sentinel
      expect(result.items[0].source).toBe('purchase');
    });

    it('returns empty items array when user has no items', async () => {
      mockPrisma.playerInventory.findMany.mockResolvedValue([]);
      mockPrisma.playerInventory.count.mockResolvedValue(0);

      const result = await service.getInventory(USER_ID, 1, 20);

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('applies correct skip/take pagination for page 2 limit 10', async () => {
      mockPrisma.playerInventory.findMany.mockResolvedValue([]);
      mockPrisma.playerInventory.count.mockResolvedValue(0);

      await service.getInventory(USER_ID, 2, 10);

      expect(mockPrisma.playerInventory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });

    it('filters both findMany and count by userId', async () => {
      mockPrisma.playerInventory.findMany.mockResolvedValue([]);
      mockPrisma.playerInventory.count.mockResolvedValue(0);

      await service.getInventory(USER_ID, 1, 20);

      expect(mockPrisma.playerInventory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ userId: USER_ID }) }),
      );
      expect(mockPrisma.playerInventory.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ userId: USER_ID }) }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // getInventoryItem(id)
  // -------------------------------------------------------------------------
  describe('getInventoryItem()', () => {
    it('returns mapped item with equipped derived from source', async () => {
      const row = makeRawRow({ source: 'equipped:event_reward' });
      mockPrisma.playerInventory.findUnique.mockResolvedValue(row);

      const result = await service.getInventoryItem('item-uuid-1');

      expect(result.equipped).toBe(true);
      expect(result.source).toBe('event_reward');
      expect(result.id).toBe('item-uuid-1');
    });

    it('returns equipped=false when source has no sentinel prefix', async () => {
      const row = makeRawRow({ source: 'purchase' });
      mockPrisma.playerInventory.findUnique.mockResolvedValue(row);

      const result = await service.getInventoryItem('item-uuid-1');

      expect(result.equipped).toBe(false);
      expect(result.source).toBe('purchase');
    });

    it('throws NotFoundException when item does not exist', async () => {
      mockPrisma.playerInventory.findUnique.mockResolvedValue(null);

      await expect(service.getInventoryItem('nonexistent-id')).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // equipItem(userId, itemId)
  //
  // Uses $transaction. We wire it as (fn) => fn(mockPrisma) so the nested
  // tx.playerInventory.* calls resolve against the same mocks.
  // -------------------------------------------------------------------------
  describe('equipItem()', () => {
    const USER_ID = 'user-uuid-1';
    const ITEM_ID = 'item-uuid-1';
    const ITEM_TYPE = 'skin';

    beforeEach(() => {
      // Wire $transaction to immediately invoke the callback with mockPrisma as tx
      mockPrisma.$transaction.mockImplementation((fn: (tx: any) => Promise<any>) =>
        fn(mockPrisma),
      );
    });

    it('sets source to "equipped:<originalSource>" on the target item', async () => {
      const target = makeRawRow({ id: ITEM_ID, userId: USER_ID, itemType: ITEM_TYPE, source: 'purchase' });
      const updatedRow = makeRawRow({ id: ITEM_ID, userId: USER_ID, itemType: ITEM_TYPE, source: 'equipped:purchase' });

      mockPrisma.playerInventory.findFirst.mockResolvedValue(target);
      // No siblings to unequip
      mockPrisma.playerInventory.findMany.mockResolvedValue([]);
      // Final re-fetch after transaction
      mockPrisma.playerInventory.findUnique.mockResolvedValue(updatedRow);

      const result = await service.equipItem(USER_ID, ITEM_ID);

      expect(result.equipped).toBe(true);
      expect(result.source).toBe('purchase');
    });

    it('calls $transaction', async () => {
      const target = makeRawRow({ id: ITEM_ID, userId: USER_ID, itemType: ITEM_TYPE, source: 'purchase' });
      const updatedRow = makeRawRow({ id: ITEM_ID, userId: USER_ID, source: 'equipped:purchase' });

      mockPrisma.playerInventory.findFirst.mockResolvedValue(target);
      mockPrisma.playerInventory.findMany.mockResolvedValue([]);
      mockPrisma.playerInventory.findUnique.mockResolvedValue(updatedRow);

      await service.equipItem(USER_ID, ITEM_ID);

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('unequips sibling items of the same itemType by stripping the sentinel prefix', async () => {
      const target = makeRawRow({ id: ITEM_ID, userId: USER_ID, itemType: ITEM_TYPE, source: 'purchase' });
      const sibling = { id: 'sibling-uuid-1', source: 'equipped:purchase' };
      const updatedRow = makeRawRow({ id: ITEM_ID, source: 'equipped:purchase' });

      mockPrisma.playerInventory.findFirst.mockResolvedValue(target);
      // findMany inside the transaction returns the sibling
      mockPrisma.playerInventory.findMany.mockResolvedValue([sibling]);
      mockPrisma.playerInventory.update.mockResolvedValue({});
      mockPrisma.playerInventory.findUnique.mockResolvedValue(updatedRow);

      await service.equipItem(USER_ID, ITEM_ID);

      // The sibling update must strip the prefix — data.source should be the decoded original
      const siblingUpdateCall = mockPrisma.playerInventory.update.mock.calls.find(
        (call: any[]) => call[0].where.id === 'sibling-uuid-1',
      );
      expect(siblingUpdateCall).toBeDefined();
      // After stripping "equipped:" from "equipped:purchase" → "purchase"
      expect(siblingUpdateCall[0].data.source).toBe('purchase');
    });

    it('queries siblings using source.startsWith filter (NOT equipped: true)', async () => {
      const target = makeRawRow({ id: ITEM_ID, userId: USER_ID, itemType: ITEM_TYPE, source: 'purchase' });
      const updatedRow = makeRawRow({ id: ITEM_ID, source: 'equipped:purchase' });

      mockPrisma.playerInventory.findFirst.mockResolvedValue(target);
      mockPrisma.playerInventory.findMany.mockResolvedValue([]);
      mockPrisma.playerInventory.findUnique.mockResolvedValue(updatedRow);

      await service.equipItem(USER_ID, ITEM_ID);

      // The findMany inside the transaction must use startsWith, not equipped: true
      expect(mockPrisma.playerInventory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            source: expect.objectContaining({ startsWith: 'equipped:' }),
          }),
        }),
      );
    });

    it('throws NotFoundException when the item does not exist for this user', async () => {
      mockPrisma.playerInventory.findFirst.mockResolvedValue(null);

      await expect(service.equipItem(USER_ID, 'ghost-id')).rejects.toThrow(NotFoundException);
    });

    it('does not call $transaction when item is not found', async () => {
      mockPrisma.playerInventory.findFirst.mockResolvedValue(null);

      await expect(service.equipItem(USER_ID, 'ghost-id')).rejects.toThrow();

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // unequipItem(userId, itemId)
  // -------------------------------------------------------------------------
  describe('unequipItem()', () => {
    const USER_ID = 'user-uuid-1';
    const ITEM_ID = 'item-uuid-1';

    it('strips the "equipped:" prefix so item is no longer equipped', async () => {
      const target = makeRawRow({ id: ITEM_ID, userId: USER_ID, source: 'equipped:purchase' });
      const updatedRow = makeRawRow({ id: ITEM_ID, userId: USER_ID, source: 'purchase' });

      mockPrisma.playerInventory.findFirst.mockResolvedValue(target);
      mockPrisma.playerInventory.update.mockResolvedValue(updatedRow);

      const result = await service.unequipItem(USER_ID, ITEM_ID);

      expect(result.equipped).toBe(false);
    });

    it('writes the decoded original source (not null) back to the DB', async () => {
      const target = makeRawRow({ id: ITEM_ID, userId: USER_ID, source: 'equipped:event_reward' });
      const updatedRow = makeRawRow({ id: ITEM_ID, userId: USER_ID, source: 'event_reward' });

      mockPrisma.playerInventory.findFirst.mockResolvedValue(target);
      mockPrisma.playerInventory.update.mockResolvedValue(updatedRow);

      await service.unequipItem(USER_ID, ITEM_ID);

      expect(mockPrisma.playerInventory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: ITEM_ID },
          data: expect.objectContaining({ source: 'event_reward' }),
        }),
      );
    });

    it('throws NotFoundException when item is not found for this user', async () => {
      mockPrisma.playerInventory.findFirst.mockResolvedValue(null);

      await expect(service.unequipItem(USER_ID, 'ghost-id')).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // grantItem(dto)
  // -------------------------------------------------------------------------
  describe('grantItem()', () => {
    const dto: GrantItemDto = {
      userId: 'user-uuid-1',
      itemType: 'icon',
      itemId: 'icon_crown',
      quantity: 1,
      source: 'event_reward',
    };

    it('creates an inventory record with the correct fields', async () => {
      const userRow = { id: dto.userId, deletedAt: null };
      const createdRow = makeRawRow({
        userId: dto.userId,
        itemType: dto.itemType,
        itemId: dto.itemId,
        source: 'event_reward',
      });

      mockPrisma.user.findUnique.mockResolvedValue(userRow);
      mockPrisma.playerInventory.create.mockResolvedValue(createdRow);

      const result = await service.grantItem(dto);

      expect(mockPrisma.playerInventory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: dto.userId,
            itemType: dto.itemType,
            itemId: dto.itemId,
            quantity: 1,
          }),
        }),
      );
      expect(result.itemId).toBe('icon_crown');
    });

    it('defaults source to "admin_grant" when dto.source is not provided', async () => {
      const dtoNoSource: GrantItemDto = {
        userId: 'user-uuid-1',
        itemType: 'skin',
        itemId: 'skin_001',
      };
      const createdRow = makeRawRow({ source: 'admin_grant' });

      mockPrisma.user.findUnique.mockResolvedValue({ id: dtoNoSource.userId, deletedAt: null });
      mockPrisma.playerInventory.create.mockResolvedValue(createdRow);

      await service.grantItem(dtoNoSource);

      expect(mockPrisma.playerInventory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ source: 'admin_grant' }),
        }),
      );
    });

    it('throws NotFoundException when user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.grantItem(dto)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.playerInventory.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when user is soft-deleted (deletedAt set)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: dto.userId, deletedAt: new Date() });

      await expect(service.grantItem(dto)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.playerInventory.create).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // removeItem(id)
  // -------------------------------------------------------------------------
  describe('removeItem()', () => {
    const ITEM_ID = 'item-uuid-1';

    it('deletes the item when it exists', async () => {
      mockPrisma.playerInventory.findUnique.mockResolvedValue({ id: ITEM_ID });
      mockPrisma.playerInventory.delete.mockResolvedValue(undefined);

      await service.removeItem(ITEM_ID);

      expect(mockPrisma.playerInventory.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: ITEM_ID } }),
      );
    });

    it('throws NotFoundException before calling delete when item does not exist', async () => {
      mockPrisma.playerInventory.findUnique.mockResolvedValue(null);

      await expect(service.removeItem('nonexistent-id')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.playerInventory.delete).not.toHaveBeenCalled();
    });

    it('calls delete exactly once', async () => {
      mockPrisma.playerInventory.findUnique.mockResolvedValue({ id: ITEM_ID });
      mockPrisma.playerInventory.delete.mockResolvedValue(undefined);

      await service.removeItem(ITEM_ID);

      expect(mockPrisma.playerInventory.delete).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // getEquipped(userId)
  // -------------------------------------------------------------------------
  describe('getEquipped()', () => {
    const USER_ID = 'user-uuid-1';

    it('queries with source.startsWith("equipped:") — NOT equipped: true', async () => {
      mockPrisma.playerInventory.findMany.mockResolvedValue([]);

      await service.getEquipped(USER_ID);

      expect(mockPrisma.playerInventory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: USER_ID,
            source: expect.objectContaining({ startsWith: 'equipped:' }),
          }),
        }),
      );
      // Confirm the query does NOT use a boolean equipped field
      const callArg = mockPrisma.playerInventory.findMany.mock.calls[0][0];
      expect(callArg.where).not.toHaveProperty('equipped');
    });

    it('returns mapped items with equipped=true derived from source', async () => {
      const rows = [
        makeRawRow({ id: 'item-uuid-1', itemType: 'skin', source: 'equipped:purchase' }),
        makeRawRow({ id: 'item-uuid-2', itemType: 'icon', source: 'equipped:event_reward' }),
      ];
      mockPrisma.playerInventory.findMany.mockResolvedValue(rows);

      const result = await service.getEquipped(USER_ID);

      expect(result).toHaveLength(2);
      expect(result.every((i) => i.equipped === true)).toBe(true);
    });

    it('returns empty array when user has no equipped items', async () => {
      mockPrisma.playerInventory.findMany.mockResolvedValue([]);

      const result = await service.getEquipped(USER_ID);

      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // getInventoryStats(userId)
  // -------------------------------------------------------------------------
  describe('getInventoryStats()', () => {
    const USER_ID = 'user-uuid-1';

    it('counts equippedCount from items whose source starts with "equipped:"', async () => {
      const rows = [
        { itemType: 'skin',  quantity: 1, source: 'equipped:purchase',    expiresAt: null },
        { itemType: 'skin',  quantity: 1, source: 'purchase',             expiresAt: null },
        { itemType: 'icon',  quantity: 1, source: 'equipped:event_reward', expiresAt: null },
      ];
      mockPrisma.playerInventory.findMany.mockResolvedValue(rows);

      const result = await service.getInventoryStats(USER_ID);

      // 2 items have the sentinel prefix
      expect(result.equippedCount).toBe(2);
    });

    it('does NOT count items without the sentinel prefix as equipped', async () => {
      const rows = [
        { itemType: 'skin', quantity: 1, source: 'purchase',      expiresAt: null },
        { itemType: 'skin', quantity: 1, source: null,            expiresAt: null },
        { itemType: 'skin', quantity: 1, source: 'admin_grant',   expiresAt: null },
      ];
      mockPrisma.playerInventory.findMany.mockResolvedValue(rows);

      const result = await service.getInventoryStats(USER_ID);

      expect(result.equippedCount).toBe(0);
    });

    it('builds correct categoryBreakdown with equippedCount per category', async () => {
      const rows = [
        { itemType: 'skin', quantity: 2, source: 'equipped:purchase',  expiresAt: null },
        { itemType: 'skin', quantity: 1, source: 'purchase',           expiresAt: null },
        { itemType: 'icon', quantity: 1, source: 'equipped:reward',    expiresAt: null },
      ];
      mockPrisma.playerInventory.findMany.mockResolvedValue(rows);

      const result = await service.getInventoryStats(USER_ID);

      expect(result.categoryBreakdown['skin']).toEqual({ count: 3, equippedCount: 1 });
      expect(result.categoryBreakdown['icon']).toEqual({ count: 1, equippedCount: 1 });
    });

    it('totals item quantities (not unique entries) for totalItems', async () => {
      const rows = [
        { itemType: 'currency', quantity: 100, source: null, expiresAt: null },
        { itemType: 'currency', quantity: 50,  source: null, expiresAt: null },
      ];
      mockPrisma.playerInventory.findMany.mockResolvedValue(rows);

      const result = await service.getInventoryStats(USER_ID);

      expect(result.totalItems).toBe(150);
      expect(result.uniqueEntries).toBe(2);
    });

    it('counts expiredCount correctly for items with expiresAt in the past', async () => {
      const past = new Date(Date.now() - 1000 * 60 * 60 * 24); // yesterday
      const future = new Date(Date.now() + 1000 * 60 * 60 * 24); // tomorrow
      const rows = [
        { itemType: 'skin', quantity: 1, source: null, expiresAt: past },
        { itemType: 'skin', quantity: 1, source: null, expiresAt: future },
        { itemType: 'skin', quantity: 1, source: null, expiresAt: null },
      ];
      mockPrisma.playerInventory.findMany.mockResolvedValue(rows);

      const result = await service.getInventoryStats(USER_ID);

      expect(result.expiredCount).toBe(1);
    });

    it('returns userId in the stats result', async () => {
      mockPrisma.playerInventory.findMany.mockResolvedValue([]);

      const result = await service.getInventoryStats(USER_ID);

      expect(result.userId).toBe(USER_ID);
    });
  });
});
