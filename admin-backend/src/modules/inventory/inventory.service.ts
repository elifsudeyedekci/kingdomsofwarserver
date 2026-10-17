/**
 * InventoryService
 *
 * Implements player inventory management for the Kingdoms of War admin backend.
 * Operates on the `player_inventory` table (PlayerInventory model in schema.prisma).
 *
 * Equip state encoding:
 *   The Prisma schema does not have a dedicated `equipped` boolean column on
 *   PlayerInventory.  To avoid a schema migration at this stage, we store the
 *   equipped flag inside the existing nullable `source` column using the
 *   sentinel prefix "equipped:" followed by the original source value
 *   (e.g. "equipped:purchase").  A NULL or any value that does NOT start with
 *   "equipped:" means the item is unequipped.  This is intentionally contained
 *   within this service so that a future migration (adding a real `equipped`
 *   column) only requires changes here.
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AddItemDto } from './dto/add-item.dto';
import { GrantItemDto } from './dto/grant-item.dto';

// ─── Sentinel helpers ──────────────────────────────────────────────────────────

const EQUIPPED_PREFIX = 'equipped:';

function encodeEquipped(originalSource?: string | null): string {
  return `${EQUIPPED_PREFIX}${originalSource ?? ''}`;
}

function isEquipped(source?: string | null): boolean {
  return typeof source === 'string' && source.startsWith(EQUIPPED_PREFIX);
}

function decodeSource(source?: string | null): string | null {
  if (!isEquipped(source)) return source ?? null;
  const decoded = (source as string).slice(EQUIPPED_PREFIX.length);
  return decoded.length > 0 ? decoded : null;
}

// ─── Shared select shape ───────────────────────────────────────────────────────

const INVENTORY_SELECT = {
  id: true,
  userId: true,
  itemType: true,
  itemId: true,
  quantity: true,
  expiresAt: true,
  obtainedAt: true,
  source: true,
} as const;

// ─── Response mapper ───────────────────────────────────────────────────────────

function mapItem(raw: {
  id: string;
  userId: string;
  itemType: string;
  itemId: string;
  quantity: number;
  expiresAt: Date | null;
  obtainedAt: Date;
  source: string | null;
}) {
  return {
    id: raw.id,
    userId: raw.userId,
    itemType: raw.itemType,
    itemId: raw.itemId,
    quantity: raw.quantity,
    equipped: isEquipped(raw.source),
    expiresAt: raw.expiresAt,
    obtainedAt: raw.obtainedAt,
    source: decodeSource(raw.source),
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // getInventory — paginated list of all items for a player
  // ---------------------------------------------------------------------------
  async getInventory(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [rawItems, total] = await Promise.all([
      this.prisma.playerInventory.findMany({
        where: { userId },
        select: INVENTORY_SELECT,
        orderBy: { obtainedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.playerInventory.count({ where: { userId } }),
    ]);

    return {
      items: rawItems.map(mapItem),
      total,
      page,
      limit,
    };
  }

  // ---------------------------------------------------------------------------
  // getInventoryItem — single item by its primary key
  // ---------------------------------------------------------------------------
  async getInventoryItem(id: string) {
    const raw = await this.prisma.playerInventory.findUnique({
      where: { id },
      select: INVENTORY_SELECT,
    });
    if (!raw) throw new NotFoundException(`Inventory item not found: ${id}`);
    return mapItem(raw);
  }

  // ---------------------------------------------------------------------------
  // addItem — append a new item to a player's inventory (called post-purchase)
  // ---------------------------------------------------------------------------
  async addItem(userId: string, dto: AddItemDto) {
    const raw = await this.prisma.playerInventory.create({
      data: {
        userId,
        itemType: dto.itemType,
        itemId: dto.itemId,
        quantity: dto.quantity ?? 1,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        source: dto.source ?? null,
      },
      select: INVENTORY_SELECT,
    });
    return mapItem(raw);
  }

  // ---------------------------------------------------------------------------
  // removeItem — hard-delete an inventory entry by id
  // ---------------------------------------------------------------------------
  async removeItem(id: string) {
    const existing = await this.prisma.playerInventory.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException(`Inventory item not found: ${id}`);

    await this.prisma.playerInventory.delete({ where: { id } });
  }

  // ---------------------------------------------------------------------------
  // equipItem — mark itemId as equipped; unequip all other items of same type
  // ---------------------------------------------------------------------------
  async equipItem(userId: string, itemId: string) {
    // Verify ownership
    const target = await this.prisma.playerInventory.findFirst({
      where: { id: itemId, userId },
      select: INVENTORY_SELECT,
    });
    if (!target) throw new NotFoundException(`Inventory item not found: ${itemId}`);

    const itemType = target.itemType;
    const originalSource = decodeSource(target.source);

    // Unequip all siblings of the same itemType in a transaction, then equip target
    await this.prisma.$transaction(async (tx) => {
      // 1. Fetch sibling ids that are currently equipped (same user + itemType, different record)
      const siblings = await tx.playerInventory.findMany({
        where: {
          userId,
          itemType,
          id: { not: itemId },
          source: { startsWith: EQUIPPED_PREFIX },
        },
        select: { id: true, source: true },
      });

      // 2. Strip the equipped prefix from each sibling
      for (const sibling of siblings) {
        const siblingOriginalSource = decodeSource(sibling.source);
        await tx.playerInventory.update({
          where: { id: sibling.id },
          data: { source: siblingOriginalSource },
        });
      }

      // 3. Equip the target item
      await tx.playerInventory.update({
        where: { id: itemId },
        data: { source: encodeEquipped(originalSource ?? undefined) },
      });
    });

    const updated = await this.prisma.playerInventory.findUnique({
      where: { id: itemId },
      select: INVENTORY_SELECT,
    });
    return mapItem(updated!);
  }

  // ---------------------------------------------------------------------------
  // unequipItem — remove equipped flag from a single item
  // ---------------------------------------------------------------------------
  async unequipItem(userId: string, itemId: string) {
    const target = await this.prisma.playerInventory.findFirst({
      where: { id: itemId, userId },
      select: INVENTORY_SELECT,
    });
    if (!target) throw new NotFoundException(`Inventory item not found: ${itemId}`);

    const originalSource = decodeSource(target.source);

    const raw = await this.prisma.playerInventory.update({
      where: { id: itemId },
      data: { source: originalSource },
      select: INVENTORY_SELECT,
    });
    return mapItem(raw);
  }

  // ---------------------------------------------------------------------------
  // getEquipped — all currently equipped items for a player
  // ---------------------------------------------------------------------------
  async getEquipped(userId: string) {
    const rawItems = await this.prisma.playerInventory.findMany({
      where: {
        userId,
        source: { startsWith: EQUIPPED_PREFIX },
      },
      select: INVENTORY_SELECT,
      orderBy: { itemType: 'asc' },
    });
    return rawItems.map(mapItem);
  }

  // ---------------------------------------------------------------------------
  // grantItem — admin: directly grant an item to any player (event rewards etc.)
  // ---------------------------------------------------------------------------
  async grantItem(dto: GrantItemDto) {
    // Verify the target user exists
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true, deletedAt: true },
    });
    if (!user || user.deletedAt) {
      throw new NotFoundException(`Player not found: ${dto.userId}`);
    }

    const raw = await this.prisma.playerInventory.create({
      data: {
        userId: dto.userId,
        itemType: dto.itemType,
        itemId: dto.itemId,
        quantity: dto.quantity ?? 1,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        source: dto.source ?? 'admin_grant',
      },
      select: INVENTORY_SELECT,
    });
    return mapItem(raw);
  }

  // ---------------------------------------------------------------------------
  // getInventoryStats — aggregate summary for a player's inventory
  // ---------------------------------------------------------------------------
  async getInventoryStats(userId: string) {
    const allItems = await this.prisma.playerInventory.findMany({
      where: { userId },
      select: {
        itemType: true,
        quantity: true,
        source: true,
        expiresAt: true,
      },
    });

    let totalItems = 0;
    let equippedCount = 0;
    const categoryBreakdown: Record<string, { count: number; equippedCount: number }> = {};

    for (const item of allItems) {
      totalItems += item.quantity;
      const equipped = isEquipped(item.source);
      if (equipped) equippedCount++;

      if (!categoryBreakdown[item.itemType]) {
        categoryBreakdown[item.itemType] = { count: 0, equippedCount: 0 };
      }
      categoryBreakdown[item.itemType].count += item.quantity;
      if (equipped) categoryBreakdown[item.itemType].equippedCount++;
    }

    const now = new Date();
    const expiredCount = allItems.filter(
      (i) => i.expiresAt !== null && i.expiresAt < now,
    ).length;

    return {
      userId,
      totalItems,
      uniqueEntries: allItems.length,
      equippedCount,
      expiredCount,
      categoryBreakdown,
    };
  }
}
