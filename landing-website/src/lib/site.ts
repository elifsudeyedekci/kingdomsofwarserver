export const SITE_URL = 'https://kingdomsofwarworld.com';
export const STUDIO = 'DoSuCan Games';
/** Assumption: create this mailbox (or change it here) before publishing. */
export const CONTACT_EMAIL = 'info@kingdomsofwarworld.com';
export const UPDATED = '2026-10-17';
/** Fill these in when the store pages exist; null keeps the "coming soon" state everywhere (page, JSON-LD, llms.txt). */
export const STORE_URLS: { googlePlay: string | null; appStore: string | null; steam: string | null } = { googlePlay: null, appStore: null, steam: null };

export const LANGS = [
  { code: 'tr', name: 'Türkçe', locale: 'tr_TR', dir: 'ltr' },
  { code: 'en', name: 'English', locale: 'en_US', dir: 'ltr' },
  { code: 'de', name: 'Deutsch', locale: 'de_DE', dir: 'ltr' },
  { code: 'fr', name: 'Français', locale: 'fr_FR', dir: 'ltr' },
  { code: 'es', name: 'Español', locale: 'es_ES', dir: 'ltr' },
  { code: 'pt', name: 'Português', locale: 'pt_BR', dir: 'ltr' },
  { code: 'ru', name: 'Русский', locale: 'ru_RU', dir: 'ltr' },
  { code: 'ja', name: '日本語', locale: 'ja_JP', dir: 'ltr' },
  { code: 'ko', name: '한국어', locale: 'ko_KR', dir: 'ltr' },
  { code: 'zh', name: '中文', locale: 'zh_CN', dir: 'ltr' },
  { code: 'ar', name: 'العربية', locale: 'ar_AR', dir: 'rtl' },
  { code: 'id', name: 'Bahasa Indonesia', locale: 'id_ID', dir: 'ltr' },
] as const;
export type Lang = (typeof LANGS)[number]['code'];
export const DEFAULT_LANG: Lang = 'tr';
export const isLang = (s: string): s is Lang => LANGS.some((l) => l.code === s);
export const langMeta = (l: Lang) => LANGS.find((x) => x.code === l)!;

/** Turkish lives at the site root, every other language under /<code>/. */
export function href(lang: Lang, path = ''): string {
  const p = path.replace(/^\/|\/$/g, '');
  const base = lang === DEFAULT_LANG ? '' : `/${lang}`;
  return `${base}/${p ? p + '/' : ''}`.replace(/^\/\//, '/');
}
export const abs = (lang: Lang, path = '') => `${SITE_URL}${href(lang, path)}`;
