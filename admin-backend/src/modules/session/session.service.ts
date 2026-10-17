import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AdminGateway } from '../../gateway/admin.gateway';
import { assertNotBanned } from '../../common/ban.util';

export interface SyncBody { state?: 'menu' | 'match' | 'loading'; appVersion?: string; platform?: string; deviceId?: string; waitSeconds?: number; matchId?: string }
export interface PlayerCmd { id: string; type: string; payload: unknown; createdAt: Date }
interface Presence { userId: string; username: string; sessionId: string; lastBeat: number; state: string; ip?: string; platform?: string; appVersion?: string; deviceId?: string; matchId?: string; since: number; unflushedSeconds: number }

const OFFLINE_AFTER_MS = 90_000;          // no sync for this long = offline
const MAX_DELTA_S = 60;                   // one sync can credit at most this many seconds (a client cannot claim play time it was not connected for)
const FLUSH_SECONDS = 60;                 // profile.playSeconds is written to the database in batches

/**
 * Live presence + instant commands for running game clients. The client calls POST /session/sync in a loop (long poll, up to 25 s): the same call is the heartbeat (play time is measured
 * by the SERVER from the gaps between syncs, never trusted from the client) and the delivery channel for kick / ban / message commands, which wake the waiting request immediately.
 */
@Injectable()
export class SessionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SessionService.name);
  private readonly presence = new Map<string, Presence>();
  private readonly waiters = new Map<string, Set<() => void>>();
  private sweeper?: NodeJS.Timeout;
  private startHooks: ((userId: string, deviceId: string | undefined, ip: string | undefined, ctx: { platform?: string; appVersion?: string }) => Promise<void>)[] = [];
  /** Other modules (cheat engine) run checks when a player starts a session; a hook may throw to refuse it. */
  onSessionStart(fn: (userId: string, deviceId: string | undefined, ip: string | undefined, ctx: { platform?: string; appVersion?: string }) => Promise<void>) { this.startHooks.push(fn); }

  constructor(private readonly prisma: PrismaService, private readonly gateway: AdminGateway) {}

  onModuleInit() { this.sweeper = setInterval(() => void this.sweep(), 30_000); this.sweeper.unref?.(); }
  onModuleDestroy() { if (this.sweeper) clearInterval(this.sweeper); }

  async sync(userId: string, username: string, body: SyncBody, ip: string | undefined) {
    await assertNotBanned(this.prisma, userId);                     // 403 BANNED: the client shows the ban screen
    const now = Date.now();
    let p = this.presence.get(userId);
    if (!p) {
      for (const h of this.startHooks) await h(userId, body.deviceId, ip, { platform: body.platform, appVersion: body.appVersion });
      const s = await this.prisma.gameSession.create({ data: { userId, platform: body.platform, appVersion: body.appVersion, deviceId: body.deviceId, ip } });
      p = { userId, username, sessionId: s.id, lastBeat: now, state: body.state ?? 'menu', ip, platform: body.platform, appVersion: body.appVersion, deviceId: body.deviceId, since: now, unflushedSeconds: 0 };
      this.presence.set(userId, p);
      await this.prisma.playerProfile.update({ where: { userId }, data: { sessionCount: { increment: 1 }, lastSeenAt: new Date(), lastPlatform: body.platform, lastAppVersion: body.appVersion } }).catch(() => null);
      this.gateway.emitPlayerPresence({ userId, username, online: true });
    } else {
      const delta = Math.min(MAX_DELTA_S, Math.max(0, Math.round((now - p.lastBeat) / 1000)));
      const spentIn = p.state;                       // the time since the last sync was spent in the state the player was in THEN
      p.lastBeat = now; p.state = body.state ?? p.state; p.ip = ip ?? p.ip; p.matchId = body.matchId; p.unflushedSeconds += delta;
      await this.prisma.gameSession.update({ where: { id: p.sessionId }, data: { lastBeatAt: new Date(), seconds: { increment: delta }, ...(spentIn === 'match' ? { matchSeconds: { increment: delta } } : { menuSeconds: { increment: delta } }) } }).catch(() => null);
      if (p.unflushedSeconds >= FLUSH_SECONDS) await this.flush(p);
    }
    let cmds = await this.take(userId);
    const wait = Math.min(25, Math.max(0, Math.floor(body.waitSeconds ?? 0)));
    if (!cmds.length && wait > 0) { await this.waitForCommand(userId, wait * 1000); cmds = await this.take(userId); }
    return { ok: true, serverTime: new Date().toISOString(), commands: cmds };
  }

  private async flush(p: Presence) {
    const secs = p.unflushedSeconds; p.unflushedSeconds = 0;
    await this.prisma.playerProfile.update({ where: { userId: p.userId }, data: { playSeconds: { increment: secs }, lastSeenAt: new Date() } }).catch(() => null);
  }

  private async take(userId: string): Promise<PlayerCmd[]> {
    const rows = await this.prisma.playerCommand.findMany({ where: { userId, deliveredAt: null }, orderBy: { createdAt: 'asc' }, take: 20 });
    if (rows.length) await this.prisma.playerCommand.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { deliveredAt: new Date() } });
    return rows.map((r) => ({ id: r.id, type: r.type, payload: r.payload, createdAt: r.createdAt }));
  }

  private waitForCommand(userId: string, ms: number): Promise<void> {
    return new Promise((resolve) => {
      let done = false; const finish = () => { if (done) return; done = true; clearTimeout(t); set.delete(finish); resolve(); };
      const set = this.waiters.get(userId) ?? new Set<() => void>(); set.add(finish); this.waiters.set(userId, set);
      const t = setTimeout(finish, ms);
    });
  }

  /** Queue a command for one player and wake their waiting sync so it arrives right now. */
  async push(userId: string, type: string, payload: Record<string, unknown> | undefined, createdBy?: string) {
    const row = await this.prisma.playerCommand.create({ data: { userId, type, payload: (payload ?? undefined) as never, createdBy } });
    const w = this.waiters.get(userId); if (w) for (const f of [...w]) f();
    return row;
  }

  /** Players seen within the last 90 seconds. */
  online() {
    const now = Date.now();
    return [...this.presence.values()].filter((p) => now - p.lastBeat < OFFLINE_AFTER_MS).map((p) => ({ userId: p.userId, username: p.username, state: p.state, platform: p.platform, appVersion: p.appVersion, ip: p.ip, deviceId: p.deviceId, matchId: p.matchId, onlineSeconds: Math.round((now - p.since) / 1000), lastBeatAgoSeconds: Math.round((now - p.lastBeat) / 1000) }));
  }
  isOnline(userId: string) { const p = this.presence.get(userId); return !!p && Date.now() - p.lastBeat < OFFLINE_AFTER_MS; }
  onlineCount() { return this.online().length; }

  /** Closes sessions of players that stopped syncing. */
  private async sweep() {
    const now = Date.now();
    for (const [id, p] of this.presence) {
      if (now - p.lastBeat < OFFLINE_AFTER_MS) continue;
      this.presence.delete(id);
      await this.flush(p);
      await this.prisma.gameSession.update({ where: { id: p.sessionId }, data: { endedAt: new Date(p.lastBeat) } }).catch(() => null);
      this.gateway.emitPlayerPresence({ userId: id, username: p.username, online: false });
    }
  }

  /** Kick: close the live session now (no waiting for the 90 s heartbeat timeout). */
  async dropPresence(userId: string) { return this.leave(userId); }

  /** Explicit "I am leaving" from the client (menu quit): ends the session now. */
  async leave(userId: string) {
    const p = this.presence.get(userId); if (!p) return { ok: true };
    p.lastBeat = 0; await this.sweep(); return { ok: true };
  }
}
