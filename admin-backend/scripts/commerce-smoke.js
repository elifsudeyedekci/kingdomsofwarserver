// Store / purchase / support / privacy / ladder / system-health test against a RUNNING backend (dev payment mode).
// Usage: ADMIN_EMAIL=.. ADMIN_PASSWORD=.. [API=http://localhost:3001] node scripts/commerce-smoke.js
const API = process.env.API || 'http://localhost:3001';
const EMAIL = process.env.ADMIN_EMAIL, PASSWORD = process.env.ADMIN_PASSWORD;
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { (cond ? pass++ : fail++); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '  -> ' + extra}`); };
async function call(method, path, { token, body } = {}) {
  const r = await fetch(API + path, { method, headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* raw */ }
  return { status: r.status, json, text };
}
const sub = (t) => JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString('utf8')).sub;
const stamp = Date.now().toString(36);
async function player(tag) { const r = await call('POST', '/auth/register', { body: { email: `${tag}_${stamp}@example.com`, username: `${tag}_${stamp}`.slice(0, 18), password: 'Str0ng!Passw0rd' } }); return { token: r.json.accessToken, id: sub(r.json.accessToken), email: `${tag}_${stamp}@example.com` }; }

(async () => {
  const A = (await call('POST', '/admin-auth/login', { body: { email: EMAIL, password: PASSWORD } })).json.accessToken;

  // ── catalog ──
  const bad = await call('POST', '/store/products', { token: A, body: { nameKey: 'bad', priceUsd: 1, contents: { wallet: { bitcoin: 1 } } } });
  ok('a product with an invalid contents bundle is rejected (400)', bad.status === 400, `${bad.status} ${bad.text.slice(0, 100)}`);
  const prod = await call('POST', '/store/products', { token: A, body: { nameKey: `test.pack.${stamp}`, priceUsd: 7.49, skuAndroid: `com.test.pack.${stamp}`, skuIos: `pack_${stamp}`, isConsumable: false, contents: { packs: [{ id: 'sultans-ascend' }], wallet: { gems: 120 }, bonuses: [{ kind: 'starting_resources', payload: { food: 300 }, uses: 2 }] } } });
  ok('admin creates a product that delivers a pack + gems + a bonus', prod.status === 201 || prod.status === 200, prod.text.slice(0, 160));
  const pid = prod.json.id;
  const p = await player('b');
  const pub = await call('GET', '/store/products?limit=100', { token: p.token });
  ok('player sees the active product', pub.json?.items?.some((x) => x.id === pid));
  const sneaky = await call('GET', '/store/products?includeInactive=true&limit=100', { token: p.token });
  await call('POST', `/store/products/${pid}/toggle`, { token: A, body: {} });
  const hidden = await call('GET', '/store/products?includeInactive=true&limit=100', { token: p.token });
  ok('a player cannot see inactive products even with includeInactive=true', !hidden.json?.items?.some((x) => x.id === pid), 'leaked');
  await call('POST', `/store/products/${pid}/toggle`, { token: A, body: {} });
  void sneaky;

  // ── purchase (dev mode: platform "editor") ──
  const tx = `tx-${stamp}-1`;
  const buy = await call('POST', '/store/purchase', { token: p.token, body: { platform: 'editor', sku: `com.test.pack.${stamp}`, transactionId: tx, receipt: 'dev-receipt' } });
  ok('dev purchase is verified and delivered', buy.status === 200 && buy.json?.status === 'granted', buy.text.slice(0, 200));
  const ent = await call('GET', '/me/entitlements', { token: p.token });
  const wal = await call('GET', '/me/wallet', { token: p.token });
  const bon = await call('GET', '/me/bonuses', { token: p.token });
  ok('the pack is owned, 120 gems arrived, the starting bonus exists', ent.json?.packs?.includes('sultans-ascend') && wal.json?.gems === 120 && bon.json?.length === 1);
  const again = await call('POST', '/store/purchase', { token: p.token, body: { platform: 'editor', sku: `com.test.pack.${stamp}`, transactionId: tx, receipt: 'dev-receipt' } });
  ok('repeating the same transaction grants nothing more (idempotent)', again.status === 200 && again.json?.status === 'already_granted' && (await call('GET', '/me/wallet', { token: p.token })).json.gems === 120, again.text.slice(0, 120));
  const [r1, r2] = await Promise.all([1, 2].map(() => call('POST', '/store/purchase', { token: p.token, body: { platform: 'editor', sku: `com.test.pack.${stamp}`, transactionId: `tx-${stamp}-par`, receipt: 'x' } })));
  ok('two parallel requests for ONE transaction deliver exactly once', (await call('GET', '/me/wallet', { token: p.token })).json.gems === 240, `${r1.status}/${r2.status} gems=${(await call('GET', '/me/wallet', { token: p.token })).json.gems}`);
  const other = await player('o');
  const steal = await call('POST', '/store/purchase', { token: other.token, body: { platform: 'editor', sku: `com.test.pack.${stamp}`, transactionId: tx, receipt: 'dev-receipt' } });
  ok('another account cannot reuse that transaction id (409)', steal.status === 409, steal.status);
  ok('real store purchase without server credentials is refused (fails closed)', [400, 503].includes((await call('POST', '/store/purchase', { token: other.token, body: { platform: 'android', sku: `com.test.pack.${stamp}`, transactionId: 'real-1', receipt: 'tok' } })).status));
  ok('unknown sku -> 404', (await call('POST', '/store/purchase', { token: other.token, body: { platform: 'editor', sku: 'nope', transactionId: 'z', receipt: 'x' } })).status === 404);
  ok('a player token cannot create products (403)', (await call('POST', '/store/products', { token: p.token, body: { nameKey: 'x', priceUsd: 1, contents: {} } })).status === 403);

  // refund takes the pack back
  const purchases = await call('GET', `/payment/player/${p.id}`, { token: A });
  const pur = purchases.json?.items?.find((x) => x.transactionId === tx);
  const rf = await call('POST', `/payment/${pur.id}/refund`, { token: A, body: { reason: 'test refund', revokeContents: true } });
  ok('refund with "revoke contents" takes the pack back', rf.status === 201 || rf.status === 200, rf.text.slice(0, 120));
  ok('...the pack is gone from the player', !(await call('GET', '/me/entitlements', { token: p.token })).json.packs.includes('sultans-ascend'));

  // ── support ──
  const t = await call('POST', '/me/support', { token: p.token, body: { subject: 'Cannot connect to match', body: 'After the update I get error 503 every time.', category: 'technical' } });
  ok('player opens a support ticket', t.status === 200 || t.status === 201, t.text.slice(0, 140));
  const tid = t.json.id;
  const mine = await call('GET', '/me/support', { token: p.token });
  ok('player sees only his own tickets', mine.json?.items?.length === 1 && mine.json.items[0].id === tid, mine.text.slice(0, 100));
  ok('another player cannot reply to it (403)', (await call('POST', `/me/support/${tid}/reply`, { token: other.token, body: { body: 'hello' } })).status === 403);
  const rep = await call('POST', `/support/${tid}/reply`, { token: A, body: { body: 'We are on it.', senderId: 'spoof', isAdminReply: false } });
  const full = await call('GET', `/support/${tid}`, { token: A });
  const last = full.json?.messages?.[full.json.messages.length - 1];
  ok('an admin reply is attributed to the real admin (the body cannot spoof it)', rep.status === 200 || rep.status === 201, rep.text.slice(0, 100));
  ok('...and marked as an admin reply', last?.isAdminReply === true && last?.senderId !== 'spoof', JSON.stringify(last));
  ok('player sees the answer in his ticket', (await call('GET', '/me/support', { token: p.token })).json.items[0].messages.length === 2);

  // ── ladder + health + season endpoints ──
  const lad = await call('GET', '/me/ladder?top=10', { token: p.token });
  ok('player ladder endpoint answers (top list + own position)', lad.status === 200 && Array.isArray(lad.json?.top) && 'you' in lad.json, lad.text.slice(0, 100));
  const h = await call('GET', '/system/health', { token: A });
  ok('system health is real: db latency, memory, uptime, online players', h.status === 200 && h.json.database.ok && h.json.server.memoryMB > 0 && h.json.server.uptimeSeconds >= 0 && typeof h.json.game.onlinePlayers === 'number', h.text.slice(0, 160));
  ok('active season with none set answers 200 (no error)', (await call('GET', '/liveops/season/active', { token: A })).status === 200);
  ok('season list answers', (await call('GET', '/liveops/season', { token: A })).status === 200);
  const eco = await call('GET', '/grants/economy?days=30', { token: A });
  ok('economy summary answers with circulation + flows', eco.status === 200 && eco.json.circulation && Array.isArray(eco.json.flows), eco.text.slice(0, 120));
  const legal = await call('GET', '/live/legal?lang=tr');
  ok('published legal texts are public (empty list is fine)', legal.status === 200 && Array.isArray(legal.json));

  // ── privacy: export + erase ──
  const exp = await call('GET', '/me/privacy/export', { token: p.token });
  ok('player can download everything stored about him', exp.status === 200 && exp.json?.format === 'kow-player-data-v1' && exp.json.purchases?.length >= 1 && !JSON.stringify(exp.json).includes('passwordHash'), exp.text.slice(0, 100));
  ok('account deletion needs the explicit confirmation word (400)', (await call('POST', '/me/privacy/delete', { token: p.token, body: { confirm: 'yes' } })).status === 400);
  const del = await call('POST', '/me/privacy/delete', { token: p.token, body: { confirm: 'DELETE' } });
  ok('account is erased', del.status === 200 && del.json?.erased === true, del.text.slice(0, 100));
  const after = await call('GET', `/insights/players/${p.id}`, { token: A });
  ok('personal data is gone (no e-mail, anonymised name) but the purchase record stays', after.json?.email === null && /^deleted-/.test(after.json?.profile?.username ?? '') && after.json?.economy?.purchases?.length >= 1, JSON.stringify({ e: after.json?.email, u: after.json?.profile?.username }));
  ok('the erased player can no longer sign in', (await call('POST', '/auth/login', { body: { email: p.email, password: 'Str0ng!Passw0rd' } })).status === 401);
  ok('...and the old token is dead', [401, 403].includes((await call('GET', '/me/wallet', { token: p.token })).status));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
