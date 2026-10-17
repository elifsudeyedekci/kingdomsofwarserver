// node tools/gen-assets.mjs  -> public/img, public/brand, src/data/civs.json (reads the game repo for logos and civilization data)
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { sceneSvg, crestSvg } from './art.mjs';

const GAME = process.env.GAME_REPO || 'C:/Projects/KingdomsOfWar/KingdomsOfWar/Assets';
const OUT = path.resolve(import.meta.dirname, '..');
const mk = (p) => fs.mkdirSync(path.join(OUT, p), { recursive: true });
['public/img', 'public/img/civ', 'public/brand', 'src/data'].forEach(mk);
const rd = (p) => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));

// 1) scenes -------------------------------------------------------------
const scenes = [
  ['hero-castle', { theme: 'dusk', seed: 7, comp: 'castle' }],
  ['hero-army', { theme: 'night', seed: 21, comp: 'army' }],
  ['hero-siege', { theme: 'ember', seed: 33, comp: 'siege' }],
  ['hero-cavalry', { theme: 'desert', seed: 45, comp: 'cavalry' }],
  ['hero-dawn', { theme: 'dawn', seed: 58, comp: 'wide' }],
  ['bg-winter', { theme: 'winter', seed: 71, comp: 'wide' }],
  ['bg-night', { theme: 'night', seed: 83, comp: 'wide' }],
  ['bg-dusk', { theme: 'dusk', seed: 99, comp: 'wide' }],
];
for (const [name, o] of scenes) {
  const svg = Buffer.from(sceneSvg(o));
  await sharp(svg).resize(1920, 1080).webp({ quality: 78 }).toFile(path.join(OUT, `public/img/${name}.webp`));
  await sharp(svg).resize(960, 540).webp({ quality: 74 }).toFile(path.join(OUT, `public/img/${name}-960.webp`));
  await sharp(svg).resize(1200, 630).jpeg({ quality: 82 }).toFile(path.join(OUT, `public/img/${name}-og.jpg`));
}

// 2) brand --------------------------------------------------------------
const B = `${GAME}/_Game/Resources/Branding`;
await sharp(`${B}/game_logo.png`).resize({ width: 1024 }).png({ compressionLevel: 9 }).toFile(path.join(OUT, 'public/brand/game-logo.png'));
await sharp(`${B}/game_logo.png`).resize({ width: 640 }).webp({ quality: 90 }).toFile(path.join(OUT, 'public/brand/game-logo-640.webp'));
await sharp(`${B}/game_emblem.png`).resize(512).png().toFile(path.join(OUT, 'public/brand/game-emblem.png'));
await sharp(`${B}/studio_logo.png`).resize({ width: 800 }).png({ compressionLevel: 9 }).toFile(path.join(OUT, 'public/brand/studio-logo.png'));
await sharp(`${B}/studio_emblem.png`).resize(256).png().toFile(path.join(OUT, 'public/brand/studio-emblem.png'));
await sharp(`${B}/bg_title.jpg`).resize({ width: 1920 }).webp({ quality: 80 }).toFile(path.join(OUT, 'public/img/title-card.webp'));
for (const n of [1, 2, 3]) await sharp(`${B}/bg_load_${n}.jpg`).resize({ width: 1600 }).webp({ quality: 78 }).toFile(path.join(OUT, `public/img/load-${n}.webp`));
const icon = `${GAME}/_Game/BrandingIcons/icon_1024.png`;
await sharp(icon).resize(32).png().toFile(path.join(OUT, 'public/favicon-32.png'));
await sharp(icon).resize(180).png().toFile(path.join(OUT, 'public/apple-touch-icon.png'));
await sharp(icon).resize(192).png().toFile(path.join(OUT, 'public/icon-192.png'));
await sharp(icon).resize(512).png().toFile(path.join(OUT, 'public/icon-512.png'));
// favicon.ico is a PNG payload in an ICO container (modern browsers accept it)
const png32 = fs.readFileSync(path.join(OUT, 'public/favicon-32.png'));
const ico = Buffer.alloc(22); ico.writeUInt16LE(0, 0); ico.writeUInt16LE(1, 2); ico.writeUInt16LE(1, 4); ico[6] = 32; ico[7] = 32; ico.writeUInt16LE(1, 10); ico.writeUInt16LE(32, 12); ico.writeUInt32LE(png32.length, 14); ico.writeUInt32LE(22, 18);
fs.writeFileSync(path.join(OUT, 'public/favicon.ico'), Buffer.concat([ico, png32]));
// default Open Graph image: hero art + logo
{
  const bg = await sharp(path.join(OUT, 'public/img/hero-castle-og.jpg')).resize(1200, 630).toBuffer();
  const logo = await sharp(`${B}/game_logo.png`).resize({ height: 470 }).toBuffer();
  await sharp(bg).composite([{ input: logo, gravity: 'centre' }]).jpeg({ quality: 86 }).toFile(path.join(OUT, 'public/og-default.jpg'));
}

// 3) civilizations ------------------------------------------------------
const LANGS = ['tr', 'en', 'de', 'fr', 'es', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar', 'id'];
const L = Object.fromEntries(LANGS.map((l) => [l, rd(`${GAME}/StreamingAssets/Data/Localization/${l}.json`)]));
const CIVS = [['english', 'english'], ['french', 'french'], ['holy_roman_empire', 'hre'], ['mongols', 'mongols'], ['chinese', 'chinese'], ['rus', 'rus'], ['abbasid', 'abbasid'], ['delhi', 'delhi'], ['ottomans', 'ottoman'], ['malians', 'mali']];
const cap = (s) => s.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const out = [];
CIVS.forEach(([file, key], i) => {
  const j = rd(`${GAME}/StreamingAssets/Data/Civilizations/${file}.json`);
  const name = {}, desc = {};
  for (const l of LANGS) { name[l] = L[l][`civ.${key}.name`] || L.en[`civ.${key}.name`]; desc[l] = L[l][`civ.${key}.desc`] || L.en[`civ.${key}.desc`]; }
  const units = (j.uniqueUnits || []).map((u) => { const un = {}; for (const l of LANGS) un[l] = L[l][`unit.${u.id}.name`] || L.en[`unit.${u.id}.name`] || cap(u.id); return { id: u.id, age: u.age, hp: u.hp, attack: u.attack, range: u.range, food: u.cost?.food ?? 0, gold: u.cost?.gold ?? 0, name: un }; });
  const bonuses = (j.passiveBonuses || []).map((b) => b.desc).filter(Boolean);
  out.push({ id: file, slug: file.replace(/_/g, '-'), c1: j.colorPrimary, c2: j.colorSecondary, playstyle: j.playstyle, name, desc, units, bonuses });
  fs.writeFileSync(path.join(OUT, `public/img/civ/${file.replace(/_/g, '-')}.svg`), crestSvg(j.colorPrimary, j.colorSecondary, i, i * 3 + 1));
});
const ages = [1, 2, 3, 4].map((n) => { const name = {}, desc = {}; for (const l of LANGS) { name[l] = L[l][`age.age${n}.name`] || L.en[`age.age${n}.name`]; desc[l] = L[l][`age.age${n}.desc`] || L.en[`age.age${n}.desc`]; } return { n, name, desc }; });
fs.writeFileSync(path.join(OUT, 'src/data/ages.json'), JSON.stringify(ages, null, 1));
fs.writeFileSync(path.join(OUT, 'src/data/civs.json'), JSON.stringify(out, null, 1));
console.log('assets done:', out.map((c) => c.name.en).join(', '));
