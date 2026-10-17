import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

export const dynamic = 'force-static';
const AI = ['GPTBot', 'ChatGPT-User', 'OAI-SearchBot', 'ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'anthropic-ai', 'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Applebot', 'Applebot-Extended', 'Bingbot', 'DuckAssistBot', 'CCBot', 'cohere-ai', 'Meta-ExternalAgent', 'Amazonbot', 'YouBot', 'MistralAI-User'];
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: '*', allow: '/' }, ...AI.map((userAgent) => ({ userAgent, allow: '/' }))], sitemap: `${SITE_URL}/sitemap.xml`, host: SITE_URL };
}
