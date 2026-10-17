import { Injectable, Optional } from '@nestjs/common';
import * as os from 'os';
import { monitorEventLoopDelay } from 'perf_hooks';
import { PrismaService } from '../../database/prisma.service';
import { SessionService } from '../session/session.service';
import { LiveService } from '../live/live.service';

/** Request counters fed by the global exception filter / interceptors (real numbers, no estimates). */
export const requestStats = { total: 0, clientErrors: 0, serverErrors: 0, since: Date.now() };

const loop = monitorEventLoopDelay({ resolution: 20 }); loop.enable();
let lastCpu = process.cpuUsage(); let lastAt = Date.now(); let cpuPercent = 0;
setInterval(() => { const now = Date.now(); const u = process.cpuUsage(lastCpu); cpuPercent = Math.min(100, Math.round(((u.user + u.system) / 1000 / (now - lastAt)) * 100)); lastCpu = process.cpuUsage(); lastAt = now; }, 5000).unref();

/** Honest health of THIS server: everything here is measured, nothing is simulated. */
@Injectable()
export class SystemService {
  constructor(private readonly prisma: PrismaService, private readonly sessions: SessionService, @Optional() private readonly live?: LiveService) {}

  async health() {
    let dbMs = -1, dbVersion = '';
    const t0 = Date.now();
    try { const r = await this.prisma.$queryRaw<{ v: string }[]>`select version() as v`; dbMs = Date.now() - t0; dbVersion = (r[0]?.v ?? '').split(' ').slice(0, 2).join(' '); } catch { dbMs = -1; }
    const [runningMatches, openTickets, release, settings, pendingCommands, backups] = await Promise.all([
      this.prisma.match.count({ where: { status: 'in_progress' } }).catch(() => -1),
      this.prisma.playerCommand.count({ where: { deliveredAt: null } }).catch(() => -1),
      this.prisma.contentRelease.findFirst({ where: { channel: 'live', isActive: true }, select: { version: true, createdAt: true } }).catch(() => null),
      this.live ? this.live.getSettings().catch(() => null) : null,
      this.prisma.playerCommand.count({ where: { deliveredAt: null, createdAt: { lt: new Date(Date.now() - 120_000) } } }).catch(() => -1),
      this.prisma.backup.findFirst({ where: { status: 'completed' }, orderBy: { startedAt: 'desc' }, select: { startedAt: true, type: true } }).catch(() => null),
    ]);
    const mem = process.memoryUsage();
    const redisUrl = process.env.REDIS_URL;
    const reqs = requestStats.total || 1;
    return {
      status: dbMs < 0 ? 'degraded' : 'ok',
      time: new Date().toISOString(),
      server: { uptimeSeconds: Math.round(process.uptime()), node: process.version, pid: process.pid, host: os.hostname(), cpuCores: os.cpus().length, loadAvg1m: Math.round(os.loadavg()[0] * 100) / 100, processCpuPercent: cpuPercent, memoryMB: Math.round(mem.rss / 1048576), heapMB: Math.round(mem.heapUsed / 1048576), systemFreeMB: Math.round(os.freemem() / 1048576), systemTotalMB: Math.round(os.totalmem() / 1048576), eventLoopLagMs: Math.round((loop.mean / 1e6) * 10) / 10, eventLoopLagP99Ms: Math.round((loop.percentile(99) / 1e6) * 10) / 10 },
      database: { ok: dbMs >= 0, latencyMs: dbMs, version: dbVersion },
      redis: { configured: !!redisUrl },
      game: { onlinePlayers: this.sessions.onlineCount(), runningMatches, undeliveredCommands: openTickets, staleCommands: pendingCommands, contentRelease: release?.version ?? null, maintenance: settings?.maintenance?.enabled ?? null, services: settings?.services ?? null },
      requests: { total: requestStats.total, clientErrors: requestStats.clientErrors, serverErrors: requestStats.serverErrors, serverErrorRatePercent: Math.round((requestStats.serverErrors / reqs) * 10000) / 100, sinceSeconds: Math.round((Date.now() - requestStats.since) / 1000) },
      backups: { lastCompleted: backups?.startedAt ?? null, type: backups?.type ?? null, hoursSince: backups ? Math.round((Date.now() - backups.startedAt.getTime()) / 3_600_000) : null },
    };
  }
}
