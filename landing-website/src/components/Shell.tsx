import type { ReactNode } from 'react';
import { Header, Footer } from './Chrome';
import { PageView } from './Views';
import { jsonLd } from '@/lib/pages';
import { getDict } from '@/i18n';
import type { Lang } from '@/lib/site';

export function Shell({ lang, slug }: { lang: Lang; slug: string[] }): ReactNode {
  const d = getDict(lang);
  const ld = JSON.stringify(jsonLd(lang, slug)).replace(/</g, '\u003c');
  return (
    <>
      <a className="skip" href="#main">{d.ui.skip}</a>
      <Header lang={lang} slug={slug} />
      <main id="main"><PageView lang={lang} slug={slug} /></main>
      <Footer lang={lang} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld }} />
    </>
  );
}
