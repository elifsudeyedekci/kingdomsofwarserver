import Link from './Link';
import { href, CONTACT_EMAIL, STORE_URLS, UPDATED, STUDIO, type Lang } from '@/lib/site';
import { getDict } from '@/i18n';
import { legalBody, type LegalKey } from '@/i18n/legal';
import { AGES, CIVS, findCiv, type Civ } from '@/lib/pages';
import { Icon } from './Icons';
import { Hero } from './Hero';

const FEAT_ICONS = ['crown', 'coins', 'ages', 'swords', 'trophy', 'brain', 'gamepad', 'bell'];
const AGE_BG = ['bg-dusk', 'hero-dawn', 'hero-siege', 'bg-night'];

function Crumbs({ lang, trail }: { lang: Lang; trail: { label: string; to?: string }[] }) {
  const d = getDict(lang);
  return (
    <nav className="crumbs" aria-label="Breadcrumb"><ol>
      <li><Link href={href(lang)}>{d.ui.home}</Link></li>
      {trail.map((t, i) => <li key={i} aria-current={i === trail.length - 1 ? 'page' : undefined}>{t.to ? <Link href={href(lang, t.to)}>{t.label}</Link> : t.label}</li>)}
    </ol></nav>
  );
}
function PageHead({ lang, title, lead, img, trail }: { lang: Lang; title: string; lead?: string; img: string; trail: { label: string; to?: string }[] }) {
  return (
    <section className="page-head" style={{ backgroundImage: `url(/img/${img}.webp)` }}>
      <div className="page-head-shade" />
      <div className="wrap"><Crumbs lang={lang} trail={trail} /><h1>{title}</h1>{lead && <p className="lead">{lead}</p>}</div>
    </section>
  );
}
function Status({ lang }: { lang: Lang }) {
  const d = getDict(lang);
  return <div className="status" role="note"><span className="pill">{d.ui.status}</span><span>{d.ui.statusText}</span></div>;
}
function CivCard({ lang, c }: { lang: Lang; c: Civ }) {
  const d = getDict(lang);
  return (
    <Link href={href(lang, `civilizations/${c.slug}`)} className="civ-card" aria-label={`${d.civs.view}: ${c.name[lang]}`}>
      <img src={`/img/civ/${c.slug}.svg`} width="120" height="120" alt="" loading="lazy" />
      <h3>{c.name[lang]}</h3>
      <p>{c.desc[lang]}</p>
      <span className="more">{d.civs.view} <Icon name="arrow" size={16} /></span>
    </Link>
  );
}
function StoreButtons({ lang, big }: { lang: Lang; big?: boolean }) {
  const d = getDict(lang);
  const items: [string, string, string | null, string][] = [['android', d.download.stores[0].n, STORE_URLS.googlePlay, d.download.stores[0].s], ['apple', d.download.stores[1].n, STORE_URLS.appStore, d.download.stores[1].s], ['steam', d.download.stores[2].n, STORE_URLS.steam, d.download.stores[2].s]];
  return (
    <ul className={`stores${big ? ' big' : ''}`}>
      {items.map(([ic, name, url, sub]) => (
        <li key={name}>{url
          ? <a className="store" href={url} rel="noopener"><Icon name={ic} size={30} /><span><small>{sub}</small><b>{name}</b></span></a>
          : <span className="store off" aria-disabled="true" role="link"><Icon name={ic} size={30} /><span><small>{sub}</small><b>{name}</b></span><em>{d.download.badge}</em></span>}</li>
      ))}
    </ul>
  );
}

