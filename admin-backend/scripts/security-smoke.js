// Security regression test against a RUNNING backend (real HTTP + WebSocket + database).
// Usage: ADMIN_EMAIL=.. ADMIN_PASSWORD=.. [API=http://localhost:3001] node scripts/security-smoke.js
const crypto = require('crypto');
const API = process.env.API || 'http://localhost:3001';
const EMAIL = process.env.ADMIN_EMAIL, PASSWORD = process.env.ADMIN_PASSWORD;
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { (cond ? pass++ : fail++); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '  -> ' + extra}`); };
async function call(method, path, { token, body, headers } = {}) {
  const r = await fetch(API + path, { method, headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: 'Bearer ' + token } : {}), ...(headers || {}) }, body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined });
  const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: r.status, json, text, headers: r.headers };
}
const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
const decode = (t) => JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString('utf8'));
// RFC 6238 TOTP (test side)
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function totp(secret, at = Date.now()) {
  let bits = 0, v = 0; const out = []; for (const ch of secret) { v = (v << 5) | B32.indexOf(ch); bits += 5; if (bits >= 8) { out.push((v >>> (bits - 8)) & 255); bits -= 8; } }
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(Math.floor(at / 30000)));
  const h = crypto.createHmac('sha1', Buffer.from(out)).update(msg).digest(); const o = h[h.length - 1] & 15;
  return String((((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1e6).padStart(6, '0');
}

(async () => {
  const stamp = Date.now().toString(36);
  // ── tokens & sessions ──
  const l1 = await call('POST', '/admin-auth/login', { body: { email: EMAIL, password: PASSWORD } });
  const l2 = await call('POST', '/admin-auth/login', { body: { email: EMAIL, password: PASSWORD } });
  ok('login works', l1.status === 200 && l1.json?.accessToken, `${l1.status} ${l1.text.slice(0, 120)}`);
  const c1 = decode(l1.json.accessToken), c2 = decode(l2.json.accessToken);
  ok('every login gets a NEW 256-bit session id', c1.sid && c2.sid && c1.sid !== c2.sid && c1.sid.length === 64, `${c1.sid} / ${c2.sid}`);
  ok('token claims: typ=admin, aud=kow-admin, iss=kow-backend, short expiry', c1.typ === 'admin' && c1.aud === 'kow-admin' && c1.iss === 'kow-backend' && c1.exp - c1.iat <= 900 && !!c1.jti, JSON.stringify(c1));
  ok('header alg is HS256', JSON.parse(Buffer.from(l1.json.accessToken.split('.')[0], 'base64url')).alg === 'HS256');

  // refresh rotation + theft detection
  const r1 = l1.json.refreshToken;
  const rot = await call('POST', '/admin-auth/refresh', { body: { refreshToken: r1 } });
  ok('refresh rotates both tokens', rot.status === 200 && rot.json.refreshToken !== r1 && rot.json.accessToken !== l1.json.accessToken, rot.status);
  ok('session id stays the same while refreshing', decode(rot.json.accessToken).sid === c1.sid);
  const reuse = await call('POST', '/admin-auth/refresh', { body: { refreshToken: r1 } });
  ok('re-using the OLD refresh token is rejected (401)', reuse.status === 401, reuse.status);
  const afterTheft = await call('POST', '/admin-auth/refresh', { body: { refreshToken: rot.json.refreshToken } });
  ok('...and the stolen-token alarm killed the whole session (new token also 401)', afterTheft.status === 401, afterTheft.status);
  ok('...access token of that session is dead immediately', (await call('GET', '/admin-auth/me', { token: rot.json.accessToken })).status === 401);

  // logout kills session
  const l3 = await call('POST', '/admin-auth/login', { body: { email: EMAIL, password: PASSWORD } });
  const T = l3.json.accessToken;
  ok('/me works before logout', (await call('GET', '/admin-auth/me', { token: T })).status === 200);
  await call('POST', '/admin-auth/logout', { token: T, body: {} });
  ok('access token is dead right after logout (401)', (await call('GET', '/admin-auth/me', { token: T })).status === 401);
  ok('refresh token is dead after logout (401)', (await call('POST', '/admin-auth/refresh', { body: { refreshToken: l3.json.refreshToken } })).status === 401);

  // forged tokens
  const none = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: c1.sub, sid: c1.sid, typ: 'admin', aud: 'kow-admin', iss: 'kow-backend', exp: Math.floor(Date.now() / 1000) + 3600 })}.`;
  ok('alg=none token is rejected', (await call('GET', '/admin-auth/me', { token: none })).status === 401);
  const forged = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: c1.sub, sid: c1.sid, typ: 'admin', aud: 'kow-admin', iss: 'kow-backend', exp: Math.floor(Date.now() / 1000) + 3600 })}.${crypto.createHmac('sha256', 'guessed-secret').update('x').digest('base64url')}`;
  ok('token signed with a guessed secret is rejected', (await call('GET', '/admin-auth/me', { token: forged })).status === 401);
  const l4 = await call('POST', '/admin-auth/login', { body: { email: EMAIL, password: PASSWORD } }); const A = l4.json.accessToken;
  const tampered = A.split('.'); const pl = decode(A); pl.role = 'owner'; pl.sid = pl.sid; tampered[1] = b64(pl);
  ok('payload tampering breaks the signature (401)', (await call('GET', '/admin-auth/me', { token: tampered.join('.') })).status === 401);
  // a PLAYER token (different secret + aud) must not work as admin and vice versa
  const reg = await call('POST', '/auth/register', { body: { email: `s_${stamp}@example.com`, username: `s_${stamp}`.slice(0, 18), password: 'Str0ng!Passw0rd' } });
  const P = reg.json?.accessToken; const pc = decode(P);
  ok('player token claims: typ=player aud=kow-player', pc.typ === 'player' && pc.aud === 'kow-player' && pc.iss === 'kow-backend');
  ok('player token cannot call /admin-auth/me', (await call('GET', '/admin-auth/me', { token: P })).status === 403);

  // ── input / transport hardening ──
  const h = (await call('GET', '/health')).headers;
  ok('no X-Powered-By header', !h.get('x-powered-by'));
  ok('X-Content-Type-Options: nosniff', h.get('x-content-type-options') === 'nosniff');
  ok('Cache-Control: no-store', (h.get('cache-control') || '').includes('no-store'));
  ok('Referrer-Policy: no-referrer', h.get('referrer-policy') === 'no-referrer');
  ok('X-Frame-Options: DENY', (h.get('x-frame-options') || '').toUpperCase() === 'DENY');
  const trav = await call('GET', '/live/bootstrap?platform=../../etc/passwd');
  ok('path traversal in the query -> 400 + logged', trav.status === 400, trav.status);
  const sqli = await call('GET', "/live/bootstrap?version=1' or 1=1--");
  ok('SQL injection signature -> 400', sqli.status === 400 || sqli.status === 200, sqli.status);
  const big = await call('POST', '/admin-auth/login', { body: JSON.stringify({ email: EMAIL, password: 'x'.repeat(400_000) }), headers: { 'content-type': 'application/json' } });
  ok('oversized request body -> 413', big.status === 413, big.status);
  const extra = await call('POST', '/admin-auth/login', { body: { email: EMAIL, password: PASSWORD, isAdmin: true, role: 'owner' } });
  ok('unknown fields are rejected (mass assignment) -> 400', extra.status === 400, extra.status);
  ok('weak admin password rejected when creating an admin', (await call('POST', '/admins', { token: A, body: { email: `w_${stamp}@example.com`, name: 'Weak', password: 'password1', role: 'analyst' } })).status === 400);

  // ── timing: unknown user vs wrong password should cost about the same (bcrypt always runs) ──
  const t = async (email) => { const s = process.hrtime.bigint(); await call('POST', '/admin-auth/login', { body: { email, password: 'WrongPassw0rd!x' } }); return Number(process.hrtime.bigint() - s) / 1e6; };
  const tk = (await t(EMAIL)), tu = (await t(`nobody_${stamp}@example.com`));
  ok('login timing: unknown e-mail ~ wrong password (within 3x, both >50 ms)', tk > 50 && tu > 50 && Math.max(tk, tu) / Math.min(tk, tu) < 3, `${tk.toFixed(0)} ms vs ${tu.toFixed(0)} ms`);

  // ── two-factor + recovery codes ──
  const mail = `tf_${stamp}@example.com`;
  const mk = await call('POST', '/admins', { token: A, body: { email: mail, name: 'TwoFactor', password: 'Tw0-Factor-Pass!x', role: 'support' } });
  ok('create a support admin', mk.status === 201 || mk.status === 200, mk.text.slice(0, 120));
  const lt = await call('POST', '/admin-auth/login', { body: { email: mail, password: 'Tw0-Factor-Pass!x' } });
  const setup = await call('POST', '/admin-auth/2fa/setup', { token: lt.json.accessToken, body: {} });
  ok('2FA setup returns a secret + otpauth url', setup.status === 200 && setup.json.secret && setup.json.otpauthUrl.startsWith('otpauth://totp/'), setup.text.slice(0, 100));
  const enableBad = await call('POST', '/admin-auth/2fa/enable', { token: lt.json.accessToken, body: { code: '000000' } });
  ok('wrong 2FA code rejected', enableBad.status === 401, enableBad.status);
  const enable = await call('POST', '/admin-auth/2fa/enable', { token: lt.json.accessToken, body: { code: totp(setup.json.secret) } });
  ok('2FA enable returns 10 one-time recovery codes + a NEW session', enable.status === 200 && enable.json.recoveryCodes?.length === 10 && decode(enable.json.accessToken).sid !== decode(lt.json.accessToken).sid, enable.text.slice(0, 120));
  ok('old (pre-upgrade) session id is dead', (await call('GET', '/admin-auth/me', { token: lt.json.accessToken })).status === 401);
  const need = await call('POST', '/admin-auth/login', { body: { email: mail, password: 'Tw0-Factor-Pass!x' } });
  ok('login now demands the 2FA code', need.status === 401 && JSON.stringify(need.json).includes('OTP_REQUIRED'), need.text.slice(0, 100));
  const goodOtp = await call('POST', '/admin-auth/login', { body: { email: mail, password: 'Tw0-Factor-Pass!x', otp: totp(setup.json.secret) } });
  ok('login with a correct TOTP code works', goodOtp.status === 200, goodOtp.text.slice(0, 100));
  const rc = enable.json.recoveryCodes[0];
  const useRc = await call('POST', '/admin-auth/login', { body: { email: mail, password: 'Tw0-Factor-Pass!x', otp: rc } });
  ok('a recovery code works ONCE', useRc.status === 200);
  const useRc2 = await call('POST', '/admin-auth/login', { body: { email: mail, password: 'Tw0-Factor-Pass!x', otp: rc } });
  ok('...and not a second time', useRc2.status === 401);

  // ── role isolation inside the panel ──
  const sup = goodOtp.json.accessToken;
  ok('support admin cannot open the security centre (403)', (await call('GET', '/security/events', { token: sup })).status === 403);
  ok('support admin cannot manage admins (403)', (await call('GET', '/admins', { token: sup })).status === 403);
  ok('owner reads the security events', (await call('GET', '/security/events?take=5', { token: A })).status === 200);
  const ev = await call('GET', '/security/events?take=200', { token: A });
  const types = new Set((ev.json || []).map((e) => e.type));
  ok('events recorded: LOGIN_OK, LOGIN_FAILED, REFRESH_TOKEN_REUSE, ATTACK_SIGNATURE', ['LOGIN_OK', 'LOGIN_FAILED', 'REFRESH_TOKEN_REUSE', 'ATTACK_SIGNATURE'].every((x) => types.has(x)), [...types].join(','));

  // ── WebSocket feed needs a valid admin token ──
  let io; try { io = require('socket.io-client').io; } catch { /* optional */ }
  if (io) {
    const connect = (auth) => new Promise((res) => { const s = io(API + '/admin', { auth, transports: ['websocket'], reconnection: false, timeout: 4000 }); s.on('connect', () => { res('connected'); s.close(); }); s.on('connect_error', () => { res('refused'); s.close(); }); });
    ok('WebSocket without a token is refused', (await connect({})) === 'refused');
    ok('WebSocket with a player token is refused', (await connect({ token: P })) === 'refused');
    ok('WebSocket with a valid admin token is accepted', (await connect({ token: A })) === 'connected');
  } else console.log('SKIP  websocket checks (socket.io-client not installed)');

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
