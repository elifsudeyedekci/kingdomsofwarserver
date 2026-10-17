import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import * as crypto from 'crypto';
import { MatchMode } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { MatchService } from '../match/match.service';
import { assertMayQueue } from '../../common/ban.util';
import { CheatWatchService } from '../cheatwatch/cheatwatch.service';

/** Maps pool of a queue (server side: the client never decides the map). Mirrors Data/UI/map_pool.json of the game. */
export const DEFAULT_MAP_POOL = [
  'continental', 'dry_arabia', 'black_forest', 'mongolian_heights', 'danube_river', 'hill_and_dale',
  'mountain_pass', 'four_lakes', 'lipany', 'highview', 'thousand_pools',
];

/** The reference game allows 4 vetoes in 1v1/team queues and 1 in free-for-all (CONFIRMED in the reference data). */
export const MAX_VETOES_TEAM = 4;
export const MAX_VETOES_FFA = 1;

export interface ResultReport { winnerUserIds: string[]; durationTicks?: number; dataHash?: string; /** manifest hash of the game data the reporting client ran ("" = shipped data) */ contentHash?: string }
export interface StoredReports { reports: Map<string, ResultReport>; firstAt: number; done?: boolean }
export interface QueueRequest { queueId: string; civIds?: string[]; teamSize?: number; vetoedMapIds?: string[]; /** manifest hash of the game data the client runs ("" = the data shipped in the build) */ contentHash?: string }
export interface Ticket {
  id: string; userId: string; queueId: string; mode: MatchMode; teamSize: number; mmr: number; civIds: string[]; vetoed: string[];
  enqueuedAt: number; seenAt: number; matchId?: string; mapId?: string; playerIds?: string[]; teams?: number[]; civs?: string[]; cancelled?: boolean;
}

/** A waiting ticket that has not been polled for this long is treated as abandoned. */
export const TICKET_STALE_MS = 20_000;
const QUEUE_MODES: Record<string, { mode: MatchMode; teamSize: number }> = {
  casual_1v1: { mode: MatchMode.casual_1v1, teamSize: 1 }, ranked_1v1: { mode: MatchMode.ranked_1v1, teamSize: 1 },
  casual_2v2: { mode: MatchMode.casual_2v2, teamSize: 2 }, ranked_2v2: { mode: MatchMode.ranked_2v2, teamSize: 2 },
  casual_3v3: { mode: MatchMode.casual_3v3, teamSize: 3 }, ranked_3v3: { mode: MatchMode.ranked_3v3, teamSize: 3 },
  casual_4v4: { mode: MatchMode.casual_4v4, teamSize: 4 }, ranked_4v4: { mode: MatchMode.ranked_4v4, teamSize: 4 },
};

/** Rating window that widens while a ticket waits: +/-100 at once, +25 per second, capped at 600. */
export function ratingWindow(waitSeconds: number): number { return Math.min(600, 100 + 25 * Math.max(0, waitSeconds)); }

/** Deterministic pick (xorshift) so a seeded test and a replayed match agree. */
export function pickMap(pool: string[], vetoed: string[], seed: number): string | null {
  const open = pool.filter((m) => !vetoed.includes(m)); if (open.length === 0) return null;
  let x = (seed | 0) || 1; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return open[Math.abs(x) % open.length];
}

@Injectable()
export class MatchmakingService {
  private readonly tickets = new Map<string, Ticket>();
  private nextId = 1;
  private readonly results = new Map<string, StoredReports>();
  /** After this many seconds players that never reported count as disconnected (they cannot hold a finished match hostage). */
  reportGraceSeconds = 120;
  now: () => number = () => Date.now();
  pool: string[] = DEFAULT_MAP_POOL;

  constructor(private readonly prisma: PrismaService, private readonly matches: MatchService, @Optional() private readonly cheat?: CheatWatchService) {}

  private baseline?: { at: number; hash: string };
  /** Hash of the game data that ships inside the client build (what a client without downloaded patches runs). */
  private async baselineHash(): Promise<string> {
    if (this.baseline && Date.now() - this.baseline.at < 60_000) return this.baseline.hash;
    const rows = await this.prisma.contentFile.findMany({ orderBy: { path: 'asc' }, select: { path: true, baseContent: true } });
    const hash = crypto.createHash('sha256').update(rows.map((r) => `${r.path}:${crypto.createHash('sha256').update(r.baseContent, 'utf8').digest('hex')}`).join('\n'), 'utf8').digest('hex');
    this.baseline = { at: Date.now(), hash }; return hash;
  }

