// Malformed / hostile input against every client-facing route: must answer 4xx (never 5xx, never hang). Usage: ADMIN_EMAIL=.. ADMIN_PASSWORD=.. node scripts/robustness-smoke.js
const API = process.env.API || 'http://localhost:3001';
let pass = 0, fail = 0; const ok = (n, c, x = '') => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${c ? '' : '  -> ' + x}`); };
async function call(method, path, { token, body, raw, headers } = {}) {
  const r = await fetch(API + path, { method, headers: { ...(body !== undefined || raw !== undefined ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: 'Bearer ' + token } : {}), ...(headers || {}) }, body: raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) });
  const t = await r.text(); return { status: r.status, text: t };
}
(async () => {
  const g = await call('POST', '/auth/guest', { body: { guestId: 'robust-' + Date.now() + '-abcdefgh', secret: 'abcdefghijklmnopqrstuvwxyz0123' } });
  const P = JSON.parse(g.text).accessToken;
  const routes = [['POST', '/session/sync'], ['POST', '/store/purchase'], ['POST', '/me/gifts/not-a-uuid/claim'], ['POST', '/me/bonuses/x/use'], ['POST', '/me/support'], ['POST', '/me/privacy/delete'], ['POST', '/cheat/report'], ['POST', '/auth/refresh'], ['POST', '/auth/guest'], ['POST', '/matchmaking/queue'], ['GET', '/me/ladder?top=abc'], ['GET', '/me/gifts?locale=%00'], ['GET', '/live/bootstrap?platform=toaster&version=1.2.3.4.5&contentVersion=-1'], ['GET', '/live/content/abc?path=../../etc/passwd'], ['GET', '/live/content/1?path=Data/Balance/x.json']];
  const bodies = ['{', '[]', 'null', '"str"', '{"a":' + '1'.repeat(5000) + '}', '{"sku":{"$ne":1}}', '{"__proto__":{"x":1}}', '{"state":"<script>"}', '{"waitSeconds":-5}', '{"waitSeconds":1e999}'];
  let bad = [];
  for (const [m, p] of routes) for (const b of (m === 'GET' ? [undefined] : bodies)) {
    for (const tok of [P, undefined]) {
      let r; try { r = await call(m, p, { token: tok, raw: b }); } catch (e) { bad.push(`${m} ${p} ${b?.slice(0, 20)} -> ${e.name}`); continue; }
      if (r.status >= 500) bad.push(`${m} ${p} body=${(b ?? '').slice(0, 25)} tok=${!!tok} -> ${r.status}`);
    }
  }
  ok('no client-facing route returns 5xx or hangs on malformed input (' + routes.length + ' routes x bodies x auth/no-auth)', bad.length === 0, bad.slice(0, 5).join(' | '));
  const big = await call('POST', '/session/sync', { token: P, raw: '{"x":"' + 'a'.repeat(400000) + '"}' });
  ok('oversized body -> 413', big.status === 413, big.status);
  const ct = await call('POST', '/session/sync', { token: P, raw: 'x=1', headers: { 'content-type': 'text/plain' } });
  ok('wrong content type does not crash (no 5xx)', ct.status < 500, ct.status);
  const tok = await call('GET', '/me/wallet', { token: P + 'x' });
  ok('tampered token -> 401', tok.status === 401, tok.status);
  const none = await call('GET', '/me/wallet', { token: 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJ4In0.' });
  ok('alg=none token -> 401', none.status === 401, none.status);
  const adm = await call('GET', '/admin/dashboard/stats', { token: P });
  ok('player token on the admin API -> 403', adm.status === 403, adm.status);
  const sql = await call('POST', '/auth/login', { body: { email: "' OR 1=1 --@x.com", password: 'x' } });
  ok('SQL-injection style login -> 4xx', sql.status >= 400 && sql.status < 500, sql.status);
  const A = await call('POST', '/admin-auth/login', { body: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD } });
  const AT = JSON.parse(A.text).accessToken; let abad = [];
  for (const [m, p] of [['POST', '/grants/apply'], ['POST', '/grants/gifts'], ['POST', '/moderation/ban'], ['POST', '/moderation/kick'], ['PUT', '/live-admin/settings'], ['POST', '/live-admin/announcements'], ['POST', '/store/products'], ['PUT', '/content/file'], ['POST', '/content/publish'], ['POST', '/cheatwatch/device-bans']])
    for (const b of bodies) { const r = await call(m, p, { token: AT, raw: b }); if (r.status >= 500) abad.push(`${m} ${p} ${b.slice(0, 20)} -> ${r.status}`); }
  ok('admin write routes answer 4xx (not 5xx) on malformed input', abad.length === 0, abad.slice(0, 5).join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
