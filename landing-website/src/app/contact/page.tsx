import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { ContactForm } from '@/components/sections/contact-form';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kingdomsofwar.game';
const OG_IMAGE = `${SITE_URL}/og-image.png`;

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Get in touch with the Kingdoms of War team. Submit a bug report, press inquiry, partnership request, or general question. We respond within 48 hours.',
  keywords: ['kingdoms of war contact', 'game support', 'press inquiry', 'bug report'],
  alternates: {
    canonical: `${SITE_URL}/contact`,
  },
  openGraph: {
    title: 'Contact | Kingdoms of War',
    description:
      'Get in touch with the Kingdoms of War team. Submit a bug report, press inquiry, partnership request, or general question.',
    url: `${SITE_URL}/contact`,
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Kingdoms of War' }],
  },
  twitter: {
    title: 'Contact | Kingdoms of War',
    description:
      'Get in touch with the Kingdoms of War team. We respond within 48 hours.',
    images: [OG_IMAGE],
  },
};

export default function ContactPage() {
  return (
    <>
      <SiteHeader />
      <main className="max-w-5xl mx-auto px-6 py-28">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-stone-400 hover:text-amber-500 transition-colors mb-10"
        >
          <span aria-hidden="true">&#8592;</span> Back to Home
        </Link>

        <div className="mb-12">
          <h1 className="text-4xl font-extrabold text-white mb-3">Contact Us</h1>
          <p className="text-stone-400 text-lg max-w-xl leading-relaxed">
            Have a question, spotted a bug, or want to partner with us? We&apos;d love to hear
            from you. Our team responds within 48 hours.
          </p>
        </div>

        <ContactForm />
      </main>
      <SiteFooter />
    </>
  );
}
