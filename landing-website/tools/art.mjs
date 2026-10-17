// Original procedural artwork for the Kingdoms of War website (no third-party images).
export function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

const THEMES = {
  dusk:   { sky: ['#2a1745', '#6a2c58', '#d2723a', '#f6b45a'], sun: ['#ffd68a', 0.72, 0.62, 150], far: '#6b3a4a', mid: '#3d2335', near: '#1c1220', fog: '#f0a860', stars: 0.5, flag: '#8e1b22' },
  night:  { sky: ['#06091c', '#101a3d', '#26386a', '#4a5f98'], sun: ['#dfe8ff', 0.22, 0.2, 70], far: '#1e2a50', mid: '#121a35', near: '#080c1a', fog: '#6f86c8', stars: 1, flag: '#a3232b' },
  dawn:   { sky: ['#1f2350', '#7b3b6b', '#e0785a', '#ffd9a0'], sun: ['#fff1c8', 0.5, 0.7, 190], far: '#7a4560', mid: '#4a2a40', near: '#1d1322', fog: '#ffc88a', stars: 0.25, flag: '#c42a30' },
  desert: { sky: ['#40220f', '#a85a22', '#e9a24a', '#ffe0a0'], sun: ['#fff2c0', 0.3, 0.55, 170], far: '#9a5a2c', mid: '#6a3a1a', near: '#2a170b', fog: '#ffd08a', stars: 0, flag: '#7a1218' },
  winter: { sky: ['#0b1730', '#26456e', '#7ba0c8', '#dbe9f5'], sun: ['#ffffff', 0.78, 0.35, 90], far: '#566f94', mid: '#33496b', near: '#16202f', fog: '#e6f0fa', stars: 0.3, flag: '#9a1c24' },
  ember:  { sky: ['#14070a', '#4a1210', '#b53a14', '#ff9a3a'], sun: ['#ffcf7a', 0.5, 0.78, 210], far: '#4a1a14', mid: '#2a0e0c', near: '#0d0505', fog: '#ff7a2a', stars: 0, flag: '#d2321c' },
};

