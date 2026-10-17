// node tools/verify-site.mjs  (after `next build`): SEO / link / structure checks over the exported HTML in ./out
import fs from 'node:fs'; import path from 'node:path';
const OUT = path.resolve(import.meta.dirname, '../out'); const SITE = 'https://kingdomsofwarworld.com';
const pages = []; (function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) { if (f.name !== '_next' && !f.name.startsWith('__next')) walk(p); } else if (f.name === 'index.html') pages.push(p); } })(OUT);
const errs = []; const titles = new Map(), descs = new Map(); let n = 0;
const exists = (u) => { const p = decodeURIComponent(u.split('#')[0].split('?')[0]); const f = path.join(OUT, p); return fs.existsSync(f) && (fs.statSync(f).isFile() || fs.existsSync(path.join(f, 'index.html'))); };
for (const file of pages) {
  const url = '/' + path.relative(OUT, path.dirname(file)).split(path.sep).join('/') + '/'; const rel = url === '//' ? '/' : url; const h = fs.readFileSync(file, 'utf8'); n++;
  if (rel === '/404/' || rel === '/_not-found/') continue;
  const e = (m) => errs.push(`${rel}: ${m}`);
  const get = (re) => (h.match(re) || [])[1];
  const title = get(/<title>([^<]*)<\/title>/), desc = get(/<meta name="description" content="([^"]*)"/), canon = get(/<link rel="canonical" href="([^"]*)"/);
  const lang = get(/<html lang="([^"]*)"/), dir = get(/<html[^>]* dir="([^"]*)"/);
  if (!title || title.length > 70) e(`title missing/too long (${title?.length})`); if (!desc || desc.length < (/^(ja|ko|zh)$/.test(lang) ? 25 : 50) || desc.length > 165) e(`description length ${desc?.length}`);
  if (!canon || canon !== SITE + rel) e(`canonical ${canon} != ${SITE + rel}`);
  const hl = [...h.matchAll(/<link rel="alternate" hrefLang="([^"]*)"/g)].map((m) => m[1]); if (hl.length !== 13 || !hl.includes('x-default') || !hl.includes('ar')) e(`hreflang count ${hl.length}`);
  if ((h.match(/<h1[ >]/g) || []).length !== 1) e(`h1 count ${(h.match(/<h1[ >]/g) || []).length}`);
  if (lang === 'ar' !== (dir === 'rtl')) e(`dir ${dir} for lang ${lang}`); if (!/og:locale/.test(h) || !/twitter:card/.test(h) || !/og:image/.test(h)) e('missing og/twitter');
  const ld = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]; if (ld.length !== 1) e('json-ld count'); else { try { const g = JSON.parse(ld[0][1])['@graph']; if (!g.some((x) => x['@type'] === 'Organization') || !g.some((x) => Array.isArray(x['@type']) && x['@type'].includes('VideoGame'))) e('json-ld nodes'); } catch (x) { e('json-ld parse'); } }
  const key = `${lang}|${title}`; if (titles.has(key)) e(`duplicate title with ${titles.get(key)}`); titles.set(key, rel); const dk = `${lang}|${desc}`; if (descs.has(dk)) e(`duplicate description with ${descs.get(dk)}`); descs.set(dk, rel);
  for (const m of h.matchAll(/<a [^>]*href="([^"#][^"]*)"/g)) { const u = m[1]; if (/^(https?:|mailto:)/.test(u)) continue; if (!exists(u)) e(`broken link ${u}`); }
  for (const m of h.matchAll(/(?:src|srcSet|href)="(\/(?:img|brand)\/[^"\s,]+)/g)) if (!exists(m[1])) e(`missing asset ${m[1]}`);
  for (const m of h.matchAll(/<img [^>]*>/g)) if (!/ alt="/.test(m[0])) e('img without alt');
  const body = h.replace(/<script[\s\S]*?<\/script>/g, ''); if (/undefined|\[object Object\]|NaN/.test(body.replace(/<style[\s\S]*?<\/style>/g, ''))) e('suspicious text (undefined/NaN/[object])');
}
const sm = fs.readFileSync(path.join(OUT, 'sitemap.xml'), 'utf8'); const locs = [...sm.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]); for (const l of locs) if (!exists(l.replace(SITE, ''))) errs.push(`sitemap url missing: ${l}`);
if (!sm.includes('xhtml:link')) errs.push('sitemap has no hreflang alternates');
for (const f of ['robots.txt', 'llms.txt', 'llms-full.txt', 'manifest.webmanifest', 'favicon.ico', 'og-default.jpg', '.well-known/security.txt', '404.html']) if (!fs.existsSync(path.join(OUT, f))) errs.push(`missing ${f}`);
console.log(`pages checked: ${n}, sitemap urls: ${locs.length}, problems: ${errs.length}`); errs.slice(0, 40).forEach((x) => console.log(' -', x)); process.exit(errs.length ? 1 : 0);
