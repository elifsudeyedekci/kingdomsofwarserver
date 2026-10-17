import type { Metadata } from 'next';
import civsData from '@/data/civs.json';
import agesData from '@/data/ages.json';
import { LANGS, SITE_URL, STUDIO, UPDATED, abs, href, langMeta, STORE_URLS, DEFAULT_LANG, type Lang } from './site';
import { getDict } from '@/i18n';

export interface Civ { id: string; slug: string; c1: string; c2: string; playstyle: string; name: Record<string, string>; desc: Record<string, string>; bonuses: string[]; units: { id: string; age: number; hp: number; attack: number; range: number; food: number; gold: number; name: Record<string, string> }[] }
export const CIVS = civsData as unknown as Civ[];
export const AGES = agesData as unknown as { n: number; name: Record<string, string>; desc: Record<string, string> }[];

export const STATIC_SLUGS = ['', 'game', 'civilizations', 'how-to-play', 'download', 'studio', 'faq', 'press', 'support', 'privacy', 'terms', 'cookies'];
export function allSlugs(): string[][] {
  return [...STATIC_SLUGS.map((s) => (s ? [s] : [])), ...CIVS.map((c) => ['civilizations', c.slug])];
}
export const key = (slug: string[]) => slug.join('/');
export const isValid = (slug: string[]) => allSlugs().some((s) => key(s) === key(slug));
export const findCiv = (slug: string[]) => (slug[0] === 'civilizations' && slug[1] ? CIVS.find((c) => c.slug === slug[1]) : undefined);

export interface Meta { title: string; description: string }
export function pageMeta(lang: Lang, slug: string[]): Meta {
  const d = getDict(lang);
  const brand = 'Kingdoms of War';
  const civ = findCiv(slug);
  if (civ) return { title: `${civ.name[lang]} | ${d.civs.title} | ${brand}`, description: d.civs.detailDesc(civ.name[lang]) };
  switch (slug[0] ?? '') {
    case '': return { title: `${d.siteName} | ${STUDIO}`, description: d.shortDesc };
    case 'game': return { title: `${d.game.title} | ${brand}`, description: d.game.desc };
    case 'civilizations': return { title: `${d.civs.title} | ${brand}`, description: d.civs.desc };
    case 'how-to-play': return { title: `${d.play.title} | ${brand}`, description: d.play.desc };
    case 'download': return { title: `${d.download.title} | ${brand}`, description: d.download.desc };
    case 'studio': return { title: `${d.studio.title} | ${brand}`, description: d.studio.desc };
    case 'faq': return { title: `${d.faq.title} | ${brand}`, description: d.faq.desc };
    case 'press': return { title: `${d.press.title} | ${brand}`, description: d.press.desc };
    case 'support': return { title: `${d.support.title} | ${brand}`, description: d.support.desc };
    case 'privacy': return { title: `${d.legal.privacy.title} | ${brand}`, description: d.legal.privacy.desc };
    case 'terms': return { title: `${d.legal.terms.title} | ${brand}`, description: d.legal.terms.desc };
    default: return { title: `${d.legal.cookies.title} | ${brand}`, description: d.legal.cookies.desc };
  }
}

