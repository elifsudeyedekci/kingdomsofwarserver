import { SITE_URL, STUDIO, CONTACT_EMAIL, LANGS, abs } from '@/lib/site';
import { getDict } from '@/i18n';
import { CIVS } from '@/lib/pages';

export const dynamic = 'force-static';
export function GET() {
  const d = getDict('en');
  const L = (p: string, t: string, desc: string) => `- [${t}](${abs('en', p)}): ${desc}`;
  const body = `# Kingdoms of War: Mobile Empires

> ${d.defaultDesc}

Developer: ${STUDIO}. Genre: real-time strategy (RTS). Status: pre-alpha, not yet released. Planned platforms: Android (Google Play), iOS (App Store), Steam. Languages: ${LANGS.map((l) => l.name).join(', ')}. Website: ${SITE_URL}. Contact: ${CONTACT_EMAIL}.

## Key facts
- Ten civilizations: ${CIVS.map((c) => c.name.en).join(', ')}.
- Four ages: Dark Age, Feudal Age, Castle Age, Imperial Age.
- Victory conditions: conquest, sacred sites, wonder, relics, score, sudden death.
- Skirmish against AI is in the game; online multiplayer is in development; the campaign is planned.
- Touch controls and gamepad support; no release date or price has been announced.

## Pages
${L('', 'Home', d.defaultDesc)}
${L('game', d.game.title, d.game.desc)}
${L('civilizations', d.civs.title, d.civs.desc)}
${L('how-to-play', d.play.title, d.play.desc)}
${L('download', d.download.title, d.download.desc)}
${L('studio', d.studio.title, d.studio.desc)}
${L('faq', d.faq.title, d.faq.desc)}
${L('press', d.press.title, d.press.desc)}
${L('support', d.support.title, d.support.desc)}

## Civilizations
${CIVS.map((c) => L(`civilizations/${c.slug}`, c.name.en, c.desc.en)).join('\n')}

## Optional
- [Full text for language models](${SITE_URL}/llms-full.txt)
- [Sitemap](${SITE_URL}/sitemap.xml)
- Every page exists in 12 languages: Turkish at the site root, the others under /en/, /de/, /fr/, /es/, /pt/, /ru/, /ja/, /ko/, /zh/, /ar/, /id/.
`;
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
