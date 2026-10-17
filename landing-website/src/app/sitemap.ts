import type { MetadataRoute } from 'next';
import { LANGS, UPDATED, abs, DEFAULT_LANG } from '@/lib/site';
import { allSlugs, key } from '@/lib/pages';

export const dynamic = 'force-static';
export default function sitemap(): MetadataRoute.Sitemap {
  return LANGS.flatMap((l) => allSlugs().map((slug) => {
    const path = key(slug);
    const languages: Record<string, string> = Object.fromEntries(LANGS.map((x) => [x.code, abs(x.code, path)]));
    languages['x-default'] = abs(DEFAULT_LANG, path);
    const depth = slug.length;
    return { url: abs(l.code, path), lastModified: UPDATED, changeFrequency: depth === 0 ? 'weekly' as const : 'monthly' as const, priority: depth === 0 ? 1 : depth === 1 ? 0.8 : 0.6, alternates: { languages } };
  }));
}