export function buildMetadata(lang: Lang, slug: string[]): Metadata {
  const m = pageMeta(lang, slug), path = key(slug), url = abs(lang, path);
  const languages: Record<string, string> = Object.fromEntries(LANGS.map((l) => [l.code, abs(l.code, path)]));
  languages['x-default'] = abs(DEFAULT_LANG, path);
  const image = { url: `${SITE_URL}/og-default.jpg`, width: 1200, height: 630, alt: getDict(lang).siteName };
  return {
    metadataBase: new URL(SITE_URL),
    title: { absolute: m.title },
    description: m.description,
    applicationName: 'Kingdoms of War: Mobile Empires',
    authors: [{ name: STUDIO, url: SITE_URL }],
    creator: STUDIO, publisher: STUDIO,
    alternates: { canonical: url, languages },
    openGraph: { type: 'website', url, siteName: 'Kingdoms of War: Mobile Empires', title: m.title, description: m.description, locale: langMeta(lang).locale, alternateLocale: LANGS.filter((l) => l.code !== lang).map((l) => l.locale), images: [image] },
    twitter: { card: 'summary_large_image', title: m.title, description: m.description, images: [image.url] },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 } },
    icons: { icon: [{ url: '/favicon.ico' }, { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' }, { url: '/icon-192.png', sizes: '192x192', type: 'image/png' }], apple: '/apple-touch-icon.png' },
    manifest: '/manifest.webmanifest',
    formatDetection: { telephone: false, email: false, address: false },
    other: { 'theme-color': '#0f0c14' },
  };
}

/** Structured data: Organization + WebSite + VideoGame (every page, one @graph) plus page specific nodes. */
export function jsonLd(lang: Lang, slug: string[]) {
  const d = getDict(lang), m = pageMeta(lang, slug), url = abs(lang, key(slug));
  const org = { '@type': 'Organization', '@id': `${SITE_URL}/#studio`, name: STUDIO, url: SITE_URL, logo: { '@type': 'ImageObject', url: `${SITE_URL}/brand/studio-logo.png` } };
  const game: Record<string, unknown> = {
    '@type': ['VideoGame', 'SoftwareApplication'], '@id': `${SITE_URL}/#game`, name: 'Kingdoms of War: Mobile Empires', alternateName: 'Kingdoms of War', description: d.defaultDesc, url: abs(lang),
    image: `${SITE_URL}/og-default.jpg`, genre: ['Real-time strategy', 'Strategy'], applicationCategory: 'GameApplication', operatingSystem: 'Android, iOS', gamePlatform: ['Android', 'iOS'],
    author: { '@id': `${SITE_URL}/#studio` }, publisher: { '@id': `${SITE_URL}/#studio` }, inLanguage: LANGS.map((l) => l.code),
    ...(STORE_URLS.googlePlay || STORE_URLS.appStore ? { installUrl: [STORE_URLS.googlePlay, STORE_URLS.appStore].filter(Boolean) } : {}),
  };
  const site = { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, url: SITE_URL, name: 'Kingdoms of War: Mobile Empires', inLanguage: lang, publisher: { '@id': `${SITE_URL}/#studio` } };
  const crumbs: { name: string; url: string }[] = [{ name: d.ui.home, url: abs(lang) }];
  const sec = slug[0];
  const secName: Record<string, string> = { game: d.game.title, civilizations: d.civs.title, 'how-to-play': d.play.title, download: d.download.title, studio: d.studio.title, faq: d.faq.title, press: d.press.title, support: d.support.title, privacy: d.legal.privacy.title, terms: d.legal.terms.title, cookies: d.legal.cookies.title };
  if (sec) crumbs.push({ name: secName[sec], url: abs(lang, sec) });
  const civ = findCiv(slug); if (civ) crumbs.push({ name: civ.name[lang], url });
  const graph: Record<string, unknown>[] = [org, site, game, { '@type': 'BreadcrumbList', itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.url })) }];
  const page: Record<string, unknown> = { '@type': sec === 'faq' ? 'FAQPage' : sec === 'civilizations' && !civ ? 'CollectionPage' : sec === 'studio' ? 'AboutPage' : sec === 'support' ? 'ContactPage' : 'WebPage', '@id': `${url}#page`, url, name: m.title, description: m.description, inLanguage: lang, isPartOf: { '@id': `${SITE_URL}/#website` }, about: { '@id': `${SITE_URL}/#game` }, dateModified: UPDATED, primaryImageOfPage: `${SITE_URL}/og-default.jpg` };
  if (sec === 'faq') page.mainEntity = d.faq.items.map((q) => ({ '@type': 'Question', name: q.q, acceptedAnswer: { '@type': 'Answer', text: q.a } }));
  if (sec === 'civilizations' && !civ) page.mainEntity = { '@type': 'ItemList', itemListElement: CIVS.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name[lang], url: abs(lang, `civilizations/${c.slug}`) })) };
  graph.push(page);
  return { '@context': 'https://schema.org', '@graph': graph };
}

export { href };
