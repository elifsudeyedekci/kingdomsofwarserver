// End-to-end smoke test of the live-ops loop against a RUNNING backend (real HTTP, real database).
// Usage: ADMIN_EMAIL=.. ADMIN_PASSWORD=.. [API=http://localhost:3001] node scripts/live-smoke.js
const API = process.env.API || 'http://localhost:3001';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL, ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { (cond ? pass++ : fail++); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '  -> ' + extra}`); };
async function call(method, path, { token, body, raw } = {}) {
  const r = await fetch(API + path, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* raw */ }
  return { status: r.status, json, text, headers: r.headers };
}
(async () => {
  const stamp = Date.now().toString(36);
  // 1. admin sign in
  const bad = await call('POST', '/admin-auth/login', { body: { email: ADMIN_EMAIL, password: 'definitely-wrong' } });
  ok('admin login with a wrong password -> 401', bad.status === 401, bad.status);
  const login = await call('POST', '/admin-auth/login', { body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
  ok('admin login', login.status === 200 && login.json?.accessToken, JSON.stringify(login.json));
  const A = login.json.accessToken;
  const me = await call('GET', '/admin-auth/me', { token: A });
  ok('admin /me returns role owner', me.json?.role === 'owner', JSON.stringify(me.json));

  // 2. a PLAYER token must not reach admin routes
  const reg = await call('POST', '/auth/register', { body: { email: `p_${stamp}@example.com`, username: `p_${stamp}`.slice(0, 18), password: 'Str0ng!Passw0rd' } });
  ok('player registers', reg.status === 201 || reg.status === 200, `${reg.status} ${reg.text.slice(0, 120)}`);
  const P = reg.json?.accessToken;
  ok('player token on /admin/dashboard/stats -> 403', (await call('GET', '/admin/dashboard/stats', { token: P })).status === 403);
  ok('player token on /content/files -> 403', (await call('GET', '/content/files', { token: P })).status === 403);
  ok('player token on /admins -> 403', (await call('GET', '/admins', { token: P })).status === 403);
  ok('player token on its own /player/me -> 200', (await call('GET', '/player/me', { token: P })).status === 200);
  ok('no token on /admin/dashboard/stats -> 401', (await call('GET', '/admin/dashboard/stats')).status === 401);
  ok('admin token on /admin/dashboard/stats -> 200', (await call('GET', '/admin/dashboard/stats', { token: A })).status === 200);

  // 3. content: import the shipped data, edit, publish, download
  const imp = await call('POST', '/content/import', { token: A, body: {} });
  ok('import shipped data files', imp.status === 200 && (imp.json.created + imp.json.skipped) > 20, JSON.stringify(imp.json));
  const files = await call('GET', '/content/files', { token: A });
  ok('files listed', files.json?.files?.length > 20, files.text.slice(0, 120));
  const target = 'Data/Balance/unit_balance.json';
  const f0 = await call('GET', `/content/file?path=${encodeURIComponent(target)}`, { token: A });
  ok('read a balance file', f0.status === 200 && f0.json?.content?.length > 100, f0.status);
  const badSave = await call('PUT', '/content/file', { token: A, body: { path: target, content: '{ not json' } });
  ok('saving invalid JSON is rejected (400)', badSave.status === 400, badSave.status);
  const evil = await call('PUT', '/content/file', { token: A, body: { path: 'Data/../../secret.json', content: '{}', create: true } });
  ok('path traversal is rejected (400)', evil.status === 400, evil.status);
  const edited = f0.json.content.replace(/"hp"\s*:\s*(\d+)/, (m, v) => `"hp": ${Number(v) + 7}`);
  ok('edit changes the text (found an hp value)', edited !== f0.json.content);
  const saved = await call('PUT', '/content/file', { token: A, body: { path: target, content: edited } });
  ok('save draft', saved.status === 200, saved.text.slice(0, 150));
  const diff = await call('GET', `/content/diff?path=${encodeURIComponent(target)}&against=build`, { token: A });
  ok('diff against the build shows exactly the edit', diff.json?.available && diff.json.changes.length === 1, JSON.stringify(diff.json).slice(0, 200));
  const pub = await call('POST', '/content/publish', { token: A, body: { note: 'smoke test' } });
  ok('publish release', pub.status === 200 && pub.json?.version >= 1, pub.text.slice(0, 150));
  const again = await call('POST', '/content/publish', { token: A, body: {} });
  ok('publishing with no changes -> 409', again.status === 409, again.status);

  // 4. the GAME side (no login)
  const boot = await call('GET', '/live/bootstrap?platform=android&version=0.2.0&locale=tr');
  ok('bootstrap is public and returns content manifest', boot.status === 200 && boot.json.content.version === pub.json.version && boot.json.content.files.length > 20, boot.text.slice(0, 150));
  const entry = boot.json.content.files.find((x) => x.path === target);
  const dl = await call('GET', `/live/content/${pub.json.version}?path=${encodeURIComponent(target)}`);
  ok('client downloads the edited file', dl.status === 200 && dl.text === edited, dl.status);
  ok('manifest hash equals the sha256 of the delivered text', entry && require('crypto').createHash('sha256').update(dl.text, 'utf8').digest('hex') === entry.hash);
  const same = await call('GET', `/live/bootstrap?platform=android&version=0.2.0&contentVersion=${pub.json.version}`);
  ok('client already up to date -> manifest omitted', same.json.content.unchanged === true && same.json.content.files.length === 0);

  // 5. maintenance + update gate + services
  const set = await call('PUT', '/live-admin/settings', { token: A, body: { maintenance: { enabled: true, message: { en: 'Down', tr: 'Bakım var' }, endsAt: null }, update: { android: { min: '0.3.0', latest: '0.4.0', url: 'https://example.com/get', notes: { en: 'New!', tr: 'Yeni!' } } }, services: { ranked: false } } });
  ok('settings saved', set.status === 200, set.text.slice(0, 150));
  const b2 = await call('GET', '/live/bootstrap?platform=android&version=0.2.0&locale=tr');
  ok('maintenance on + Turkish message', b2.json.maintenance.enabled === true && b2.json.maintenance.message === 'Bakım var', JSON.stringify(b2.json.maintenance));
  ok('old client: update required', b2.json.update.required === true && b2.json.update.available === true && b2.json.update.notes === 'Yeni!');
  ok('ranked switched off', b2.json.services.ranked === false && b2.json.services.store === true);
  const b3 = await call('GET', '/live/bootstrap?platform=android&version=0.4.0');
  ok('current client: no update', b3.json.update.required === false && b3.json.update.available === false);
  const badSet = await call('PUT', '/live-admin/settings', { token: A, body: { update: { ios: { min: '2.0.0', latest: '1.0.0' } } } });
  ok('min > latest is rejected (400)', badSet.status === 400, badSet.status);
  await call('PUT', '/live-admin/settings', { token: A, body: { maintenance: { enabled: false }, update: { android: { min: '0.0.0', latest: '0.0.0' } }, services: { ranked: true } } });

  // 6. announcements
  const ann = await call('POST', '/live-admin/announcements', { token: A, body: { kind: 'news', title: { en: 'Hello', tr: 'Merhaba' }, body: { en: 'Body', tr: 'Metin' }, platforms: ['android'], priority: 5 } });
  ok('announcement created', ann.status === 201 || ann.status === 200, ann.text.slice(0, 120));
  const b4 = await call('GET', '/live/bootstrap?platform=android&version=0.2.0&locale=tr');
  ok('announcement delivered in Turkish', b4.json.announcements.some((a) => a.title === 'Merhaba'));
  const b5 = await call('GET', '/live/bootstrap?platform=ios&version=0.2.0&locale=tr');
  ok('platform-targeted announcement not shown on iOS', !b5.json.announcements.some((a) => a.title === 'Merhaba'));
  await call('DELETE', `/live-admin/announcements/${ann.json.id}`, { token: A });

  // 7. roles: an analyst may read but not publish / edit
  const an = await call('POST', '/admins', { token: A, body: { email: `analyst_${stamp}@example.com`, name: 'Analyst', password: 'Analyst-Pass-1', role: 'analyst' } });
  ok('owner creates an analyst admin', an.status === 201 || an.status === 200, an.text.slice(0, 150));
  const al = await call('POST', '/admin-auth/login', { body: { email: `analyst_${stamp}@example.com`, password: 'Analyst-Pass-1' } });
  const AN = al.json?.accessToken;
  ok('analyst can read content files', (await call('GET', '/content/files', { token: AN })).status === 200);
  ok('analyst cannot publish (403)', (await call('POST', '/content/publish', { token: AN, body: {} })).status === 403);
  ok('analyst cannot change live settings (403)', (await call('PUT', '/live-admin/settings', { token: AN, body: {} })).status === 403);
  ok('analyst cannot create admins (403)', (await call('POST', '/admins', { token: AN, body: { email: 'x@y.zz', name: 'xx', password: 'Abcdefghij1', role: 'owner' } })).status === 403);
  await call('PATCH', `/admins/${an.json.id}`, { token: A, body: { isActive: false } });
  ok('deactivated admin token is revoked immediately (401)', (await call('GET', '/content/files', { token: AN })).status === 401);

  // 8. rollback
  const rel = await call('GET', '/content/releases', { token: A });
  ok('release history', rel.json?.length >= 1);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