function mountains(r, W, H, base, amp, color, rough = 7) {
  const pts = []; const n = 18;
  for (let i = 0; i <= n; i++) pts.push([(W / n) * i, base + (r() - 0.5) * amp]);
  let d = `M0 ${H} L0 ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; d += ` Q${(x0 + x1) / 2 + (r() - 0.5) * rough * 4} ${(y0 + y1) / 2 - r() * amp * 0.3} ${x1} ${y1}`; }
  return `<path d="${d} L${W} ${H} Z" fill="${color}"/>`;
}
function tower(x, base, w, h, color, roof, lit, r) {
  let s = `<rect x="${x}" y="${base - h}" width="${w}" height="${h}" fill="${color}"/>`;
  const cw = w / 7;
  for (let i = 0; i < 4; i++) s += `<rect x="${x - w * 0.06 + i * cw * 2.0}" y="${base - h - cw * 0.9}" width="${cw}" height="${cw * 0.9}" fill="${color}"/>`;
  if (roof) s += `<polygon points="${x - w * 0.12},${base - h} ${x + w * 0.5},${base - h - w * 1.1} ${x + w * 1.12},${base - h}" fill="${color}"/>`;
  if (lit) for (let k = 0; k < 2; k++) if (r() > 0.2) s += `<rect x="${x + w * (0.3 + k * 0.25)}" y="${base - h * (0.4 + r() * 0.35)}" width="${w * 0.1}" height="${w * 0.16}" fill="#ffd27a" opacity="0.9"/>`;
  return s;
}
function castle(r, cx, base, scale, color, lit, flag) {
  let s = '';
  const keepW = 120 * scale, keepH = 210 * scale;
  s += tower(cx - keepW / 2, base, keepW, keepH, color, true, lit, r);
  s += `<rect x="${cx - 190 * scale}" y="${base - 90 * scale}" width="${380 * scale}" height="${90 * scale}" fill="${color}"/>`;
  for (let i = 0; i < 12; i++) s += `<rect x="${cx - 190 * scale + i * 33 * scale}" y="${base - 90 * scale - 14 * scale}" width="${17 * scale}" height="${14 * scale}" fill="${color}"/>`;
  s += tower(cx - 235 * scale, base, 70 * scale, 160 * scale, color, true, lit, r) + tower(cx + 165 * scale, base, 70 * scale, 150 * scale, color, true, lit, r);
  s += tower(cx - 70 * scale, base, 44 * scale, 150 * scale, color, true, lit, r);
  const px = cx, py = base - keepH - keepW * 1.1;
  s += `<rect x="${px - 1.5}" y="${py - 70 * scale}" width="3" height="${70 * scale}" fill="${color}"/><path d="M${px + 1.5} ${py - 70 * scale} q${28 * scale} ${8 * scale} ${52 * scale} 0 l${-10 * scale} ${14 * scale} l${10 * scale} ${14 * scale} q${-24 * scale} ${8 * scale} ${-52 * scale} 0z" fill="${flag}"/>`;
  return s;
}
function soldier(x, y, k, color, spear = true) {
  return `<g fill="${color}"><circle cx="${x}" cy="${y - 44 * k}" r="${5 * k}"/><path d="M${x - 7 * k} ${y - 38 * k} h${14 * k} l${3 * k} ${24 * k} h${-20 * k}z"/><rect x="${x - 6 * k}" y="${y - 15 * k}" width="${4 * k}" height="${15 * k}"/><rect x="${x + 2 * k}" y="${y - 15 * k}" width="${4 * k}" height="${15 * k}"/>${spear ? `<rect x="${x + 9 * k}" y="${y - 78 * k}" width="${1.8 * k}" height="${78 * k}"/><polygon points="${x + 8.2 * k},${y - 78 * k} ${x + 10.8 * k},${y - 78 * k} ${x + 9.5 * k},${y - 88 * k}"/>` : ''}</g>`;
}
function horseman(x, y, k, color) {
  return `<g fill="${color}"><path d="M${x - 30 * k} ${y - 26 * k} q${10 * k} ${-12 * k} ${30 * k} ${-10 * k} q${14 * k} ${-14 * k} ${24 * k} ${-26 * k} l${6 * k} ${4 * k} q${-2 * k} ${14 * k} ${-8 * k} ${24 * k} l${6 * k} ${36 * k} h${-5 * k} l${-6 * k} ${-24 * k} h${-26 * k} l${-6 * k} ${24 * k} h${-5 * k}z"/><circle cx="${x + 2 * k}" cy="${y - 62 * k}" r="${5 * k}"/><rect x="${x - 3 * k}" y="${y - 58 * k}" width="${9 * k}" height="${22 * k}"/><rect x="${x + 12 * k}" y="${y - 100 * k}" width="${1.8 * k}" height="${70 * k}"/></g>`;
}
function catapult(x, y, k, color) {
  return `<g fill="${color}" stroke="${color}" stroke-width="${3 * k}"><path d="M${x - 40 * k} ${y} h${80 * k} l${-10 * k} ${-18 * k} h${-60 * k}z"/><circle cx="${x - 30 * k}" cy="${y}" r="${9 * k}"/><circle cx="${x + 30 * k}" cy="${y}" r="${9 * k}"/><path d="M${x - 5 * k} ${y - 18 * k} L${x + 42 * k} ${y - 80 * k}" fill="none"/><circle cx="${x + 46 * k}" cy="${y - 84 * k}" r="${8 * k}" stroke="none"/><path d="M${x - 12 * k} ${y - 18 * k} L${x - 28 * k} ${y - 46 * k}" fill="none"/></g>`;
}
function pine(x, base, h, color) { return `<polygon points="${x},${base - h} ${x - h * 0.22},${base - h * 0.42} ${x - h * 0.1},${base - h * 0.42} ${x - h * 0.3},${base} ${x + h * 0.3},${base} ${x + h * 0.1},${base - h * 0.42} ${x + h * 0.22},${base - h * 0.42}" fill="${color}"/>`; }
function banner(x, base, h, color, cloth) { return `<g><rect x="${x}" y="${base - h}" width="3" height="${h}" fill="${color}"/><path d="M${x + 3} ${base - h} h40 l-8 16 l8 16 h-40z" fill="${cloth}"/></g>`; }

/** comp: 'castle' | 'army' | 'siege' | 'cavalry' | 'wide' */
export function sceneSvg({ theme = 'dusk', seed = 1, comp = 'castle', W = 1920, H = 1080 }) {
  const t = THEMES[theme], r = rng(seed);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">${t.sky.map((c, i) => `<stop offset="${(i / (t.sky.length - 1)) * 0.85}" stop-color="${c}"/>`).join('')}</linearGradient>
<radialGradient id="sun"><stop offset="0" stop-color="${t.sun[0]}" stop-opacity="1"/><stop offset="0.35" stop-color="${t.sun[0]}" stop-opacity="0.55"/><stop offset="1" stop-color="${t.sun[0]}" stop-opacity="0"/></radialGradient>
<linearGradient id="fog" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.fog}" stop-opacity="0"/><stop offset="1" stop-color="${t.fog}" stop-opacity="0.5"/></linearGradient>
<radialGradient id="vig" cx="0.5" cy="0.5" r="0.75"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.55"/></radialGradient></defs>
<rect width="${W}" height="${H}" fill="url(#sky)"/>`;
  for (let i = 0, n = Math.floor(260 * t.stars); i < n; i++) s += `<circle cx="${r() * W}" cy="${r() * H * 0.55}" r="${0.5 + r() * 1.4}" fill="#fff" opacity="${0.25 + r() * 0.7}"/>`;
  s += `<circle cx="${W * t.sun[1]}" cy="${H * t.sun[2]}" r="${t.sun[3] * 2.6}" fill="url(#sun)"/><circle cx="${W * t.sun[1]}" cy="${H * t.sun[2]}" r="${t.sun[3] * 0.42}" fill="${t.sun[0]}" opacity="0.92"/>`;
  for (let i = 0; i < 5; i++) { const cx = r() * W, cy = H * (0.14 + r() * 0.3); s += `<ellipse cx="${cx}" cy="${cy}" rx="${200 + r() * 260}" ry="${12 + r() * 16}" fill="${t.fog}" opacity="${0.07 + r() * 0.1}"/>`; }
  s += mountains(r, W, H, H * 0.6, 120, t.far) + `<rect y="${H * 0.58}" width="${W}" height="${H * 0.2}" fill="url(#fog)"/>` + mountains(r, W, H, H * 0.7, 90, t.mid);
  const base = H * 0.8;
  if (comp === 'castle') s += castle(r, W * (0.3 + r() * 0.1), base, 1.7, t.mid, true, t.flag);
  if (comp === 'army' || comp === 'siege') s += castle(r, W * 0.78, base, 1.1, t.mid, true, t.flag);
  if (comp === 'wide') for (let i = 0; i < 3; i++) s += castle(r, W * (0.18 + i * 0.32), base + 6, 0.55 + r() * 0.25, t.mid, true, t.flag);
  const k = H / 1080;
  s += `<rect y="${H * 0.74}" width="${W}" height="${H * 0.14}" fill="url(#fog)" opacity="0.55"/>`;
  if (comp === 'army') { for (let row = 0; row < 3; row++) for (let i = 0; i < 16; i++) s += soldier(W * 0.06 + i * 62 * k + row * 24, H * (0.875 + row * 0.03), 1.9 * k + row * 0.3, t.near); for (let b = 0; b < 4; b++) s += banner(W * (0.12 + b * 0.16), H * 0.86, 280 * k, t.near, t.flag); }
  if (comp === 'siege') { for (let i = 0; i < 3; i++) s += catapult(W * (0.15 + i * 0.22), H * (0.88 + (i % 2) * 0.02), 2.2 * k, t.near); for (let i = 0; i < 12; i++) s += soldier(W * (0.08 + i * 0.07), H * 0.9, 1.9 * k, t.near); }
  if (comp === 'cavalry') { for (let i = 0; i < 7; i++) s += horseman(W * (0.1 + i * 0.12), H * (0.88 + (i % 2) * 0.03), 2.5 * k, t.near); for (let b = 0; b < 3; b++) s += banner(W * (0.2 + b * 0.3), H * 0.86, 280 * k, t.near, t.flag); }
  if (comp === 'castle') { for (let i = 0; i < 8; i++) s += soldier(W * (0.55 + i * 0.05), H * 0.9, 1.9 * k, t.near); s += banner(W * 0.7, H * 0.9, 300 * k, t.near, t.flag); }
  s += mountains(r, W, H, H * 0.84, 40, t.near, 3);
  for (let i = 0; i < 26; i++) s += pine(r() * W, H * (0.86 + r() * 0.05), 70 + r() * 120, t.near);
  for (let i = 0; i < 9; i++) { const x = r() * W, y = H * (0.1 + r() * 0.3); s += `<path d="M${x} ${y} q8 -7 16 0 q8 -7 16 0" stroke="#150c18" stroke-width="2" fill="none" opacity="0.7"/>`; }
  s += `<rect width="${W}" height="${H}" fill="url(#vig)"/></svg>`;
  return s;
}

