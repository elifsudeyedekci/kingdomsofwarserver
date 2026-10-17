import { notFound } from 'next/navigation';
import { Shell } from '@/components/Shell';
import { buildMetadata } from '@/lib/pages';
import { isLang } from '@/lib/site';

type P = { params: Promise<{ lang: string }> };
export async function generateMetadata({ params }: P) { const { lang } = await params; return isLang(lang) ? buildMetadata(lang, []) : {}; }
export default async function Page({ params }: P) { const { lang } = await params; if (!isLang(lang)) notFound(); return <Shell lang={lang} slug={[]} />; }
