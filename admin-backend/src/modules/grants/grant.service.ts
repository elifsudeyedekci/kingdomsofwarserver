import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { SessionService } from '../session/session.service';

export const CURRENCIES = ['coins', 'gems', 'chestKeys', 'eventTokens', 'bpXp'] as const;
export type Currency = (typeof CURRENCIES)[number];

/** What a reward can contain. The same shape is used by gifts, store products (`StoreProduct.contents`), battle pass / event prizes and direct admin grants. */
export interface Rewards {
  wallet?: Partial<Record<Currency, number>>;
  /** cosmetics etc: { type: 'flag' | 'emblem' | 'portrait' | 'skin' | 'monument' | 'music' | ..., id, qty?, days? (omit = permanent) } */
  items?: { type: string; id: string; qty?: number; days?: number }[];
  /** content packs / DLC civ packs by id (e.g. "sultans_ascend"): stored as inventory type "pack" - the game unlocks the civs from it */
  packs?: { id: string; days?: number }[] | string[];
  /** advantages for the player's own games */
  bonuses?: { kind: 'starting_resources' | 'starting_units'; payload: unknown; uses?: number; days?: number; appliesTo?: string[] }[];
  xp?: number;
}
export interface GrantCtx { source: string; reason?: string; adminId?: string; refId?: string }

const MAX_PER_GRANT = 10_000_000;
const KNOWN_RESOURCES = ['food', 'wood', 'gold', 'stone'];

export function validateRewards(r: Rewards): Rewards {
  if (!r || typeof r !== 'object') throw new BadRequestException('rewards must be an object');
  for (const [k, v] of Object.entries(r.wallet ?? {})) {
    if (!(CURRENCIES as readonly string[]).includes(k)) throw new BadRequestException(`Unknown currency '${k}'`);
    if (!Number.isInteger(v) || Math.abs(v as number) > MAX_PER_GRANT) throw new BadRequestException(`wallet.${k} must be a whole number within +-${MAX_PER_GRANT}`);
  }
  for (const i of r.items ?? []) { if (!i.type || !i.id || (i.qty !== undefined && (!Number.isInteger(i.qty) || i.qty < 1 || i.qty > 100000))) throw new BadRequestException('each item needs type and id (qty 1..100000)'); }
  for (const b of r.bonuses ?? []) {
    if (b.kind === 'starting_resources') { for (const [k, v] of Object.entries((b.payload ?? {}) as Record<string, number>)) if (!KNOWN_RESOURCES.includes(k) || !Number.isFinite(v) || v < 0 || v > 1_000_000) throw new BadRequestException(`starting_resources: bad entry ${k}`); }
    else if (b.kind === 'starting_units') { if (!Array.isArray(b.payload) || b.payload.some((u: { type?: string; count?: number }) => !u?.type || !Number.isInteger(u.count) || (u.count as number) < 1 || (u.count as number) > 500)) throw new BadRequestException('starting_units: [{ type, count 1..500 }]'); }
    else throw new BadRequestException(`Unknown bonus kind '${(b as { kind: string }).kind}'`);
  }
  if (r.xp !== undefined && (!Number.isInteger(r.xp) || Math.abs(r.xp) > 1_000_000)) throw new BadRequestException('xp must be a whole number');
  return r;
}

@Injectable()
export class GrantService {
  constructor(private readonly prisma: PrismaService, private readonly sessions: SessionService) {}

  /** Applies a reward bundle to one player atomically and records every wallet change in the ledger. Returns what changed. */
  async apply(userId: string, rewards: Rewards, ctx: GrantCtx) {
    validateRewards(rewards);
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundException('Player not found');
    const result = await this.prisma.$transaction(async (tx) => {
      const out: { wallet: Record<string, number>; items: number; packs: number; bonuses: number; xp: number } = { wallet: {}, items: 0, packs: 0, bonuses: 0, xp: 0 };
      const entries = Object.entries(rewards.wallet ?? {}).filter(([, v]) => v);
      if (entries.length) {
        const w = await tx.playerWallet.upsert({ where: { userId }, create: { userId }, update: {} });
        const data: Record<string, number> = {};
        for (const [cur, delta] of entries) {
          const now = (w as unknown as Record<string, number>)[cur] ?? 0;
          if (now + (delta as number) < 0) throw new BadRequestException(`Not enough ${cur} (has ${now}, change ${delta})`);
          data[cur] = now + (delta as number);
        }
        await tx.playerWallet.update({ where: { userId }, data });
        for (const [cur, delta] of entries) {
          await tx.economyLedger.create({ data: { userId, currency: cur, amount: delta as number, balanceAfter: data[cur], reason: ctx.reason ?? ctx.source, source: ctx.source, adminId: ctx.adminId, refId: ctx.refId } });
          out.wallet[cur] = delta as number;
        }
      }
      const upsertItem = async (itemType: string, itemId: string, qty: number, days: number | undefined) => {
        const existing = await tx.playerInventory.findFirst({ where: { userId, itemType, itemId } });
        const expiry = days ? new Date(Date.now() + days * 86_400_000) : null;
        if (existing) {
          const keepsForever = existing.expiresAt === null; // permanent stays permanent
          await tx.playerInventory.update({ where: { id: existing.id }, data: { quantity: existing.quantity + qty, expiresAt: days === undefined ? null : keepsForever ? null : (existing.expiresAt && expiry && existing.expiresAt > expiry ? existing.expiresAt : expiry), source: ctx.source } });
        } else await tx.playerInventory.create({ data: { userId, itemType, itemId, quantity: qty, expiresAt: expiry, source: ctx.source } });
      };
      for (const i of rewards.items ?? []) { await upsertItem(i.type, i.id, i.qty ?? 1, i.days); out.items++; }
      for (const p of (rewards.packs ?? []) as ({ id: string; days?: number } | string)[]) { const id = typeof p === 'string' ? p : p.id; await upsertItem('pack', id, 1, typeof p === 'string' ? undefined : p.days); out.packs++; }
      for (const b of rewards.bonuses ?? []) {
        await tx.playerBonus.create({ data: { userId, kind: b.kind, payload: b.payload as Prisma.InputJsonValue, usesLeft: b.uses ?? 1, appliesTo: b.appliesTo ?? [], expiresAt: b.days ? new Date(Date.now() + b.days * 86_400_000) : null, source: ctx.source, createdBy: ctx.adminId } });
        out.bonuses++;
      }
      if (rewards.xp) { await tx.playerProfile.update({ where: { userId }, data: { xp: { increment: rewards.xp } } }); out.xp = rewards.xp; }
      return out;
    });
    // tell the running game (if any) that something arrived, so the UI can refresh the wallet / mailbox
    void this.sessions.push(userId, 'inventory-changed', { source: ctx.source }, ctx.adminId).catch(() => null);
    return result;
  }

