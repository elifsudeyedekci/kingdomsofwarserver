import { SITE_URL, STUDIO, CONTACT_EMAIL } from '@/lib/site';
import { getDict } from '@/i18n';
import { AGES, CIVS } from '@/lib/pages';

export const dynamic = 'force-static';
export function GET() {
  const d = getDict('en');
  const parts: string[] = [`# Kingdoms of War: Mobile Empires (full text)\n\nSource: ${SITE_URL} (English). Developer: ${STUDIO}. Contact: ${CONTACT_EMAIL}.\n\n${d.defaultDesc}\n\nStatus: ${d.ui.statusText}\n`];
  parts.push(`## ${d.home.introTitle}\n\n${d.home.intro.join('\n\n')}\n`);
  parts.push(`## ${d.home.featTitle}\n\n${d.home.feats.map((f) => `- ${f.t}: ${f.p}`).join('\n')}\n`);
  parts.push(`## ${d.home.ageTitle}\n\n${AGES.map((a) => `- ${a.name.en}: ${a.desc.en}`).join('\n')}\n`);
  parts.push(`## ${d.game.title}\n\n${d.game.sections.map((s) => `### ${s.t}\n\n${s.p.join('\n\n')}`).join('\n\n')}\n\n${d.game.platforms}\n`);
  parts.push(`## ${d.play.title}\n\n${d.play.steps.map((s, i) => `${i + 1}. ${s.t}: ${s.p}`).join('\n')}\n\n### ${d.play.resTitle}\n${d.play.res.map((r) => `- ${r.t}: ${r.p}`).join('\n')}\n\n### ${d.play.victoryTitle}\n${d.play.victory.map((v) => `- ${v.t}: ${v.p}`).join('\n')}\n`);
  parts.push(`## ${d.civs.title}\n\n${CIVS.map((c) => `### ${c.name.en}\n\n${c.desc.en}\n\nBonuses:\n${c.bonuses.map((b) => `- ${b}`).join('\n')}\n\nUnique units:\n${c.units.map((u) => `- ${u.name.en} (age ${u.age}, health ${u.hp}, attack ${u.attack}, range ${u.range}, cost food ${u.food} gold ${u.gold})`).join('\n')}`).join('\n\n')}\n`);
  parts.push(`## ${d.faq.title}\n\n${d.faq.items.map((q) => `### ${q.q}\n\n${q.a}`).join('\n\n')}\n`);
  return new Response(parts.join('\n'), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