  /** Online matches are lockstep: every player must run byte-identical game data, so a client with an outdated data release may not queue. */
  private async assertSameContent(req: QueueRequest) {
    let active: { manifestHash: string } | null = null;
    try { active = (await this.prisma.contentRelease?.findFirst({ where: { channel: 'live', isActive: true }, select: { manifestHash: true } })) ?? null; } catch { return; }
    if (!active) return;
    let mine = req.contentHash ?? '';
    if (!mine) { try { mine = await this.baselineHash(); } catch { return; } }
    if (mine !== active.manifestHash) throw new ConflictException({ code: 'CONTENT_OUTDATED', message: 'Your game data is out of date. It is being updated: try again in a moment.', required: active.manifestHash });
  }

  async enqueue(userId: string, req: QueueRequest) {
    const q = QUEUE_MODES[req.queueId]; if (!q) throw new BadRequestException(`unknown queue ${req.queueId}`);
    await assertMayQueue(this.prisma, userId, String(q.mode).startsWith('ranked'));
    await this.assertSameContent(req);
    for (const t of this.tickets.values()) if (t.userId === userId && !t.cancelled && !t.matchId) throw new BadRequestException('already in a queue');
    const profile = await this.prisma.playerProfile.findUnique({ where: { userId } });
    const veto = req.vetoedMapIds ?? []; this.checkVeto(q.teamSize, veto);
    const t: Ticket = { id: `t${this.nextId++}`, userId, queueId: req.queueId, mode: q.mode, teamSize: q.teamSize, mmr: profile?.mmr ?? 1000, civIds: req.civIds ?? [], vetoed: veto, enqueuedAt: this.now(), seenAt: this.now() };
    this.tickets.set(t.id, t);
    return { ticketId: t.id, estimatedWaitSeconds: this.estimate(t) };
  }

  private checkVeto(teamSize: number, vetoed: string[]) {
    const max = teamSize > 0 ? MAX_VETOES_TEAM : MAX_VETOES_FFA;
    if (vetoed.length > max) throw new BadRequestException(`at most ${max} maps may be vetoed`);
  }

  private estimate(t: Ticket): number {
    const waiting = [...this.tickets.values()].filter((o) => o.queueId === t.queueId && !o.cancelled && !o.matchId && o.id !== t.id).length;
    return waiting >= t.teamSize * 2 - 1 ? 5 : 30;
  }

  cancel(userId: string, ticketId: string) {
    const t = this.own(userId, ticketId); if (t.matchId) throw new BadRequestException('already matched'); t.cancelled = true; return true;
  }

  submitVeto(userId: string, ticketId: string, mapIds: string[]) {
    const t = this.own(userId, ticketId); if (t.matchId) throw new BadRequestException('already matched'); this.checkVeto(t.teamSize, mapIds); t.vetoed = [...mapIds]; return true;
  }

  private own(userId: string, ticketId: string): Ticket {
    const t = this.tickets.get(ticketId); if (!t) throw new NotFoundException('unknown ticket'); if (t.userId !== userId) throw new ForbiddenException(); return t;
  }

  private static norm(r: ResultReport): string { return JSON.stringify({ w: [...r.winnerUserIds].sort(), h: r.dataHash ?? '' }); }

