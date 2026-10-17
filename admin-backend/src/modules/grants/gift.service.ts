import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { SessionService } from '../session/session.service';
import { GrantService, Rewards, validateRewards } from './grant.service';

export interface GiftTarget { userIds?: string[]; usernames?: string[]; all?: boolean; platform?: string; minLevel?: number; activeWithinDays?: number; inactiveForDays?: number; hasPurchased?: boolean }

const MAX_BROADCAST = 200_000;

/** The mailbox: admin gifts waiting for players, and the player-side list / claim. */
@Injectable()
export class GiftService {
  constructor(private readonly prisma: PrismaService, private readonly grants: GrantService, private readonly sessions: SessionService) {}

  async resolveTargets(t: GiftTarget): Promise<string[]> {
    const ids = new Set<string>(t.userIds ?? []);
    if (t.usernames?.length) for (const p of await this.prisma.playerProfile.findMany({ where: { username: { in: t.usernames } }, select: { userId: true } })) ids.add(p.userId);
    if (t.all || t.platform || t.minLevel || t.activeWithinDays || t.inactiveForDays || t.hasPurchased !== undefined) {
      const now = Date.now();
      const where: Prisma.PlayerProfileWhereInput = {
        user: { isActive: true, deletedAt: null, ...(t.hasPurchased === true ? { purchases: { some: { status: 'verified' } } } : t.hasPurchased === false ? { purchases: { none: {} } } : {}) },
        ...(t.minLevel ? { level: { gte: t.minLevel } } : {}),
        ...(t.platform ? { lastPlatform: t.platform } : {}),
        ...(t.activeWithinDays ? { lastSeenAt: { gte: new Date(now - t.activeWithinDays * 86_400_000) } } : {}),
        ...(t.inactiveForDays ? { OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: new Date(now - t.inactiveForDays * 86_400_000) } }] } : {}),
      };
      for (const p of await this.prisma.playerProfile.findMany({ where, select: { userId: true }, take: MAX_BROADCAST + 1 })) ids.add(p.userId);
    }
    if (ids.size > MAX_BROADCAST) throw new BadRequestException(`Too many recipients (max ${MAX_BROADCAST})`);
    return [...ids];
  }

  /** Counts who WOULD receive it (the panel shows this before the admin confirms). */
  async preview(t: GiftTarget) { const ids = await this.resolveTargets(t); return { recipients: ids.length, sample: ids.slice(0, 5) }; }

  async send(adminId: string, target: GiftTarget, title: Record<string, string>, body: Record<string, string>, rewards: Rewards, expiresInDays?: number, source = 'admin') {
    validateRewards(rewards);
    if (!title || !Object.keys(title).length) throw new BadRequestException('title is required (e.g. { "en": "...", "tr": "..." })');
    const ids = await this.resolveTargets(target);
    if (!ids.length) throw new BadRequestException('No recipients matched');
    const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 86_400_000) : null;
    for (let i = 0; i < ids.length; i += 1000) {
      await this.prisma.gift.createMany({ data: ids.slice(i, i + 1000).map((userId) => ({ userId, title: title as never, body: body as never, rewards: rewards as never, source, createdBy: adminId, expiresAt })) });
    }
    const online = new Set(this.sessions.online().map((p) => p.userId));
    for (const id of ids) if (online.has(id)) void this.sessions.push(id, 'gift', { title }, adminId).catch(() => null);
    return { ok: true, recipients: ids.length };
  }

  list(filter: { userId?: string; status?: string; take?: number }) {
    return this.prisma.gift.findMany({ where: { userId: filter.userId || undefined, status: filter.status || undefined }, orderBy: { createdAt: 'desc' }, take: Math.min(filter.take ?? 100, 500) });
  }
  async cancel(id: string) { const r = await this.prisma.gift.updateMany({ where: { id, status: 'pending' }, data: { status: 'cancelled' } }); if (!r.count) throw new NotFoundException('Gift not found or already claimed'); return { ok: true }; }

  // ── player side ──
  async mine(userId: string, locale: string) {
    await this.prisma.gift.updateMany({ where: { userId, status: 'pending', expiresAt: { lt: new Date() } }, data: { status: 'expired' } });
    const rows = await this.prisma.gift.findMany({ where: { userId, status: 'pending' }, orderBy: { createdAt: 'desc' }, take: 50 });
    const pick = (m: unknown) => { const o = (m ?? {}) as Record<string, string>; return o[locale] ?? o[locale.split('-')[0]] ?? o.en ?? Object.values(o)[0] ?? ''; };
    return rows.map((g) => ({ id: g.id, title: pick(g.title), body: pick(g.body), rewards: g.rewards, lines: describeRewards(g.rewards as Rewards), createdAt: g.createdAt, expiresAt: g.expiresAt }));
  }

  /** Claiming is idempotent: the pending -> claimed switch is a single conditional update, so a double tap can never grant twice. */
  async claim(userId: string, giftId: string) {
    const g = await this.prisma.gift.findFirst({ where: { id: giftId, userId } });
    if (!g) throw new NotFoundException();
    if (g.status !== 'pending') throw new ConflictException(`Gift is ${g.status}`);
    if (g.expiresAt && g.expiresAt < new Date()) { await this.prisma.gift.update({ where: { id: g.id }, data: { status: 'expired' } }); throw new ConflictException('Gift expired'); }
    const flip = await this.prisma.gift.updateMany({ where: { id: g.id, status: 'pending' }, data: { status: 'claimed', claimedAt: new Date() } });
    if (!flip.count) throw new ConflictException('Gift already claimed');
    try { return { ok: true, granted: await this.grants.apply(userId, g.rewards as Rewards, { source: 'gift', refId: g.id, reason: `gift ${g.id}` }) }; }
    catch (e) { await this.prisma.gift.update({ where: { id: g.id }, data: { status: 'pending', claimedAt: null } }); throw e; }   // nothing granted -> back in the mailbox
  }

  // ── bonuses & entitlements for the game client ──
  async bonuses(userId: string) {
    const rows = await this.prisma.playerBonus.findMany({ where: { userId, usesLeft: { gt: 0 }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, orderBy: { createdAt: 'asc' } });
    return rows.map((b) => flattenBonus(b));
  }
  async useBonus(userId: string, id: string) {
    const r = await this.prisma.playerBonus.updateMany({ where: { id, userId, usesLeft: { gt: 0 } }, data: { usesLeft: { decrement: 1 } } });
    if (!r.count) throw new NotFoundException('Bonus not found or used up'); return { ok: true };
  }
  /** Ranked ladder straight from the players' real ratings: top N plus the caller's own position. */
  async ladder(userId: string, top = 100) {
    const rows = await this.prisma.playerProfile.findMany({ where: { totalMatches: { gte: 1 }, user: { isActive: true, deletedAt: null } }, orderBy: [{ mmr: 'desc' }, { wins: 'desc' }], take: Number.isFinite(top) ? Math.max(1, Math.min(Math.floor(top), 200)) : 100, select: { userId: true, username: true, mmr: true, currentRank: true, wins: true, losses: true, level: true } });
    const me = await this.prisma.playerProfile.findUnique({ where: { userId }, select: { mmr: true, username: true, wins: true, losses: true, totalMatches: true } });
    const ahead = me ? await this.prisma.playerProfile.count({ where: { mmr: { gt: me.mmr }, totalMatches: { gte: 1 } } }) : 0;
    return { top: rows.map((r, i) => ({ rank: i + 1, username: r.username, mmr: r.mmr, tier: r.currentRank, wins: r.wins, losses: r.losses, level: r.level, you: r.userId === userId })), you: me ? { rank: me.totalMatches ? ahead + 1 : null, ...me } : null };
  }

  /** Packs and cosmetics the player owns (active ones only): the game shows "owned" / unlocks civilizations from this. */
  async entitlements(userId: string) {
    const rows = await this.prisma.playerInventory.findMany({ where: { userId, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, select: { itemType: true, itemId: true, quantity: true, expiresAt: true } });
    return { packs: rows.filter((r) => r.itemType === 'pack').map((r) => r.itemId), items: rows.filter((r) => r.itemType !== 'pack') };
  }
}

/** Human-readable lines for the mailbox ('120 gems', 'Pack: sultans-ascend'): the client shows them as they are. */
export function describeRewards(r: Rewards | null | undefined): string[] {
  const o: string[] = []; if (!r) return o;
  for (const [k, v] of Object.entries(r.wallet ?? {})) o.push(`${v} ${k}`);
  for (const p of r.packs ?? []) o.push(`Pack: ${typeof p === 'string' ? p : p.id}`);
  for (const i of r.items ?? []) o.push(`${i.type}: ${i.id}${i.qty && i.qty > 1 ? ' x' + i.qty : ''}`);
  if (r.xp) o.push(`${r.xp} XP`);
  for (const b of r.bonuses ?? []) o.push(b.kind === 'starting_resources' ? 'Start bonus: resources' : 'Start bonus: soldiers');
  return o;
}
/** Flat shape for the Unity client (JsonUtility cannot read free-form payloads). */
export function flattenBonus(b: { id: string; kind: string; usesLeft: number; payload: unknown; expiresAt?: Date | null }) {
  const p = (b.payload ?? {}) as Record<string, number>;
  const units = b.kind === 'starting_units' && Array.isArray(b.payload) ? (b.payload as { type: string; count: number }[]).map((u) => ({ type: u.type, count: u.count })) : [];
  return { id: b.id, kind: b.kind, usesLeft: b.usesLeft, expiresAt: b.expiresAt ?? null, food: b.kind === 'starting_resources' ? p.food ?? 0 : 0, wood: b.kind === 'starting_resources' ? p.wood ?? 0 : 0, gold: b.kind === 'starting_resources' ? p.gold ?? 0 : 0, stone: b.kind === 'starting_resources' ? p.stone ?? 0 : 0, units };
}