function Home({ lang }: { lang: Lang }) {
  const d = getDict(lang);
  const imgs = ['/img/hero-castle', '/img/hero-army', '/img/hero-siege', '/img/hero-dawn'];
  return (
    <>
      <Hero slides={d.home.slides.map((s, i) => ({ ...s, img: imgs[i] }))} h1={d.home.h1} logoAlt={d.tagline} cta={d.nav.download} ctaHref={href(lang, 'download')} more={d.ui.learnMore} moreHref={href(lang, 'game')} />
      <Status lang={lang} />
      <section className="band">
        <div className="wrap split">
          <div><h2>{d.home.introTitle}</h2>{d.home.intro.map((p, i) => <p key={i}>{p}</p>)}</div>
          <ul className="stats">{d.home.stats.map((s) => <li key={s.l}><b>{s.n}</b><span>{s.l}</span></li>)}</ul>
        </div>
      </section>
      <section className="band alt" style={{ backgroundImage: 'url(/img/bg-night.webp)' }}>
        <div className="band-shade" />
        <div className="wrap">
          <header className="sec-head"><h2>{d.home.featTitle}</h2><p>{d.home.featSub}</p></header>
          <ul className="feat-grid">{d.home.feats.map((f, i) => (<li key={i}><span className="ico"><Icon name={FEAT_ICONS[i]} size={28} /></span><h3>{f.t}</h3><p>{f.p}</p></li>))}</ul>
        </div>
      </section>
      <section className="band">
        <div className="wrap">
          <header className="sec-head"><h2>{d.home.civTitle}</h2><p>{d.home.civSub}</p></header>
          <div className="civ-grid">{CIVS.map((c) => <CivCard key={c.id} lang={lang} c={c} />)}</div>
          <p className="center"><Link className="btn btn-ghost" href={href(lang, 'civilizations')}>{d.ui.viewAll}</Link></p>
        </div>
      </section>
      <section className="band alt" style={{ backgroundImage: 'url(/img/bg-dusk.webp)' }}>
        <div className="band-shade" />
        <div className="wrap">
          <header className="sec-head"><h2>{d.home.ageTitle}</h2><p>{d.home.ageSub}</p></header>
          <ol className="age-grid">{AGES.map((a, i) => (
            <li key={a.n} style={{ backgroundImage: `url(/img/${AGE_BG[i]}-960.webp)` }}><div className="age-shade" /><div className="age-body"><span className="num">{['I', 'II', 'III', 'IV'][i]}</span><h3>{a.name[lang]}</h3><p>{a.desc[lang]}</p></div></li>
          ))}</ol>
        </div>
      </section>
      <section className="band">
        <div className="wrap">
          <header className="sec-head"><h2>{d.home.modesTitle}</h2><p>{d.home.modesSub}</p></header>
          <ul className="mode-grid">{d.home.modes.map((m, i) => (<li key={i}><span className="badge">{m.b}</span><h3>{m.t}</h3><p>{m.p}</p></li>))}</ul>
        </div>
      </section>
      <section className="cta" style={{ backgroundImage: 'url(/img/hero-castle.webp)' }}>
        <div className="band-shade" />
        <div className="wrap center"><h2>{d.home.ctaTitle}</h2><p>{d.home.ctaP}</p><StoreButtons lang={lang} big /></div>
      </section>
      <section className="band">
        <div className="wrap studio-strip">
          <img src="/brand/studio-logo.png" width="220" height="113" alt={STUDIO} loading="lazy" />
          <div><h2>{d.home.studioTitle}</h2><p>{d.home.studioP}</p><Link className="btn btn-ghost" href={href(lang, 'studio')}>{d.home.studioCta}</Link></div>
        </div>
      </section>
    </>
  );
}

function Game({ lang }: { lang: Lang }) {
  const d = getDict(lang);
  const bgs = ['bg-dusk', 'hero-army', 'hero-dawn', 'bg-winter', 'bg-night'];
  return (
    <>
      <PageHead lang={lang} title={d.game.title} lead={d.game.lead} img="hero-castle" trail={[{ label: d.game.title }]} />
      <Status lang={lang} />
      {d.game.sections.map((s, i) => (
        <section key={i} className={`band showcase${i % 2 ? ' flip' : ''}`}>
          <div className="wrap split">
            <div><h2>{s.t}</h2>{s.p.map((p, k) => <p key={k}>{p}</p>)}</div>
            <div className="art" style={{ backgroundImage: `url(/img/${bgs[i]}-960.webp)` }} role="img" aria-label={s.t} />
          </div>
        </section>
      ))}
      <section className="band alt" style={{ backgroundImage: 'url(/img/bg-night.webp)' }}>
        <div className="band-shade" />
        <div className="wrap center"><h2>{d.game.platformsTitle}</h2><p className="lead">{d.game.platforms}</p><StoreButtons lang={lang} /></div>
      </section>
    </>
  );
}

function Civs({ lang }: { lang: Lang }) {
  const d = getDict(lang);
  return (
    <>
      <PageHead lang={lang} title={d.civs.title} lead={d.civs.lead} img="hero-army" trail={[{ label: d.civs.title }]} />
      <section className="band"><div className="wrap"><div className="civ-grid">{CIVS.map((c) => <CivCard key={c.id} lang={lang} c={c} />)}</div></div></section>
    </>
  );
}