  /** Lockstep result consensus: every player of the match reports the winners and the hash of the final simulation state. The match is recorded (and the rating updated by MatchService)
   *  only when ALL reports agree - a deterministic simulation yields the same hash everywhere, so a cheater who reports something else cannot move the rating; disagreement is disputed
   *  (nothing recorded). Players that never report within the grace period count as disconnected when the reports present agree. */
  async reportResult(userId: string, matchId: string, report: ResultReport) {
    const match: any = await this.prisma.match.findUnique({ where: { id: matchId }, include: { players: true } });
    if (!match) throw new NotFoundException('unknown match'); const ids: string[] = match.players.map((p: any) => p.userId);
    if (!ids.includes(userId)) throw new ForbiddenException('not a player of this match'); if (match.status === 'completed') return { status: 'already_recorded' };
    if (report.winnerUserIds.some((w) => !ids.includes(w))) throw new BadRequestException('winner is not a player of this match');
    const st = this.results.get(matchId) ?? { reports: new Map<string, ResultReport>(), firstAt: this.now() }; this.results.set(matchId, st);
    if (st.done) return { status: 'already_recorded' }; st.reports.set(userId, report);
    const have = [...st.reports.values()]; const agree = have.every((r) => MatchmakingService.norm(r) === MatchmakingService.norm(have[0]));
    void this.cheat?.checkContentHash(userId, matchId, report.contentHash).catch(() => null);
    if (!agree) { void this.cheat?.onResultsDisputed(matchId, [...st.reports.entries()].map(([u, r]) => ({ userId: u, winners: r.winnerUserIds }))).catch(() => null); return { status: 'disputed' }; }
    const waited = (this.now() - st.firstAt) / 1000; const missing = ids.filter((i) => !st.reports.has(i));
    if (missing.length > 0 && waited < this.reportGraceSeconds) return { status: 'waiting', missing: missing.length };
    const winners = new Set(have[0].winnerUserIds);
    await this.matches.recordResult(matchId, { durationTicks: report.durationTicks, dataHash: have[0].dataHash, winnerUserId: have[0].winnerUserIds[0], participants: ids.map((u) => ({ userId: u, isWinner: winners.has(u), disconnected: missing.includes(u) })) } as any);
    st.done = true; void this.cheat?.onMatchRecorded(matchId, ids).catch(() => null); return { status: 'recorded' };
  }

  /** Polls a ticket: tries to form a match first; returns the match once there is one, null while waiting. */
  async poll(userId: string, ticketId: string) {
    const t = this.own(userId, ticketId); if (t.cancelled) throw new BadRequestException('ticket cancelled');
    t.seenAt = this.now(); if (!t.matchId) await this.tryMatch(t);
    return t.matchId ? { matchId: t.matchId, mapId: t.mapId, playerIds: t.playerIds, teams: t.teams, civs: t.civs, relayEndpoint: process.env.RELAY_ENDPOINT ?? '' } : null;
  }

  private async tryMatch(me: Ticket) {
    const need = me.teamSize * 2; const nowS = this.now();
    // matches form lazily on poll: a ticket nobody polls any more (closed client) must not anchor the queue forever (measured on a live server: two abandoned tickets blocked every later pair)
    const waiting = [...this.tickets.values()].filter((o) => o.queueId === me.queueId && !o.cancelled && !o.matchId && nowS - o.seenAt <= TICKET_STALE_MS).sort((a, b) => a.enqueuedAt - b.enqueuedAt);
    // the oldest ticket anchors the match: others must fit its (widening) window, and mine must be among the chosen
    const anchor = waiting[0]; if (!anchor) return;
    const win = ratingWindow((nowS - anchor.enqueuedAt) / 1000);
    const group = waiting.filter((o) => Math.abs(o.mmr - anchor.mmr) <= win).slice(0, need);
    if (group.length < need || !group.includes(me)) return;
    // teams by snake order of rating so both sides are balanced
    const sorted = [...group].sort((a, b) => b.mmr - a.mmr); const slots = sorted.map((t, i) => ({ t, team: (Math.floor(i / 2) % 2 === 0 ? i % 2 : 1 - (i % 2)) }));
    const vetoes = new Set<string>(); for (const g of group) for (const m of g.vetoed) vetoes.add(m);
    const seed = Math.floor(nowS / 1000) ^ group.length;
    const mapId = pickMap(this.pool, [...vetoes], seed) ?? pickMap(this.pool, [], seed);
    const match = await this.matches.create({ mode: me.mode, mapId: mapId ?? undefined, seed: String(seed), players: slots.map((s, i) => ({ userId: s.t.userId, slot: i, teamId: s.team, civId: s.t.civIds[0] })) } as any);
    // playerIds is in slot order: index = seat in the match
    for (const g of group) { g.matchId = (match as any).id; g.mapId = mapId ?? undefined; g.playerIds = slots.map((x) => x.t.userId); g.teams = slots.map((x) => x.team); g.civs = slots.map((x) => x.t.civIds[0] ?? ''); }
  }
}
