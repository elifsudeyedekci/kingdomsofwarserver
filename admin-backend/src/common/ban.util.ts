import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export interface ActiveBan { id: string; type: 'temporary' | 'permanent' | 'ranked_only'; reason: string; endsAt: Date | null }

/** The strictest ban in force for the player (permanent > temporary > ranked_only), or null. Expired temporary bans are switched off here. */
export async function findActiveBan(prisma: PrismaService, userId: string): Promise<ActiveBan | null> {
  const now = new Date();
  const bans = (await prisma.ban.findMany({ where: { userId, isActive: true }, orderBy: { createdAt: 'desc' } })) ?? [];
  const live: ActiveBan[] = [];
  for (const b of bans) {
    if (b.endsAt && b.endsAt <= now) { await prisma.ban.update({ where: { id: b.id }, data: { isActive: false, liftNote: 'expired' } }).catch(() => null); continue; }
    live.push({ id: b.id, type: b.type as ActiveBan['type'], reason: b.reason, endsAt: b.endsAt });
  }
  const rank = { permanent: 3, temporary: 2, ranked_only: 1 } as const;
  return live.sort((a, b) => rank[b.type] - rank[a.type])[0] ?? null;
}

/** Blocks sign-in / online play for permanent and temporary bans (a ranked_only ban only blocks ranked queues, see assertMayQueue). */
export async function assertNotBanned(prisma: PrismaService, userId: string): Promise<void> {
  const ban = await findActiveBan(prisma, userId);
  if (ban && ban.type !== 'ranked_only') throw new ForbiddenException({ code: 'BANNED', message: ban.reason, type: ban.type, endsAt: ban.endsAt });
}

export async function assertMayQueue(prisma: PrismaService, userId: string, ranked: boolean): Promise<void> {
  const ban = await findActiveBan(prisma, userId);
  if (!ban) return;
  if (ban.type === 'ranked_only' && !ranked) return;
  throw new ForbiddenException({ code: 'BANNED', message: ban.reason, type: ban.type, endsAt: ban.endsAt });
}

// ── per-request ban gate (cached 5 s so every API call is checked without a database hit each time) ──
const gate = new Map<string, { at: number; blocked: boolean }>();
/** True when a permanent / temporary ban is in force. Called from the JWT strategy: a ban cuts a player's API access within ~5 seconds even with a still-valid access token. */
export async function isBannedCached(prisma: PrismaService, userId: string): Promise<boolean> {
  const hit = gate.get(userId);
  if (hit && Date.now() - hit.at < 5000) return hit.blocked;
  let blocked = false;
  try { const b = await findActiveBan(prisma, userId); blocked = !!b && b.type !== 'ranked_only'; } catch { blocked = false; }
  gate.set(userId, { at: Date.now(), blocked });
  if (gate.size > 50_000) gate.clear();
  return blocked;
}
export function invalidateBanCache(userId?: string) { if (userId) gate.delete(userId); else gate.clear(); }
