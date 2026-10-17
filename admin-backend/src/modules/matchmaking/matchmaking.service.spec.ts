jest.mock('../match/match.service', () => ({ MatchService: class {} }));
jest.mock('../../database/prisma.service', () => ({ PrismaService: class {} }));
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { MatchmakingService, MAX_VETOES_TEAM, pickMap, ratingWindow } from './matchmaking.service';

function make(mmrs: Record<string, number>, players: string[] = ['a', 'b']) {
  const prisma: any = { ban: { findMany: jest.fn(() => Promise.resolve([])), update: jest.fn() }, match: { findUnique: jest.fn(() => Promise.resolve({ id: 'm-1', status: 'in_progress', players: players.map((userId) => ({ userId })) })) }, playerProfile: { findUnique: jest.fn(({ where }: any) => Promise.resolve(mmrs[where.userId] !== undefined ? { mmr: mmrs[where.userId] } : null)) } };
  const matches: any = { create: jest.fn((dto: any) => Promise.resolve({ id: 'm-1', ...dto })), recordResult: jest.fn(() => Promise.resolve({})) };
  const svc = new MatchmakingService(prisma, matches); let t = 1_000_000; svc.now = () => t;
  return { svc, matches, advance: (s: number) => { t += s * 1000; } };
}

describe('MatchmakingService', () => {
  it('pairs two close ratings into a 1v1 and creates the match', async () => {
    const { svc, matches } = make({ a: 1000, b: 1050 });
    const ta = await svc.enqueue('a', { queueId: 'ranked_1v1' }); const tb = await svc.enqueue('b', { queueId: 'ranked_1v1' });
    const m = await svc.poll('a', ta.ticketId); expect(m).not.toBeNull(); expect(m!.playerIds!.sort()).toEqual(['a', 'b']);
    expect((await svc.poll('b', tb.ticketId))!.matchId).toBe(m!.matchId); expect(matches.create).toHaveBeenCalledTimes(1);
    const dto = matches.create.mock.calls[0][0]; expect(dto.mode).toBe('ranked_1v1'); expect(dto.players.map((p: any) => p.teamId).sort()).toEqual([0, 1]);
  });

  it('keeps far ratings apart until the window has widened', async () => {
    const { svc, advance } = make({ a: 1000, b: 1400 });
    const ta = await svc.enqueue('a', { queueId: 'ranked_1v1' }); await svc.enqueue('b', { queueId: 'ranked_1v1' });
    expect(await svc.poll('a', ta.ticketId)).toBeNull(); advance(8); expect(await svc.poll('a', ta.ticketId)).toBeNull(); advance(4); expect(await svc.poll('a', ta.ticketId)).not.toBeNull();   // 100 + 25*8 = 300 < 400, 100 + 25*12 = 400
  });

  it('forms a balanced 2v2 only when four players are waiting', async () => {
    const { svc, matches } = make({ a: 1500, b: 1480, c: 1000, d: 990 });
    const t: Record<string, string> = {}; for (const u of ['a', 'b', 'c']) t[u] = (await svc.enqueue(u, { queueId: 'casual_2v2' })).ticketId;
    expect(await svc.poll('a', t.a)).toBeNull(); t.d = (await svc.enqueue('d', { queueId: 'casual_2v2' })).ticketId;
    expect(await svc.poll('d', t.d)).toBeNull();     // 1500 vs 990 is outside the window of the oldest ticket
    expect(matches.create).not.toHaveBeenCalled();
  });

  it('a full 2v2 is split into balanced teams and the answer lists seats, teams and civs in slot order', async () => {
    const { svc } = make({ a: 1500, b: 1490, c: 1480, d: 1470 });
    const t: Record<string, string> = {}; for (const u of ['a', 'b', 'c', 'd']) t[u] = (await svc.enqueue(u, { queueId: 'casual_2v2', civIds: ['civ_' + u] })).ticketId;
    const m = await svc.poll('d', t.d); expect(m).not.toBeNull(); expect(m!.playerIds!.length).toBe(4); expect(m!.teams!.length).toBe(4); expect(m!.teams!.filter((x) => x === 0).length).toBe(2);
    expect(m!.civs).toEqual(m!.playerIds!.map((u) => 'civ_' + u));
    // snake order: the strongest and the weakest share a team (a+d vs b+c)
    const team = (u: string) => m!.teams![m!.playerIds!.indexOf(u)]; expect(team('a')).toBe(team('d')); expect(team('b')).toBe(team('c')); expect(team('a')).not.toBe(team('b'));
  });

  it('refuses vetoes over the limit, double queueing and foreign tickets', async () => {
    const { svc } = make({ a: 1000, b: 1000 });
    await expect(svc.enqueue('a', { queueId: 'ranked_1v1', vetoedMapIds: ['1', '2', '3', '4', '5'] })).rejects.toBeInstanceOf(BadRequestException);
    const ta = await svc.enqueue('a', { queueId: 'ranked_1v1', vetoedMapIds: Array(MAX_VETOES_TEAM).fill('x').map((_, i) => 'm' + i) });
    await expect(svc.enqueue('a', { queueId: 'ranked_1v1' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.poll('b', ta.ticketId)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(svc.enqueue('b', { queueId: 'nope' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('an abandoned ticket (client gone, never polls again) does not block later players', async () => {
    const { svc, advance } = make({ a: 1000, b: 1000, c: 1000, d: 1000 });
    await svc.enqueue('a', { queueId: 'casual_1v1' }); await svc.enqueue('b', { queueId: 'casual_1v1' });   // never polled
    advance(60); const tc = await svc.enqueue('c', { queueId: 'casual_1v1' }); const td = await svc.enqueue('d', { queueId: 'casual_1v1' });
    const m = await svc.poll('c', tc.ticketId); expect(m).not.toBeNull(); expect(m!.playerIds!.sort()).toEqual(['c', 'd']); expect((await svc.poll('d', td.ticketId))!.matchId).toBe(m!.matchId);
  });

  it('cancel removes the ticket from pairing', async () => {
    const { svc } = make({ a: 1000, b: 1000 });
    const ta = await svc.enqueue('a', { queueId: 'ranked_1v1' }); svc.cancel('a', ta.ticketId); const tb = await svc.enqueue('b', { queueId: 'ranked_1v1' });
    expect(await svc.poll('b', tb.ticketId)).toBeNull();
  });

  it('pickMap never returns a vetoed map and ratingWindow widens', () => {
    for (let s = 1; s < 60; s++) expect(pickMap(['x', 'y', 'z'], ['y'], s)).not.toBe('y');
    expect(pickMap(['x'], ['x'], 1)).toBeNull(); expect(ratingWindow(0)).toBe(100); expect(ratingWindow(1000)).toBe(600);
  });

  describe('result consensus', () => {
    it('records the match once every player reports the same winners and state hash', async () => {
      const { svc, matches } = make({}); const r = { winnerUserIds: ['a'], durationTicks: 900, dataHash: 'h1' };
      expect(await svc.reportResult('a', 'm-1', r)).toEqual({ status: 'waiting', missing: 1 }); expect(matches.recordResult).not.toHaveBeenCalled();
      expect(await svc.reportResult('b', 'm-1', r)).toEqual({ status: 'recorded' });
      const dto = matches.recordResult.mock.calls[0][1]; expect(dto.participants).toEqual([{ userId: 'a', isWinner: true, disconnected: false }, { userId: 'b', isWinner: false, disconnected: false }]);
      expect(await svc.reportResult('a', 'm-1', r)).toEqual({ status: 'already_recorded' });
    });
    it('disputes disagreeing reports (different winner or state hash) and records nothing', async () => {
      const { svc, matches } = make({}); await svc.reportResult('a', 'm-1', { winnerUserIds: ['a'], dataHash: 'h1' });
      expect(await svc.reportResult('b', 'm-1', { winnerUserIds: ['b'], dataHash: 'h1' })).toEqual({ status: 'disputed' }); expect(matches.recordResult).not.toHaveBeenCalled();
      const two = make({}); await two.svc.reportResult('a', 'm-1', { winnerUserIds: ['a'], dataHash: 'h1' }); expect(await two.svc.reportResult('b', 'm-1', { winnerUserIds: ['a'], dataHash: 'DIFFERENT' })).toEqual({ status: 'disputed' });
    });
    it('after the grace period a missing player counts as disconnected; outsiders and bogus winners are refused', async () => {
      const { svc, matches, advance } = make({}); await svc.reportResult('a', 'm-1', { winnerUserIds: ['a'], dataHash: 'h' }); advance(121);
      expect(await svc.reportResult('a', 'm-1', { winnerUserIds: ['a'], dataHash: 'h' })).toEqual({ status: 'recorded' }); expect(matches.recordResult.mock.calls[0][1].participants[1]).toEqual({ userId: 'b', isWinner: false, disconnected: true });
      const o = make({}); await expect(o.svc.reportResult('zed', 'm-1', { winnerUserIds: ['a'] })).rejects.toBeInstanceOf(ForbiddenException); await expect(o.svc.reportResult('a', 'm-1', { winnerUserIds: ['zed'] })).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
