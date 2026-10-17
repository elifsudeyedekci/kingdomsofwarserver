import type { Metadata } from 'next';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kingdomsofwar.game';
const OG_IMAGE = `${SITE_URL}/og-image.png`;

export const metadata: Metadata = {
  title: 'Cookie Policy',
  description:
    'Read the Kingdoms of War Cookie Policy. Learn about the cookies and tracking technologies we use to improve your experience in our mobile RTS strategy game.',
  keywords: ['kingdoms of war cookie policy', 'mobile game cookies', 'tracking policy'],
  alternates: {
    canonical: `${SITE_URL}/cookies`,
  },
  openGraph: {
    title: 'Cookie Policy | Kingdoms of War',
    description:
      'Read the Kingdoms of War Cookie Policy. Learn about the cookies and tracking technologies we use to improve your gaming experience.',
    url: `${SITE_URL}/cookies`,
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Kingdoms of War' }],
  },
  twitter: {
    title: 'Cookie Policy | Kingdoms of War',
    description:
      'Read the Kingdoms of War Cookie Policy. Learn about the cookies and tracking technologies we use to improve your gaming experience.',
    images: [OG_IMAGE],
  },
};

export default function CookiePolicyPage() {
  return (
    <>
      <SiteHeader />
      <main className="max-w-3xl mx-auto px-6 py-32">
        <h1 className="text-3xl font-bold text-white mb-6">Cookie Policy</h1>
        <p className="text-stone-400 text-sm">Content coming soon.</p>
      </main>
      <SiteFooter />
    </>
  );
}