// Civilization heraldry: abstract shapes in each civ's real colours from the game data.
const PATTERNS = ['quarter', 'bend', 'chevron', 'cross', 'saltire', 'pale', 'fess', 'tierce'];
const CHARGES = ['star', 'crescent', 'tower', 'sun', 'bow', 'wheel', 'cross', 'blade', 'crown', 'leaf'];
export function crestSvg(c1, c2, pi, ci) {
  const sh = 'M256 36 L452 84 V250 C452 350 372 430 256 480 C140 430 60 350 60 250 V84 Z';
  const pat = PATTERNS[pi % PATTERNS.length], ch = CHARGES[ci % CHARGES.length], gold = '#e9b84a';
  const field = {
    quarter: `<rect x="256" y="36" width="200" height="226" fill="${c2}"/><rect x="56" y="262" width="200" height="230" fill="${c2}"/>`,
    bend: `<polygon points="60,84 190,84 452,360 452,470 330,470 60,170" fill="${c2}"/>`,
    chevron: `<polygon points="60,230 256,110 452,230 452,320 256,200 60,320" fill="${c2}"/>`,
    cross: `<rect x="226" y="36" width="60" height="460" fill="${c2}"/><rect x="56" y="170" width="400" height="60" fill="${c2}"/>`,
    saltire: `<polygon points="60,84 110,84 452,420 452,470 402,470 60,134" fill="${c2}"/><polygon points="452,84 402,84 60,420 60,470 110,470 452,134" fill="${c2}"/>`,
    pale: `<rect x="196" y="36" width="120" height="460" fill="${c2}"/>`,
    fess: `<rect x="56" y="190" width="400" height="90" fill="${c2}"/>`,
    tierce: `<rect x="56" y="36" width="140" height="460" fill="${c2}"/>`,
  }[pat];
  const charge = {
    star: `<polygon points="256,150 276,212 342,212 288,250 308,314 256,276 204,314 224,250 170,212 236,212" fill="${gold}" stroke="#4e300a" stroke-width="5"/>`,
    crescent: `<path d="M300 150 a86 86 0 1 0 0 190 a68 68 0 1 1 0 -190z" fill="${gold}" stroke="#4e300a" stroke-width="5"/>`,
    tower: `<g fill="${gold}" stroke="#4e300a" stroke-width="5"><rect x="214" y="190" width="84" height="130"/><rect x="204" y="166" width="22" height="26"/><rect x="245" y="166" width="22" height="26"/><rect x="286" y="166" width="22" height="26"/><path d="M240 320 v-44 q16 -20 32 0 v44z" fill="#4e300a"/></g>`,
    sun: `<g fill="${gold}" stroke="#4e300a" stroke-width="5"><circle cx="256" cy="250" r="44"/>${Array.from({ length: 12 }, (_, i) => `<polygon points="256,178 264,200 248,200" transform="rotate(${i * 30} 256 250)"/>`).join('')}</g>`,
    bow: `<g fill="none" stroke="${gold}" stroke-width="12" stroke-linecap="round"><path d="M200 170 Q300 250 200 340"/><path d="M200 170 L200 340" stroke-width="4"/><path d="M170 255 H330" stroke-width="6"/></g><polygon points="330,255 306,243 306,267" fill="${gold}"/>`,
    wheel: `<g fill="none" stroke="${gold}" stroke-width="10"><circle cx="256" cy="250" r="64"/><circle cx="256" cy="250" r="14" fill="${gold}"/>${Array.from({ length: 8 }, (_, i) => `<line x1="256" y1="250" x2="256" y2="186" transform="rotate(${i * 45} 256 250)"/>`).join('')}</g>`,
    cross: `<g fill="${gold}" stroke="#4e300a" stroke-width="5"><rect x="238" y="160" width="36" height="170"/><rect x="190" y="206" width="132" height="36"/></g>`,
    blade: `<g fill="${gold}" stroke="#4e300a" stroke-width="5"><polygon points="256,140 276,300 256,330 236,300"/><rect x="208" y="296" width="96" height="16"/><rect x="248" y="312" width="16" height="42"/></g>`,
    crown: `<g fill="${gold}" stroke="#4e300a" stroke-width="5"><polygon points="190,300 190,210 224,246 256,190 288,246 322,210 322,300"/><rect x="190" y="300" width="132" height="20"/></g>`,
    leaf: `<g fill="${gold}" stroke="#4e300a" stroke-width="5"><path d="M256 330 C170 290 170 200 256 160 C342 200 342 290 256 330z"/><path d="M256 330 V190" stroke="#4e300a"/></g>`,
  }[ch];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512"><defs><clipPath id="c"><path d="${sh}"/></clipPath><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fceeb0"/><stop offset=".45" stop-color="#e9b84a"/><stop offset="1" stop-color="#7a4a12"/></linearGradient><linearGradient id="sh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient></defs><path d="${sh}" fill="${c1}"/><g clip-path="url(#c)">${field}</g><path d="${sh}" fill="url(#sh)"/>${charge}<path d="${sh}" fill="none" stroke="url(#g)" stroke-width="16" stroke-linejoin="round"/></svg>`;
}