function CivDetail({ lang, c }: { lang: Lang; c: Civ }) {
  const d = getDict(lang);
  const others = CIVS.filter((x) => x.id !== c.id).slice(0, 4);
  return (
    <>
      <PageHead lang={lang} title={c.name[lang]} lead={c.desc[lang]} img="hero-dawn" trail={[{ label: d.civs.title, to: 'civilizations' }, { label: c.name[lang] }]} />
      <section className="band">
        <div className="wrap civ-detail">
          <img className="crest" src={`/img/civ/${c.slug}.svg`} width="240" height="240" alt={c.name[lang]} />
          <div>
            {c.bonuses.length > 0 && (<><h2>{d.ui.traits}</h2><ul className="trait-list" lang="en">{c.bonuses.map((b, i) => <li key={i}>{b}</li>)}</ul>{lang !== 'en' && <p className="note">{d.ui.traitsNote}</p>}</>)}
          </div>
        </div>
      </section>
      {c.units.length > 0 && (
        <section className="band alt" style={{ backgroundImage: 'url(/img/bg-winter.webp)' }}>
          <div className="band-shade" />
          <div className="wrap">
            <header className="sec-head"><h2>{d.ui.uniqueUnits}</h2></header>
            <div className="table-wrap"><table className="units">
              <thead><tr><th scope="col">{c.name[lang]}</th><th scope="col">{d.ui.age}</th><th scope="col">{d.ui.hp}</th><th scope="col">{d.ui.attack}</th><th scope="col">{d.ui.range}</th><th scope="col">{d.ui.cost}</th></tr></thead>
              <tbody>{c.units.map((u) => (<tr key={u.id}><th scope="row">{u.name[lang]}</th><td>{u.age}</td><td>{u.hp}</td><td>{u.attack}</td><td>{u.range || '—'}</td><td>{[u.food && `${d.ui.food} ${u.food}`, u.gold && `${d.ui.gold} ${u.gold}`].filter(Boolean).join(' · ')}</td></tr>))}</tbody>
            </table></div>
          </div>
        </section>
      )}
      <section className="band"><div className="wrap"><header className="sec-head"><h2>{d.ui.related}</h2></header><div className="civ-grid four">{others.map((o) => <CivCard key={o.id} lang={lang} c={o} />)}</div></div></section>
    </>
  );
}

function Play({ lang }: { lang: Lang }) {
  const d = getDict(lang);
  return (
    <>
      <PageHead lang={lang} title={d.play.title} lead={d.play.lead} img="hero-army" trail={[{ label: d.play.title }]} />
      <section className="band"><div className="wrap"><ol className="steps">{d.play.steps.map((s, i) => (<li key={i}><span className="n">{i + 1}</span><div><h2>{s.t}</h2><p>{s.p}</p></div></li>))}</ol></div></section>
      <section className="band alt" style={{ backgroundImage: 'url(/img/bg-dusk.webp)' }}>
        <div className="band-shade" />
        <div className="wrap">
          <header className="sec-head"><h2>{d.play.resTitle}</h2></header>
          <ul className="res-grid">{d.play.res.map((r, i) => <li key={i}><Icon name={['coins', 'map', 'trophy', 'shield'][i]} size={28} /><h3>{r.t}</h3><p>{r.p}</p></li>)}</ul>
        </div>
      </section>
      <section className="band"><div className="wrap"><header className="sec-head"><h2>{d.play.victoryTitle}</h2></header><ul className="mode-grid six">{d.play.victory.map((v, i) => <li key={i}><h3>{v.t}</h3><p>{v.p}</p></li>)}</ul></div></section>
    </>
  );
}

function Download({ lang }: { lang: Lang }) {
  const d = getDict(lang);
  return (
    <>
      <PageHead lang={lang} title={d.download.title} lead={d.download.lead} img="hero-dawn" trail={[{ label: d.download.title }]} />
      <Status lang={lang} />
      <section className="band"><div className="wrap center"><StoreButtons lang={lang} big /><p className="note">{d.ui.openStore}</p>
        <h2>{d.download.reqTitle}</h2><p className="lead">{d.download.req}</p>
        <p>{d.download.news}</p><p><a className="btn btn-gold" href={`mailto:${CONTACT_EMAIL}`}><Icon name="mail" size={18} /> {CONTACT_EMAIL}</a></p></div></section>
    </>
  );
}

