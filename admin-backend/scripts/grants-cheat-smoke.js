// Grants / gifts / player insights / cheat engine test against a RUNNING backend.
// Usage: ADMIN_EMAIL=.. ADMIN_PASSWORD=.. [API=http://localhost:3001] node scripts/grants-cheat-smoke.js
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
const sub = (t) => JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString('utf8')).sub;
const stamp = Date.now().toString(36);
async function newPlayer(tag) {
  const r = await call('POST', '/auth/register', { body: { email: `${tag}_${stamp}@example.com`, username: `${tag}_${stamp}`.slice(0, 18), password: 'Str0ng!Passw0rd' } });
  return { token: r.json.accessToken, refresh: r.json.refreshToken, id: sub(r.json.accessToken), email: `${tag}_${stamp}@example.com`, username: `${tag}_${stamp}`.slice(0, 18) };
}
const sync = (p, body = {}) => call('POST', '/session/sync', { token: p.token, body: { state: 'menu', appVersion: '0.2.0', platform: 'android', ...body } });

(async () => {
  const A = (await call('POST', '/admin-auth/login', { body: { email: EMAIL, password: PASSWORD } })).json.accessToken;
  const p = await newPlayer('g');

  // ── direct grants ──
  const grant = await call('POST', '/grants/apply', { token: A, body: { userId: p.id, reason: 'launch gift', rewards: { wallet: { coins: 500, gems: 20 }, items: [{ type: 'flag', id: 'golden_flag' }], packs: ['sultans_ascend'], bonuses: [{ kind: 'starting_resources', payload: { food: 500, wood: 500 }, uses: 2 }, { kind: 'starting_units', payload: [{ type: 'knight', count: 5 }], uses: 1 }], xp: 100 } } });
  ok('admin grants coins, gems, an item, a (paid) PACK, bonuses and XP at once', grant.status === 200 && grant.json.wallet.coins === 500 && grant.json.packs === 1 && grant.json.bonuses === 2 && grant.json.xp === 100, grant.text.slice(0, 200));
  const assets = await call('GET', `/grants/assets/${p.id}`, { token: A });
  ok('wallet shows 500 coins / 20 gems', assets.json?.wallet?.coins === 500 && assets.json.wallet.gems === 20);
  ok('inventory has the item and the pack', assets.json.inventory.some((i) => i.itemType === 'flag') && assets.json.inventory.some((i) => i.itemType === 'pack' && i.itemId === 'sultans_ascend'));
  const ent = await call('GET', '/me/entitlements', { token: p.token });
  ok('the PLAYER sees the pack as owned (entitlements)', ent.json?.packs?.includes('sultans_ascend'), ent.text.slice(0, 120));
  const wal = await call('GET', '/me/wallet', { token: p.token });
  ok('player wallet endpoint matches', wal.json?.coins === 500);
  const bon = await call('GET', '/me/bonuses', { token: p.token });
  ok('player sees both starting bonuses', bon.json?.length === 2 && bon.json.some((b) => b.kind === 'starting_units'), bon.text.slice(0, 120));
  const unit = bon.json.find((b) => b.kind === 'starting_units');
  ok('using a bonus consumes it', (await call('POST', `/me/bonuses/${unit.id}/use`, { token: p.token, body: {} })).status === 200 && (await call('GET', '/me/bonuses', { token: p.token })).json.length === 1);
  ok('using it again fails (404)', (await call('POST', `/me/bonuses/${unit.id}/use`, { token: p.token, body: {} })).status === 404);
  ok('unknown currency is rejected (400)', (await call('POST', '/grants/apply', { token: A, body: { userId: p.id, reason: 'x', rewards: { wallet: { bitcoin: 5 } } } })).status === 400);
  ok('taking more than the player has is rejected (400)', (await call('POST', '/grants/apply', { token: A, body: { userId: p.id, reason: 'x', rewards: { wallet: { coins: -9999 } } } })).status === 400);
  ok('absurd amounts are rejected (400)', (await call('POST', '/grants/apply', { token: A, body: { userId: p.id, reason: 'x', rewards: { wallet: { coins: 99999999 } } } })).status === 400);
  ok('a player cannot grant himself anything (403)', (await call('POST', '/grants/apply', { token: p.token, body: { userId: p.id, reason: 'x', rewards: { wallet: { coins: 1 } } } })).status === 403);
  const led = await call('GET', `/grants/ledger/${p.id}`, { token: A });
  ok('ledger recorded both wallet changes with the reason', led.json?.filter((l) => l.source === 'admin_grant').length >= 2 && led.json.some((l) => l.reason === 'launch gift'), led.text.slice(0, 160));
  const flagItem = assets.json.inventory.find((i) => i.itemType === 'flag');
  ok('revoke an item', (await call('POST', '/grants/revoke-item', { token: A, body: { userId: p.id, inventoryId: flagItem.id, reason: 'granted by mistake' } })).status === 200 && !(await call('GET', `/grants/assets/${p.id}`, { token: A })).json.inventory.some((i) => i.itemType === 'flag'));

  // ── gifts ──
  const gift = await call('POST', '/grants/gifts', { token: A, body: { target: { usernames: [p.username] }, title: { en: 'Welcome', tr: 'Hos geldin' }, body: { en: 'Enjoy', tr: 'Keyfini cikar' }, rewards: { wallet: { coins: 100 }, packs: ['dynasties_of_the_east'] }, expiresInDays: 7 } });
  ok('gift sent to a player by username', gift.status === 200 && gift.json.recipients === 1, gift.text.slice(0, 150));
  const mine = await call('GET', '/me/gifts?locale=tr', { token: p.token });
  ok('player mailbox shows the gift in Turkish', mine.json?.length === 1 && mine.json[0].title === 'Hos geldin', mine.text.slice(0, 150));
  const gid = mine.json[0].id;
  const [c1, c2] = await Promise.all([call('POST', `/me/gifts/${gid}/claim`, { token: p.token, body: {} }), call('POST', `/me/gifts/${gid}/claim`, { token: p.token, body: {} })]);
  ok('double-tap claim grants exactly ONCE', [c1.status, c2.status].sort().join() === '200,409', `${c1.status} ${c2.status}`);
  const after = await call('GET', `/grants/assets/${p.id}`, { token: A });
  ok('claim added 100 coins (not 200) and the second pack', after.json.wallet.coins === 600 && after.json.inventory.some((i) => i.itemId === 'dynasties_of_the_east'), JSON.stringify(after.json.wallet));
  ok('a player cannot claim someone else\'s gift (404)', (await call('POST', `/me/gifts/${gid}/claim`, { token: (await newPlayer('x')).token, body: {} })).status === 404);
  const seg = await call('POST', '/grants/gifts/preview', { token: A, body: { target: { all: true, platform: 'android' } } });
  ok('segment preview counts recipients before sending', seg.status === 200 && typeof seg.json.recipients === 'number', seg.text.slice(0, 120));

  // ── insights ──
  await sync(p, { state: 'menu' }); await sleep(2200); await sync(p, { state: 'match' }); await sleep(2200); await sync(p, { state: 'match' });
  const found = await call('GET', `/insights/players?q=${encodeURIComponent(p.username)}`, { token: A });
  ok('player search finds the player', found.json?.players?.[0]?.userId === p.id, found.text.slice(0, 160));
  const file = await call('GET', `/insights/players/${p.id}`, { token: A });
  ok('player file: play time measured by the server (menu + match seconds)', file.json?.playtime?.sessions >= 1 && file.json.playtime.matchSeconds >= 2 && file.json.playtime.menuSeconds >= 2, JSON.stringify(file.json?.playtime));
  ok('player file: economy + purchases + devices + moderation blocks present', !!file.json?.economy?.wallet && Array.isArray(file.json.economy.purchases) && !!file.json.network && !!file.json.moderation, file.text.slice(0, 100));
  const summ = await call('GET', '/insights/summary', { token: A });
  ok('global summary: players, online, DAU, revenue, platforms', summ.status === 200 && summ.json.players.total >= 1 && summ.json.activity.onlineNow >= 1 && Array.isArray(summ.json.platforms), summ.text.slice(0, 160));

  // ── cheat engine ──
  const io = (() => { try { return require('socket.io-client').io; } catch { return null; } })();
  let liveAlert = null;
  if (io) { const s = io(API + '/admin', { auth: { token: A }, transports: ['websocket'], reconnection: false }); s.on('cheat:alert', (d) => { liveAlert = d; }); await sleep(600); }
  const c = await newPlayer('c'); await sync(c);
  const rep = await call('POST', '/integrity/report', { token: c.token, body: { type: 'memory_tamper', detail: { region: 'gold', old: 100, new: 99999 }, deviceId: 'dev-' + stamp, appVersion: '0.2.0', platform: 'android' } });
  ok('client integrity report raises a cheat flag', rep.status === 200 && rep.json.ok, rep.text.slice(0, 120));
  await sleep(800);
  ok('...and the panel gets it LIVE over the WebSocket', !io || (liveAlert && liveAlert.userId === c.id && liveAlert.type === 'client_tamper'), JSON.stringify(liveAlert));
  const flags = await call('GET', `/cheatwatch/flags?userId=${c.id}`, { token: A });
  ok('flag listed with player name and severity high', flags.json?.[0]?.flagType === 'client_tamper' && flags.json[0].severity === 'high' && flags.json[0].username === c.username, flags.text.slice(0, 160));
  const detail = await call('GET', `/cheatwatch/flags/${flags.json[0].id}`, { token: A });
  ok('flag detail carries the evidence (what, where from)', detail.json?.flag?.data?.ctx?.deviceId === 'dev-' + stamp && detail.json.flag.data.clientType === 'memory_tamper' && detail.json.online === true, detail.text.slice(0, 200));
  await call('POST', '/integrity/report', { token: c.token, body: { type: 'memory_tamper', detail: { again: true }, matchId: 'match-2-' + stamp } });
  await sleep(400);
  const ban1 = await call('GET', `/moderation/history/${c.id}`, { token: A });
  ok('second strike -> automatic 72 h ban with the evidence stored', ban1.json?.bans?.some((b) => b.type === 'temporary' && b.bannedBy === 'cheat-engine' && b.evidence?.includes('client_tamper')), ban1.text.slice(0, 200));
  const before = (await call('GET', `/cheatwatch/flags?userId=${c.id}`, { token: A })).json.length;
  await call('POST', '/integrity/report', { token: c.token, body: { type: 'memory_tamper', detail: { again: true }, matchId: 'match-2-' + stamp } });
  const afterN = (await call('GET', `/cheatwatch/flags?userId=${c.id}`, { token: A })).json.length;
  ok('the same finding repeated within 10 minutes is de-duplicated (no flag flood)', afterN === before, `${before} -> ${afterN}`);
  const c2s = await sync(c);
  ok('the auto-banned cheater is locked out of the game (sync refused)', [401, 403].includes(c2s.status), c2s.status);

  // modified game data via a real match
  const m1 = await newPlayer('m1'), m2 = await newPlayer('m2');
  const boot = (await call('GET', '/live/bootstrap?platform=android&version=0.2.0')).json; const goodHash = boot.content.hash;
  const e1 = await call('POST', '/matchmaking/enqueue', { token: m1.token, body: { queueId: 'casual_1v1', contentHash: goodHash } });
  const e2 = await call('POST', '/matchmaking/enqueue', { token: m2.token, body: { queueId: 'casual_1v1', contentHash: goodHash } });
  ok('both players queue with the correct data hash', (e1.status === 201 || e1.status === 200) && (e2.status === 201 || e2.status === 200), `${e1.status} ${e1.text.slice(0, 100)} | ${e2.status}`);
  let match = null; for (let i = 0; i < 12 && !match; i++) { const a = await call('GET', `/matchmaking/${e1.json.ticketId}`, { token: m1.token }); match = a.json?.match; if (!match) { await call('GET', `/matchmaking/${e2.json.ticketId}`, { token: m2.token }); await sleep(400); } }
  ok('a match was formed', !!match, 'no match');
  if (match) {
    const winner = [m1.id];
    await call('POST', `/matchmaking/match/${match.matchId}/report`, { token: m1.token, body: { winnerUserIds: winner, durationTicks: 9000, dataHash: 'abc', contentHash: 'TAMPERED-DATA-HASH' } });
    await call('POST', `/matchmaking/match/${match.matchId}/report`, { token: m2.token, body: { winnerUserIds: winner, durationTicks: 9000, dataHash: 'abc', contentHash: goodHash } });
    await sleep(800);
    const fl = await call('GET', `/cheatwatch/flags?userId=${m1.id}&type=modified_game_data`, { token: A });
    ok('reporting with a different data hash raises "modified_game_data" (critical)', fl.json?.[0]?.severity === 'critical', fl.text.slice(0, 160));
    const h = await call('GET', `/moderation/history/${m1.id}`, { token: A });
    ok('...and the engine banned the player automatically (3 days)', h.json?.bans?.some((b) => b.bannedBy === 'cheat-engine' && b.type === 'temporary'), h.text.slice(0, 200));
    const dis = await call('POST', `/cheatwatch/flags/${fl.json[0].id}/resolve`, { token: A, body: { action: 'dismiss', note: 'test: false positive' } });
    ok('dismissing the finding as a false positive lifts the automatic ban', dis.status === 200 && (await call('POST', '/auth/login', { body: { email: m1.email, password: 'Str0ng!Passw0rd' } })).status === 200, dis.text.slice(0, 120));
  }

  // ban evasion + device bans
  const dev = 'shared-dev-' + stamp;
  const b1 = await newPlayer('b'); await sync(b1, { deviceId: dev });
  await call('POST', '/moderation/ban', { token: A, body: { userId: b1.id, type: 'permanent', reason: 'cheating' } });
  const alt = await newPlayer('alt'); const altSync = await sync(alt, { deviceId: dev });
  await sleep(500);
  const evasion = await call('GET', `/cheatwatch/flags?userId=${alt.id}&type=ban_evasion`, { token: A });
  ok('new account on a banned player\'s device is flagged as ban evasion (critical)', altSync.status === 200 && evasion.json?.[0]?.severity === 'critical', `${altSync.status} ${evasion.text.slice(0, 120)}`);
  ok('...and gets banned automatically (403 BANNED)', (await sync(alt, { deviceId: dev })).status === 403);
  const bd = await call('POST', '/cheatwatch/device-bans', { token: A, body: { deviceId: 'evil-dev-' + stamp, reason: 'botnet device' } });
  const fresh = await newPlayer('f'); const blocked = await sync(fresh, { deviceId: 'evil-dev-' + stamp });
  ok('device ban: any account from that device is refused at once (403 BANNED_DEVICE)', bd.status === 200 && blocked.status === 403 && blocked.text.includes('BANNED_DEVICE'), `${bd.status} ${blocked.status} ${blocked.text.slice(0, 100)}`);
  const f2 = await call('GET', '/cheatwatch/stats', { token: A });
  ok('cheat stats: open flags, 24 h, automatic actions, per type', f2.status === 200 && f2.json.openFlags >= 1 && Array.isArray(f2.json.byType7d), f2.text.slice(0, 160));
  const pol = await call('GET', '/cheatwatch/policy', { token: A });
  ok('policy lists every cheat type with severity and punishment', pol.json?.autoEnforce === true && pol.json.rules.modified_game_data.auto.type === 'temp_ban', pol.text.slice(0, 160));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
