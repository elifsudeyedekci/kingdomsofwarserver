import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AdminGateway } from '../../gateway/admin.gateway';
import { SessionService } from '../session/session.service';
import { invalidateBanCache } from '../../common/ban.util';

export type BanKind = 'temporary' | 'permanent' | 'ranked_only';

/** Everything an operator does to a live player: kick, ban (any kind), unban, message, force sign-out. Every action also reaches the player's RUNNING game within a second (long-poll). */
@Injectable()
export class ModerationService {
  constructor(private readonly prisma: PrismaService, private readonly sessions: SessionService, private readonly gateway: AdminGateway) {}

  private async player(userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, include: { profile: { select: { username: true } } } });
    if (!u) throw new NotFoundException('Player not found');
    return u;
  }

  /** Kills every login of the player: refresh tokens die (no new access tokens), the running game is told to leave. */
  private async endSessions(userId: string) {
    await this.prisma.playerSession.updateMany({ where: { userId, isValid: true }, data: { isValid: false, revokedAt: new Date() } });
  }

  async kick(adminId: string, userId: string, reason: string, cooldownMinutes?: number) {
    const u = await this.player(userId);
    await this.sessions.push(userId, 'kick', { reason }, adminId);
    await this.endSessions(userId);
    await this.sessions.dropPresence(userId);       // the player disappears from the online list at once (the client also stops its heartbeat for a pause)
    if (cooldownMinutes && cooldownMinutes > 0) {
      await this.prisma.ban.create({ data: { userId, type: 'temporary', reason: `Kick cool-down: ${reason}`, bannedBy: adminId, endsAt: new Date(Date.now() + cooldownMinutes * 60_000), isActive: true } });
      invalidateBanCache(userId);
    }
    this.gateway.emitModeration({ action: 'kick', userId, by: adminId, reason });
    return { ok: true, wasOnline: this.sessions.isOnline(userId), username: u.profile?.username };
  }

  async ban(adminId: string, userId: string, type: BanKind, reason: string, hours?: number, evidence?: string, matchId?: string) {
    const u = await this.player(userId);
    if (type === 'temporary' && !(hours && hours > 0)) throw new BadRequestException('A temporary ban needs a duration in hours');
    const endsAt = type === 'temporary' ? new Date(Date.now() + (hours as number) * 3_600_000) : null;
    const ban = await this.prisma.ban.create({ data: { userId, type, reason, evidence, matchId, bannedBy: adminId, endsAt, isActive: true } });
    if (type === 'permanent') await this.prisma.user.update({ where: { id: userId }, data: { isActive: false } });
    invalidateBanCache(userId);
    if (type !== 'ranked_only') { await this.endSessions(userId); await this.sessions.push(userId, 'ban', { type, reason, endsAt }, adminId); }
    else await this.sessions.push(userId, 'message', { title: 'Ranked ban', body: reason }, adminId);
    this.gateway.emitModeration({ action: `ban:${type}`, userId, by: adminId, reason });
    return { ok: true, banId: ban.id, endsAt, username: u.profile?.username };
  }

  /** For bans created by older code paths (legacy admin / anticheat endpoints): make them take effect in the running game too. */
  async notifyBan(userId: string, type: string, reason: string, endsAt: Date | null, by?: string) {
    invalidateBanCache(userId);
    if (type !== 'ranked_only') { await this.endSessions(userId); await this.sessions.push(userId, 'ban', { type, reason, endsAt }, by); }
    this.gateway.emitModeration({ action: `ban:${type}`, userId, by, reason });
  }

  async unban(adminId: string, userId: string, note?: string) {
    await this.player(userId);
    await this.prisma.ban.updateMany({ where: { userId, isActive: true }, data: { isActive: false, liftedBy: adminId, liftedAt: new Date(), liftNote: note } });
    await this.prisma.user.update({ where: { id: userId }, data: { isActive: true } });
    invalidateBanCache(userId);
    this.gateway.emitModeration({ action: 'unban', userId, by: adminId });
    return { ok: true };
  }

  async message(adminId: string, userId: string | undefined, title: string, body: string) {
    if (userId) { await this.player(userId); await this.sessions.push(userId, 'message', { title, body }, adminId); return { ok: true, delivered: 1 }; }
    const online = this.sessions.online(); for (const p of online) await this.sessions.push(p.userId, 'message', { title, body }, adminId);
    return { ok: true, delivered: online.length };
  }

  async forceLogout(adminId: string, userId: string) {
    await this.player(userId); await this.endSessions(userId); await this.sessions.push(userId, 'logout', {}, adminId);
    return { ok: true };
  }

  online() { const list = this.sessions.online(); return { count: list.length, inMatch: list.filter((p) => p.state === 'match').length, players: list.sort((a, b) => b.onlineSeconds - a.onlineSeconds) }; }

  /** All bans (newest first) with player names; `active` = only those in force now. */
  async bans(f: { active?: boolean; type?: string; q?: string; take?: number }) {
    const rows = await this.prisma.ban.findMany({
      where: { isActive: f.active === undefined ? undefined : f.active, type: (f.type as never) || undefined, ...(f.q ? { OR: [{ reason: { contains: f.q, mode: 'insensitive' } }, { user: { profile: { username: { contains: f.q, mode: 'insensitive' } } } }] } : {}) },
      orderBy: { createdAt: 'desc' }, take: Math.min(f.take ?? 100, 500), include: { user: { select: { profile: { select: { username: true } } } } },
    });
    const now = Date.now();
    return rows.map((b) => ({ id: b.id, userId: b.userId, username: b.user.profile?.username ?? null, type: b.type, reason: b.reason, evidence: b.evidence, bannedBy: b.bannedBy, matchId: b.matchId, startsAt: b.startsAt, endsAt: b.endsAt, isActive: b.isActive && (!b.endsAt || b.endsAt.getTime() > now), liftedBy: b.liftedBy, liftNote: b.liftNote, online: this.sessions.isOnline(b.userId) }));
  }

  /** Everything known about a player's conduct, newest first. */
  async history(userId: string) {
    const [bans, reports, flags, fraud, commands] = await Promise.all([
      this.prisma.ban.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 }),
      this.prisma.moderationReport.findMany({ where: { OR: [{ targetUserId: userId }, { reporterId: userId }] }, orderBy: { createdAt: 'desc' }, take: 50 }).catch(() => []),
      this.prisma.antiCheatFlag.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 }).catch(() => []),
      this.prisma.fraudFlag.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 }).catch(() => []),
      this.prisma.playerCommand.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 }),
    ]);
    return { bans, reports, antiCheatFlags: flags, fraudFlags: fraud, commands };
  }
}
