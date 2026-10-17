import Link from './Link';
import { LANGS, type Lang, href, langMeta, STUDIO } from '@/lib/site';
import { getDict } from '@/i18n';
import { Icon } from './Icons';

export function pathFor(lang: Lang, slug: string[]) { return href(lang, slug.join('/')); }

/** Language switcher: native <details>, no JavaScript. Every entry is a real link to the same page in that language (also good for crawlers). */
function LangSwitch({ lang, slug }: { lang: Lang; slug: string[] }) {
  const d = getDict(lang);
  return (
    <details className="lang">
      <summary aria-label={d.ui.language}><Icon name="globe" size={18} /><span>{langMeta(lang).name}</span><Icon name="chevron" size={14} /></summary>
      <ul>
        {LANGS.map((l) => (
          <li key={l.code}><a href={pathFor(l.code, slug)} hrefLang={l.code} lang={l.code} aria-current={l.code === lang ? 'true' : undefined}>{l.name}</a></li>
        ))}
      </ul>
    </details>
  );
}

export function Header({ lang, slug }: { lang: Lang; slug: string[] }) {
  const d = getDict(lang);
  const items: [string, string, string][] = [['', d.nav.home, ''], ['game', d.nav.game, 'game'], ['civilizations', d.nav.civs, 'civilizations'], ['how-to-play', d.nav.play, 'how-to-play'], ['studio', d.nav.studio, 'studio'], ['faq', d.nav.faq, 'faq']];
  const cur = slug[0] ?? '';
  return (
    <header className="site-header">
      <div className="wrap bar">
        <Link href={href(lang)} className="brand" aria-label={d.siteName}>
          <img src="/brand/game-emblem.png" width="44" height="44" alt="" />
          <span className="brand-name"><b>Kingdoms of War</b><i>Mobile Empires</i></span>
        </Link>
        <input type="checkbox" id="nav-toggle" className="nav-toggle" aria-label={d.ui.menu} />
        <label htmlFor="nav-toggle" className="nav-burger" aria-hidden="true"><Icon name="menu" /></label>
        <nav className="nav" aria-label="Main">
          {items.map(([k, label, path]) => (<Link key={k} href={href(lang, path)} aria-current={cur === k ? 'page' : undefined}>{label}</Link>))}
          <Link href={href(lang, 'download')} className="btn btn-gold nav-cta">{d.nav.download}</Link>
          <LangSwitch lang={lang} slug={slug} />
        </nav>
      </div>
    </header>
  );
}

export function Footer({ lang }: { lang: Lang }) {
  const d = getDict(lang);
  const col1: [string, string][] = [['game', d.nav.game], ['civilizations', d.nav.civs], ['how-to-play', d.nav.play], ['download', d.nav.download]];
  const col2: [string, string][] = [['studio', d.nav.studio], ['press', d.nav.press], ['support', d.nav.support], ['faq', d.nav.faq]];
  const col3: [string, string][] = [['privacy', d.legal.privacy.title], ['terms', d.legal.terms.title], ['cookies', d.legal.cookies.title]];
  return (
    <footer className="site-footer">
      <div className="wrap foot-grid">
        <div className="foot-brand">
          <img src="/brand/game-logo-640.webp" width="240" height="138" alt={d.siteName} loading="lazy" />
          <p>{d.footer.blurb}</p>
          <div className="studio-sign"><img src="/brand/studio-emblem.png" width="44" height="44" alt="" loading="lazy" /><span>{d.footer.madeBy}</span></div>
        </div>
        <nav aria-label={d.footer.explore}><h2>{d.footer.explore}</h2><ul>{col1.map(([p, l]) => <li key={p}><Link href={href(lang, p)}>{l}</Link></li>)}</ul></nav>
        <nav aria-label={STUDIO}><h2>{STUDIO}</h2><ul>{col2.map(([p, l]) => <li key={p}><Link href={href(lang, p)}>{l}</Link></li>)}</ul></nav>
        <nav aria-label={d.footer.legal}><h2>{d.footer.legal}</h2><ul>{col3.map(([p, l]) => <li key={p}><Link href={href(lang, p)}>{l}</Link></li>)}</ul></nav>
      </div>
      <div className="wrap foot-base">
        <p>© 2026 {STUDIO}. {d.footer.rights}</p>
        <p className="tm">{d.footer.trademark}</p>
        <ul className="lang-links" aria-label={d.ui.language}>{LANGS.map((l) => <li key={l.code}><a href={href(l.code)} hrefLang={l.code} lang={l.code}>{l.name}</a></li>)}</ul>
      </div>
    </footer>
  );
}