  /** Removes (part of) an inventory entry: wrong grant, refund, penalty. */
  async revokeItem(userId: string, inventoryId: string, qty: number | undefined, adminId: string, reason: string) {
    const row = await this.prisma.playerInventory.findFirst({ where: { id: inventoryId, userId } });
    if (!row) throw new NotFoundException('Inventory entry not found');
    if (!qty || qty >= row.quantity) await this.prisma.playerInventory.delete({ where: { id: row.id } });
    else await this.prisma.playerInventory.update({ where: { id: row.id }, data: { quantity: row.quantity - qty } });
    await this.prisma.economyLedger.create({ data: { userId, currency: `item:${row.itemType}:${row.itemId}`, amount: -(qty ?? row.quantity), balanceAfter: Math.max(0, row.quantity - (qty ?? row.quantity)), reason, source: 'revoke', adminId } });
    void this.sessions.push(userId, 'inventory-changed', { source: 'revoke' }, adminId).catch(() => null);
    return { ok: true };
  }

  async revokeBonus(userId: string, bonusId: string) { const r = await this.prisma.playerBonus.deleteMany({ where: { id: bonusId, userId } }); return { ok: r.count > 0 }; }

  // ── reads for the panel ──
  async assets(userId: string) {
    const [wallet, inventory, bonuses, gifts] = await Promise.all([
      this.prisma.playerWallet.findUnique({ where: { userId } }),
      this.prisma.playerInventory.findMany({ where: { userId }, orderBy: { obtainedAt: 'desc' }, take: 500 }),
      this.prisma.playerBonus.findMany({ where: { userId, usesLeft: { gt: 0 } }, orderBy: { createdAt: 'desc' } }),
      this.prisma.gift.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 }),
    ]);
    return { wallet: wallet ?? { coins: 0, gems: 0, chestKeys: 0, eventTokens: 0, bpXp: 0 }, inventory, bonuses, gifts };
  }
  ledger(userId: string, take = 100) { return this.prisma.economyLedger.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: Math.min(take, 500) }); }
  /** Economy at a glance: currency in circulation, what was issued / spent by source in the period, biggest holders, purchases. */
  async economy(days = 30) {
    const since = new Date(Date.now() - days * 86_400_000);
    const [wallets, flows, holders, purchases, adminGrants] = await Promise.all([
      this.prisma.playerWallet.aggregate({ _sum: { coins: true, gems: true, chestKeys: true, eventTokens: true, bpXp: true }, _count: { _all: true } }),
      this.prisma.economyLedger.groupBy({ by: ['currency', 'source'], where: { createdAt: { gte: since } }, _sum: { amount: true }, _count: { _all: true } }),
      this.prisma.playerWallet.findMany({ orderBy: { gems: 'desc' }, take: 10, select: { userId: true, coins: true, gems: true } }),
      this.prisma.playerPurchase.aggregate({ where: { status: 'verified', createdAt: { gte: since } }, _sum: { amountUsd: true }, _count: { _all: true } }),
      this.prisma.economyLedger.count({ where: { source: 'admin_grant', createdAt: { gte: since } } }),
    ]);
    const names = new Map((await this.prisma.playerProfile.findMany({ where: { userId: { in: holders.map((h) => h.userId) } }, select: { userId: true, username: true } })).map((p) => [p.userId, p.username]));
    return {
      days, wallets: wallets._count._all, circulation: wallets._sum,
      flows: flows.filter((f) => !f.currency.startsWith('item:')).map((f) => ({ currency: f.currency, source: f.source, amount: f._sum.amount ?? 0, entries: f._count._all })),
      topHolders: holders.map((h) => ({ ...h, username: names.get(h.userId) ?? null })),
      purchases: { count: purchases._count._all, usd: Math.round((purchases._sum.amountUsd ?? 0) * 100) / 100 }, adminGrants,
    };
  }

  async catalogOfPacks() {
    const products = await this.prisma.storeProduct.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' }, select: { id: true, nameKey: true, priceUsd: true, contents: true } });
    return products;
  }
}
