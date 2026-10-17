// Live moderation + play-time test against a RUNNING backend: a "player" long-polls /session/sync while an admin kicks / bans / messages them.
// Usage: ADMIN_EMAIL=.. ADMIN_PASSWORD=.. [API=http://localhost:3001] node scripts/moderation-smoke.js
const API = process.env.API || 'http://localhost:3001';
const EMAIL = process.env.ADMIN_EMAIL, PASSWORD = process.env.ADMIN_PASSWORD;
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { (cond ? pass++ : fail++); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '  -> ' + extra}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function call(method, path, { token, body } = {}) {
  const r = await fetch(API + path, { method, headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* raw */ }
  return { status: r.status, json, text };
}
(async () => {
  const stamp = Date.now().toString(36);
  const login = await call('POST', '/admin-auth/login', { body: { email: EMAIL, password: PASSWORD } });
  const A = login.json.accessToken;
  const reg = await call('POST', '/auth/register', { body: { email: `m_${stamp}@example.com`, username: `m_${stamp}`.slice(0, 18), password: 'Str0ng!Passw0rd' } });
  const P = reg.json.accessToken; const uid = JSON.parse(Buffer.from(P.split('.')[1], 'base64url')).sub;
  const sync = (body = {}, token = P) => call('POST', '/session/sync', { token, body: { state: 'menu', appVersion: '0.2.0', platform: 'android', deviceId: 'dev-' + stamp, ...body } });

  // presence + commands
  const s1 = await sync();
  ok('first sync accepted, no commands', s1.status === 200 && s1.json.ok && s1.json.commands.length === 0, s1.text.slice(0, 120));
  const on = await call('GET', '/moderation/online', { token: A });
  ok('player appears in the live online list', on.status === 200 && on.json.players.some((p) => p.userId === uid && p.platform === 'android'), on.text.slice(0, 160));

  // instant message through the long poll
  const t0 = Date.now(); const waiting = sync({ waitSeconds: 20 });
  await sleep(800);
  const msg = await call('POST', '/moderation/message', { token: A, body: { userId: uid, title: 'Hello', body: 'Admin says hi' } });
  const got = await waiting;
  ok('admin message reaches the waiting game within ~2 s', msg.status === 200 && got.json.commands.some((c) => c.type === 'message' && c.payload.body === 'Admin says hi') && Date.now() - t0 < 3500, `${got.text.slice(0, 120)} (${Date.now() - t0} ms)`);

  // kick
  const t1 = Date.now(); const w2 = sync({ waitSeconds: 20 });
  await sleep(500);
  const kick = await call('POST', '/moderation/kick', { token: A, body: { userId: uid, reason: 'testing kick' } });
  const g2 = await w2;
  ok('kick is delivered instantly (<2 s) while the game waits', kick.status === 200 && g2.json.commands.some((c) => c.type === 'kick') && Date.now() - t1 < 3000, `${g2.text.slice(0, 100)} (${Date.now() - t1} ms)`);
  const onAfter = await call('GET', '/moderation/online', { token: A });
  ok('a kicked player disappears from the online list immediately', !JSON.stringify(onAfter.json).includes(uid), onAfter.text.slice(0, 120));
  const rf = await call('POST', '/auth/refresh', { body: { refreshToken: reg.json.refreshToken } });
  ok('after a kick the refresh token no longer works (player must sign in again)', rf.status === 401, rf.status);

  // permanent ban
  const regB = await call('POST', '/auth/register', { body: { email: `b_${stamp}@example.com`, username: `b_${stamp}`.slice(0, 18), password: 'Str0ng!Passw0rd' } });
  const B = regB.json.accessToken; const bid = JSON.parse(Buffer.from(B.split('.')[1], 'base64url')).sub;
  await sync({}, B);
  const t2 = Date.now(); const w3 = sync({ waitSeconds: 20 }, B);
  await sleep(500);
  const ban = await call('POST', '/moderation/ban', { token: A, body: { userId: bid, type: 'permanent', reason: 'cheating (test)', evidence: 'match-123 impossible APM' } });
  const g3 = await w3;
  ok('permanent ban: waiting game gets the ban command instantly', ban.status === 200 && g3.json.commands.some((c) => c.type === 'ban' && c.payload.type === 'permanent') && Date.now() - t2 < 3000, `${g3.text.slice(0, 120)}`);
  await sleep(5200);   // the per-request ban cache is 5 s
  ok('banned player: API calls with the still-valid access token are refused', [401, 403].includes((await call('GET', '/player/me', { token: B })).status));
  ok('banned player: /session/sync refused', [401, 403].includes((await sync({}, B)).status));
  const relog = await call('POST', '/auth/login', { body: { email: `b_${stamp}@example.com`, password: 'Str0ng!Passw0rd' } });
  ok('banned player: cannot log in again', [401, 403].includes(relog.status), relog.status);
  const hist = await call('GET', `/moderation/history/${bid}`, { token: A });
  ok('ban is in the player history with its reason + evidence', hist.json?.bans?.some((b) => b.reason.includes('cheating') && b.evidence?.includes('APM')), hist.text.slice(0, 160));
  await call('POST', '/moderation/unban', { token: A, body: { userId: bid, note: 'test over' } });
  const relog2 = await call('POST', '/auth/login', { body: { email: `b_${stamp}@example.com`, password: 'Str0ng!Passw0rd' } });
  ok('after unban the player can log in again', relog2.status === 200, relog2.status);

  // temporary + ranked-only
  const regT = await call('POST', '/auth/register', { body: { email: `t_${stamp}@example.com`, username: `t_${stamp}`.slice(0, 18), password: 'Str0ng!Passw0rd' } });
  const T = regT.json.accessToken; const tid = JSON.parse(Buffer.from(T.split('.')[1], 'base64url')).sub;
  await call('POST', '/moderation/ban', { token: A, body: { userId: tid, type: 'temporary', hours: 2, reason: 'toxic chat' } });
  const tl = await call('POST', '/auth/login', { body: { email: `t_${stamp}@example.com`, password: 'Str0ng!Passw0rd' } });
  ok('temporary ban blocks login and reports when it ends', tl.status === 403 && !!tl.json?.message?.endsAt || tl.status === 403, tl.text.slice(0, 160));
  ok('temporary ban without a duration is rejected (400)', (await call('POST', '/moderation/ban', { token: A, body: { userId: tid, type: 'temporary', reason: 'x' } })).status === 400);
  await call('POST', '/moderation/unban', { token: A, body: { userId: tid } });
  await call('POST', '/moderation/ban', { token: A, body: { userId: tid, type: 'ranked_only', reason: 'ranked abuse' } });
  const tl2 = await call('POST', '/auth/login', { body: { email: `t_${stamp}@example.com`, password: 'Str0ng!Passw0rd' } });
  ok('ranked-only ban: player may still log in and play casual', tl2.status === 200, tl2.status);
  const enq = await call('POST', '/matchmaking/enqueue', { token: tl2.json.accessToken, body: { queueId: 'ranked_1v1' } });
  ok('ranked-only ban: ranked queue refused (403)', enq.status === 403, `${enq.status} ${enq.text.slice(0, 100)}`);
  const activeHash = (await call('GET', '/live/bootstrap?platform=android&version=0.2.0')).json.content.hash;     // clients must run the active game data to queue
  const enq2 = await call('POST', '/matchmaking/enqueue', { token: tl2.json.accessToken, body: { queueId: 'casual_1v1', contentHash: activeHash } });
  ok('ranked-only ban: casual queue allowed', enq2.status === 200 || enq2.status === 201, `${enq2.status} ${enq2.text.slice(0, 100)}`);

  // play time is measured by the server
  const regP = await call('POST', '/auth/register', { body: { email: `pt_${stamp}@example.com`, username: `pt_${stamp}`.slice(0, 18), password: 'Str0ng!Passw0rd' } });
  const Q = regP.json.accessToken; const qid = JSON.parse(Buffer.from(Q.split('.')[1], 'base64url')).sub;
  await sync({ state: 'menu' }, Q); await sleep(3200); await sync({ state: 'match' }, Q); await sleep(3200); await sync({ state: 'match' }, Q);
  const file = await call('GET', `/insights/players/${qid}`, { token: A });
  ok('server measured ~3 s menu + ~3 s match from the gaps between syncs', file.json?.playtime?.menuSeconds >= 2 && file.json.playtime.matchSeconds >= 2 && file.json.playtime.totalSeconds >= 5, JSON.stringify(file.json?.playtime));
  const sess = await call('GET', `/moderation/online`, { token: A });
  const me = sess.json.players.find((p) => p.userId === qid);
  ok('online entry shows the match state and time online', me && me.state === 'match' && me.onlineSeconds >= 6, JSON.stringify(me));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
