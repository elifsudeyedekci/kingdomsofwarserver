import type { Metadata } from 'next';
import { HeroSection } from '@/components/sections/hero-section';
import { FeaturesSection } from '@/components/sections/features-section';
import { CivsSection } from '@/components/sections/civs-section';
import { ScreenshotsSection } from '@/components/sections/screenshots-section';
import { FaqNewsletterSection } from '@/components/sections/faq-section';
import { CtaSection } from '@/components/sections/cta-section';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kingdomsofwar.game';
const OG_IMAGE = `${SITE_URL}/og-image.svg`;

export const metadata: Metadata = {
  title: 'Kingdoms of War — Epic Mobile RTS Strategy Game',
  description:
    'Command your medieval kingdom, forge alliances, and crush your enemies in Kingdoms of War — the multiplayer mobile RTS inspired by Age of Empires IV. Coming to iOS & Android.',
  keywords: [
    'kingdoms of war',
    'mobile RTS game',
    'real-time strategy mobile',
    'medieval multiplayer game',
    'base building iOS Android',
    'PvP strategy game',
  ],
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: 'Kingdoms of War — Epic Mobile RTS Strategy Game',
    description:
      'Command your medieval kingdom, forge alliances, and crush your enemies in Kingdoms of War — the multiplayer mobile RTS inspired by Age of Empires IV. Coming to iOS & Android.',
    url: SITE_URL,
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: 'Kingdoms of War — Medieval RTS Strategy Game',
      },
    ],
  },
  twitter: {
    title: 'Kingdoms of War — Epic Mobile RTS Strategy Game',
    description:
      'Command your medieval kingdom, forge alliances, and crush your enemies in Kingdoms of War — the multiplayer mobile RTS inspired by Age of Empires IV.',
    images: [OG_IMAGE],
  },
};

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <HeroSection />
        <FeaturesSection />
        <CivsSection />
        <ScreenshotsSection />
        <FaqNewsletterSection />
        <CtaSection />
      </main>
      <SiteFooter />
    </>
  );
}