function Studio({ lang }: { lang: Lang }) {
  const d = getDict(lang);
  return (
    <>
      <PageHead lang={lang} title={d.studio.title} lead={d.studio.lead} img="bg-night" trail={[{ label: d.studio.title }]} />
      <section className="band"><div className="wrap split">
        <div><img src="/brand/studio-logo.png" width="320" height="164" alt={STUDIO} />{d.studio.p.map((p, i) => <p key={i}>{p}</p>)}<p className="note">{d.studio.madeWith}</p></div>
        <dl className="facts"><h2>{d.studio.factsTitle}</h2>{d.studio.facts.map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v}</dd></div>))}</dl>
      </div></section>
    </>
  );
}

function Faq({ lang }: { lang: Lang }) {
  const d = getDict(lang);
  return (
    <>
      <PageHead lang={lang} title={d.faq.title} img="bg-dusk" trail={[{ label: d.faq.title }]} />
      <section className="band"><div className="wrap narrow"><div className="faq">{d.faq.items.map((q, i) => (<details key={i} {...(i === 0 ? { open: true } : {})}><summary><h2>{q.q}</h2><Icon name="chevron" size={20} /></summary><p>{q.a}</p></details>))}</div></div></section>
    </>
  );
}

function Press({ lang }: { lang: Lang }) {
  const d = getDict(lang);
  const file = (k: string) => (k.startsWith('hero-') ? `/img/${k}.webp` : `/brand/${k}.png`);
  return (
    <>
      <PageHead lang={lang} title={d.press.title} lead={d.press.lead} img="hero-siege" trail={[{ label: d.press.title }]} />
      <section className="band"><div className="wrap split">
        <dl className="facts"><h2>{d.press.factsTitle}</h2>{d.press.facts.map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v}</dd></div>))}</dl>
        <div><h2>{d.press.assetsTitle}</h2><ul className="downloads">{d.press.assets.map(([label, k]) => (<li key={k}><a href={file(k)} download><img src={k.startsWith('hero-') ? `/img/${k}-960.webp` : file(k)} width="96" height="64" alt="" loading="lazy" /><span>{label}</span><Icon name="download" size={20} /></a></li>))}</ul><p className="note">{d.press.usage}</p></div>
      </div></section>
    </>
  );
}

function Support({ lang }: { lang: Lang }) {
  const d = getDict(lang);
  return (
    <>
      <PageHead lang={lang} title={d.support.title} lead={d.support.lead} img="bg-winter" trail={[{ label: d.support.title }]} />
      <section className="band"><div className="wrap split">
        <div><h2>{d.support.writeUs}</h2><p>{d.support.emailLabel}: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p><p><a className="btn btn-gold" href={`mailto:${CONTACT_EMAIL}`}><Icon name="mail" size={18} /> {d.support.writeUs}</a></p>
          <h2>{d.support.dataTitle}</h2><p>{d.support.data}</p></div>
        <div><h2>{d.support.bugTitle}</h2><ul className="check">{d.support.bug.map((b, i) => <li key={i}>{b}</li>)}</ul></div>
      </div></section>
    </>
  );
}

function Legal({ lang, k }: { lang: Lang; k: LegalKey }) {
  const d = getDict(lang);
  const { sections, lang: bodyLang } = legalBody(lang, k);
  return (
    <>
      <PageHead lang={lang} title={d.legal[k].title} img="bg-night" trail={[{ label: d.legal[k].title }]} />
      <section className="band"><div className="wrap narrow prose">
        <p className="note">{d.ui.updated}: <time dateTime={UPDATED}>{UPDATED}</time></p>
        {bodyLang !== lang && <p className="note">{d.ui.legalNote}</p>}
        <div lang={bodyLang}>{sections.map((s, i) => (<section key={i}><h2>{s.h}</h2>{s.p.map((p, j) => <p key={j}>{p}</p>)}</section>))}</div>
      </div></section>
    </>
  );
}

export function PageView({ lang, slug }: { lang: Lang; slug: string[] }) {
  const civ = findCiv(slug);
  if (civ) return <CivDetail lang={lang} c={civ} />;
  switch (slug[0] ?? '') {
    case '': return <Home lang={lang} />;
    case 'game': return <Game lang={lang} />;
    case 'civilizations': return <Civs lang={lang} />;
    case 'how-to-play': return <Play lang={lang} />;
    case 'download': return <Download lang={lang} />;
    case 'studio': return <Studio lang={lang} />;
    case 'faq': return <Faq lang={lang} />;
    case 'press': return <Press lang={lang} />;
    case 'support': return <Support lang={lang} />;
    case 'privacy': case 'terms': case 'cookies': return <Legal lang={lang} k={slug[0] as LegalKey} />;
    default: return null;
  }
}
