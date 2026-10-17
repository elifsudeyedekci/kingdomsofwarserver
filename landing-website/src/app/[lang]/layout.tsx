import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import '../globals.css';
import { display } from '@/lib/fonts';
import { LANGS, isLang, langMeta, DEFAULT_LANG } from '@/lib/site';

export const dynamicParams = false;
export const generateStaticParams = () => LANGS.filter((l) => l.code !== DEFAULT_LANG).map((l) => ({ lang: l.code }));
export default async function Layout({ children, params }: { children: ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang) || lang === DEFAULT_LANG) notFound();
  const m = langMeta(lang);
  return (<html lang={m.code} dir={m.dir} className={display.variable}><body>{children}</body></html>);
}
