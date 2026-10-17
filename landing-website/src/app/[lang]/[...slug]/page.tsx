import { notFound } from 'next/navigation';
import { Shell } from '@/components/Shell';
import { allSlugs, buildMetadata, isValid } from '@/lib/pages';
import { LANGS, isLang, DEFAULT_LANG } from '@/lib/site';

export const dynamicParams = false;
export const generateStaticParams = () => LANGS.filter((l) => l.code !== DEFAULT_LANG).flatMap((l) => allSlugs().filter((s) => s.length > 0).map((slug) => ({ lang: l.code, slug })));
type P = { params: Promise<{ lang: string; slug: string[] }> };
export async function generateMetadata({ params }: P) { const { lang, slug } = await params; return isLang(lang) ? buildMetadata(lang, slug) : {}; }
export default async function Page({ params }: P) { const { lang, slug } = await params; if (!isLang(lang) || !isValid(slug)) notFound(); return <Shell lang={lang} slug={slug} />; }
