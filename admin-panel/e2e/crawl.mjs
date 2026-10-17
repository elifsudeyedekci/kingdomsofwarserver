// Real-browser crawl of the panel against a RUNNING backend + panel (dev or prod build).
// Logs in through the real encrypted login form, then opens every dashboard page, collecting console errors, uncaught exceptions and failed API calls.
// Usage: ADMIN_EMAIL=.. ADMIN_PASSWORD=.. [PANEL=http://localhost:3000] [API=http://localhost:3001] [SHOTS=build/panel] node e2e/crawl.mjs
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const PANEL = process.env.PANEL ?? 'http://localhost:3000';
const API = process.env.API ?? 'http://localhost:3001';
const EMAIL = process.env.ADMIN_EMAIL, PASSWORD = process.env.ADMIN_PASSWORD;
const SHOTS = process.env.SHOTS ?? path.join('..', 'build', 'panel');
fs.mkdirSync(SHOTS, { recursive: true });

function routes() {
  const root = path.join('src', 'app', 'dashboard'); const out = ['/dashboard'];
  (function walk(d, prefix) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (!e.isDirectory() || e.name.startsWith('[')) continue;
      const p = `${prefix}/${e.name}`;
      if (fs.existsSync(path.join(d, e.name, 'page.tsx'))) out.push(p);
      walk(path.join(d, e.name), p);
    }
  })(root, '/dashboard');
  return out;
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const problems = []; let current = 'login';
const secretSeen = [];
page.on('console', (m) => { const t = m.text(); if (PASSWORD && t.includes(PASSWORD)) secretSeen.push(`console: ${t.slice(0, 80)}`); if (m.type() === 'error') problems.push({ page: current, kind: 'console', text: t.slice(0, 220) }); });
page.on('pageerror', (e) => problems.push({ page: current, kind: 'exception', text: String(e).slice(0, 220) }));
page.on('request', (r) => { const pd = r.postData() ?? ''; if (PASSWORD && (pd.includes(PASSWORD) || r.url().includes(encodeURIComponent(PASSWORD)))) secretSeen.push(`request ${r.method()} ${r.url().slice(0, 80)}`); });
page.on('response', (r) => { const u = r.url(); if ((u.startsWith(API) || u.startsWith(PANEL + '/api')) && r.status() >= 400 && !u.includes('/api/auth/session')) problems.push({ page: current, kind: `http ${r.status()}`, text: `${r.request().method()} ${u.replace(API, '').slice(0, 120)}` }); });

// ── login through the real form (credentials are encrypted in the browser) ──
await page.goto(`${PANEL}/login`);
await page.fill('input[type=email]', EMAIL); await page.fill('input[type=password]', PASSWORD);
await page.click('button[type=submit]');
try { await page.waitForURL('**/dashboard**', { timeout: 20000 }); } catch { console.log('FAIL login did not reach the dashboard; url=', page.url()); await page.screenshot({ path: path.join(SHOTS, 'login-failed.png') }); await browser.close(); process.exit(1); }
console.log('PASS login through the encrypted form');
console.log(secretSeen.length === 0 ? 'PASS the password never appeared in any request body / URL / console line' : 'FAIL secret leaked: ' + secretSeen.join(' | '));
const cookies = await ctx.cookies();
const sess = cookies.find((c) => /session/i.test(c.name));
console.log(sess ? `PASS session cookie "${sess.name}" httpOnly=${sess.httpOnly} sameSite=${sess.sameSite}` : 'FAIL no session cookie');
console.log(sess?.httpOnly ? 'PASS session cookie is HttpOnly (not readable by page scripts)' : 'FAIL session cookie readable by scripts');
const hdr = (await page.request.get(PANEL + '/dashboard')).headers();
console.log(hdr['content-security-policy'] ? 'PASS Content-Security-Policy header present' : 'FAIL no CSP');
console.log(hdr['x-frame-options'] === 'DENY' ? 'PASS X-Frame-Options DENY' : 'FAIL x-frame-options');
console.log(!hdr['x-powered-by'] ? 'PASS no X-Powered-By' : 'FAIL x-powered-by present');

// ── every page ──
const results = [];
for (const r of routes()) {
  current = r; const before = problems.length;
  try {
    await page.goto(PANEL + r, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => null);
    await page.waitForTimeout(600);
    const text = (await page.locator('body').innerText()).slice(0, 4000);
    if (/Application error|Unhandled Runtime Error|This page could not be found|Internal Server Error/i.test(text)) problems.push({ page: r, kind: 'error-page', text: text.slice(0, 120) });
    await page.screenshot({ path: path.join(SHOTS, (r.replace(/\//g, '_').replace(/^_/, '') || 'home') + '.png') });
  } catch (e) { problems.push({ page: r, kind: 'navigation', text: String(e).slice(0, 160) }); }
  results.push({ route: r, problems: problems.length - before });
}

// dynamic player file: open the first player of the list
current = '/dashboard/players/[id]';
try {
  await page.goto(PANEL + '/dashboard/players', { waitUntil: 'networkidle', timeout: 20000 }).catch(() => null);
  const link = page.locator('a[href^="/dashboard/players/"]').first();
  if (await link.count()) { const before = problems.length; await link.click(); await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => null); for (const tab of ['Oynama', 'Maçlar', 'Ekonomi', 'Moderasyon', 'Ağ']) { await page.getByRole('button', { name: new RegExp(tab) }).first().click().catch(() => null); await page.waitForTimeout(500); } await page.screenshot({ path: path.join(SHOTS, 'player-file.png') }); results.push({ route: '/dashboard/players/[id] (all tabs)', problems: problems.length - before }); }
} catch (e) { problems.push({ page: current, kind: 'navigation', text: String(e).slice(0, 160) }); }

// guide deep links resolve
current = '/dashboard/guide';
await page.goto(PANEL + '/dashboard/guide', { waitUntil: 'networkidle' }).catch(() => null);
const hrefs = await page.locator('a[href^="/dashboard"]').evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute('href')))]);
let dead = 0; for (const h of hrefs) { const resp = await page.request.get(PANEL + h, { maxRedirects: 0 }).catch(() => null); if (!resp || resp.status() >= 400) { dead++; problems.push({ page: '/dashboard/guide', kind: 'dead-link', text: `${h} -> ${resp?.status()}` }); } }
console.log(`${dead === 0 ? 'PASS' : 'FAIL'} guide: ${hrefs.length} deep links, ${dead} dead`);

await browser.close();
console.log('\nPAGES');
for (const r of results) console.log(`${r.problems === 0 ? 'ok  ' : 'ISSUE'} ${r.route}${r.problems ? `  (${r.problems})` : ''}`);
if (problems.length) { console.log('\nPROBLEMS'); const seen = new Set(); for (const p of problems) { const k = `${p.page}|${p.kind}|${p.text}`; if (seen.has(k)) continue; seen.add(k); console.log(`- ${p.page} [${p.kind}] ${p.text}`); } }
console.log(`\n${results.length} pages visited, ${problems.length} problem(s)`);
process.exit(problems.length || secretSeen.length ? 1 : 0);
