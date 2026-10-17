import type { Metadata } from 'next';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kingdomsofwar.game';
const OG_IMAGE = `${SITE_URL}/og-image.png`;

export const metadata: Metadata = {
  title: 'Support',
  description:
    'Get help with Kingdoms of War. Find answers to frequently asked questions, report issues, and contact our support team for our mobile RTS strategy game on iOS and Android.',
  keywords: ['kingdoms of war support', 'mobile game help', 'game support', 'contact us'],
  alternates: {
    canonical: `${SITE_URL}/support`,
  },
  openGraph: {
    title: 'Support | Kingdoms of War',
    description:
      'Get help with Kingdoms of War. Find answers to frequently asked questions, report issues, and contact our support team.',
    url: `${SITE_URL}/support`,
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Kingdoms of War' }],
  },
  twitter: {
    title: 'Support | Kingdoms of War',
    description:
      'Get help with Kingdoms of War. Find answers to frequently asked questions, report issues, and contact our support team.',
    images: [OG_IMAGE],
  },
};

export default function SupportPage() {
  return (
    <>
      <SiteHeader />
      <main className="max-w-3xl mx-auto px-6 py-32">
        <h1 className="text-3xl font-bold text-white mb-6">Support</h1>
        <p className="text-stone-400 text-sm">Content coming soon.</p>
      </main>
      <SiteFooter />
    </>
  );
}
