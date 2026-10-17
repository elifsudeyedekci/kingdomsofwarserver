import './globals.css';
import { display } from '@/lib/fonts';
import { getDict } from '@/i18n';

export const metadata = { title: 'Kingdoms of War: Mobile Empires', robots: { index: false } };
export default function GlobalNotFound() {
  const d = getDict('tr'), e = getDict('en');
  return (
    <html lang="tr" className={display.variable}><body>
      <main className="nf"><img src="/brand/game-logo-640.webp" width="320" height="184" alt="Kingdoms of War: Mobile Empires" />
        <h1>404</h1><p>{d.notFound.title} · {e.notFound.title}</p><p><a className="btn btn-gold" href="/">{d.notFound.cta}</a> <a className="btn btn-ghost" href="/en/">{e.notFound.cta}</a></p></main>
    </body></html>
  );
}
