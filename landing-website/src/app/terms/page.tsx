import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kingdomsofwar.game';
const OG_IMAGE = `${SITE_URL}/og-image.png`;

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'Read the Kingdoms of War Terms of Service. Understand the rules, rights, and responsibilities governing your use of our mobile RTS strategy game on iOS and Android.',
  keywords: ['kingdoms of war terms of service', 'mobile game terms', 'user agreement'],
  alternates: {
    canonical: `${SITE_URL}/terms`,
  },
  openGraph: {
    title: 'Terms of Service | Kingdoms of War',
    description:
      'Read the Kingdoms of War Terms of Service. Understand the rules, rights, and responsibilities governing your use of our mobile RTS strategy game.',
    url: `${SITE_URL}/terms`,
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Kingdoms of War' }],
  },
  twitter: {
    title: 'Terms of Service | Kingdoms of War',
    description:
      'Read the Kingdoms of War Terms of Service. Understand the rules, rights, and responsibilities governing your use of our mobile RTS strategy game.',
    images: [OG_IMAGE],
  },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-bold text-amber-500 mb-3">{title}</h2>
      <div className="space-y-3 text-stone-300 leading-relaxed">{children}</div>
    </section>
  );
}

export default function TermsOfServicePage() {
  return (
    <>
      <SiteHeader />
      <main className="max-w-3xl mx-auto px-6 py-28">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-stone-400 hover:text-amber-500 transition-colors mb-10"
        >
          <span aria-hidden="true">&#8592;</span> Back to Home
        </Link>

        <h1 className="text-4xl font-extrabold text-white mb-2">Terms of Service</h1>
        <p className="text-stone-500 text-sm mb-12">Effective Date: January 1, 2026</p>

        <p className="text-stone-300 leading-relaxed mb-10">
          These Terms of Service (&quot;Terms&quot;) govern your access to and use of the Kingdoms
          of War mobile game (&quot;the Game&quot;), websites, and related services
          (collectively, &quot;the Service&quot;) operated by Kingdoms of War Inc.
          (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;). By downloading, installing, or
          playing the Game, you agree to be bound by these Terms. If you do not agree, do not use
          the Service.
        </p>

        <Section title="1. Acceptance of Terms">
          <p>
            You must be at least 13 years old (or the minimum age in your jurisdiction) to use
            the Service. If you are under 18, you confirm that a parent or guardian has reviewed
            and accepted these Terms on your behalf. By using the Service, you represent that you
            meet these age requirements.
          </p>
          <p>
            We reserve the right to modify these Terms at any time. We will notify you of
            material changes via in-game message or email. Your continued use of the Service
            after changes become effective constitutes acceptance of the revised Terms.
          </p>
        </Section>

        <Section title="2. Game License">
          <p>
            Subject to your compliance with these Terms, we grant you a limited, non-exclusive,
            non-transferable, revocable license to download and play the Game for your personal,
            non-commercial entertainment purposes on devices you own or control.
          </p>
          <p>
            This license does not include the right to: (a) sublicense, sell, resell, or
            commercially exploit the Game; (b) modify, adapt, translate, reverse engineer, or
            create derivative works; (c) use automated tools, bots, scripts, or cheats; or (d)
            access the Game&apos;s backend systems other than through our official client.
          </p>
        </Section>

        <Section title="3. User Accounts">
          <p>
            You are responsible for maintaining the confidentiality of your account credentials
            and for all activity that occurs under your account. Notify us immediately at{' '}
            <a
              href="mailto:support@kingdoms-of-war.com"
              className="text-amber-500 hover:text-amber-400 underline underline-offset-2"
            >
              support@kingdoms-of-war.com
            </a>{' '}
            if you suspect unauthorized access.
          </p>
          <p>
            You may not share, sell, or transfer your account to another person. We may suspend
            or terminate accounts that we believe have been compromised or used in violation of
            these Terms.
          </p>
        </Section>

        <Section title="4. Virtual Currency and Items">
          <p>
            The Game may include virtual currency (&quot;Gold&quot;, &quot;Gems&quot;, or similar)
            and virtual items (units, buildings, cosmetics) that can be earned through gameplay or
            purchased with real money via in-app purchase.
          </p>
          <p>
            <strong className="text-white">No Real-World Value:</strong> Virtual currency and
            items have no monetary value outside the Game. They cannot be exchanged for real
            money, transferred between players, or redeemed for any real-world goods or services.
          </p>
          <p>
            <strong className="text-white">No Refunds:</strong> All purchases of virtual currency
            and items are final and non-refundable, except as required by applicable law or
            platform policies (Apple App Store / Google Play).
          </p>
          <p>
            <strong className="text-white">No Ownership:</strong> You do not own virtual items.
            We grant you a limited license to use them within the Game. We may modify, remove, or
            discontinue virtual items at any time, including upon termination of the Service.
          </p>
        </Section>

        <Section title="5. Prohibited Conduct">
          <p>You agree not to:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Use cheats, exploits, hacks, mods, or unauthorized third-party software</li>
            <li>Engage in harassment, hate speech, or threatening behavior toward other players</li>
            <li>Impersonate other players, staff, or public figures</li>
            <li>Spam, phish, or attempt to defraud other players</li>
            <li>Share, sell, or purchase accounts or virtual items outside the Game</li>
            <li>Attempt to disrupt or overload our servers or infrastructure</li>
            <li>Collect or harvest other players&apos; personal data without consent</li>
            <li>Use the Game for any commercial purpose without our written consent</li>
          </ul>
          <p>
            Violation of these rules may result in a warning, temporary suspension, or permanent
            ban, at our sole discretion.
          </p>
        </Section>

        <Section title="6. User-Generated Content">
          <p>
            If you create content within the Game (clan names, chat messages, profile text), you
            grant us a worldwide, royalty-free license to use, display, and moderate that content
            as necessary to operate the Service. You retain ownership but are solely responsible
            for any content you create. We may remove content that violates these Terms or
            applicable law.
          </p>
        </Section>

        <Section title="7. Intellectual Property">
          <p>
            All Game content — including artwork, music, code, trademarks, characters, and story
            — is owned by or licensed to Kingdoms of War Inc. and is protected by copyright,
            trademark, and other intellectual property laws. Nothing in these Terms grants you
            any right, title, or interest in our intellectual property beyond the limited gameplay
            license described above.
          </p>
        </Section>

        <Section title="8. Disclaimers">
          <p>
            THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT
            WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE SERVICE WILL
            BE UNINTERRUPTED, ERROR-FREE, OR FREE OF VIRUSES OR HARMFUL COMPONENTS. YOUR USE OF
            THE SERVICE IS AT YOUR SOLE RISK.
          </p>
        </Section>

        <Section title="9. Limitation of Liability">
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, KINGDOMS OF WAR INC. AND ITS
            OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT,
            INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES — INCLUDING LOSS OF PROFITS,
            LOSS OF DATA, OR LOSS OF VIRTUAL ITEMS — ARISING FROM YOUR USE OF OR INABILITY TO
            USE THE SERVICE.
          </p>
          <p>
            OUR TOTAL LIABILITY TO YOU FOR ALL CLAIMS ARISING FROM OR RELATED TO THE SERVICE
            SHALL NOT EXCEED THE GREATER OF (A) USD $100 OR (B) THE AMOUNT YOU PAID US IN THE
            12 MONTHS PRECEDING THE CLAIM.
          </p>
        </Section>

        <Section title="10. Governing Law and Dispute Resolution">
          <p>
            These Terms are governed by the laws of the State of Delaware, USA, without regard
            to its conflict of law provisions. Any dispute arising under these Terms shall be
            resolved by binding arbitration under the rules of the American Arbitration
            Association, on an individual (not class) basis, in Wilmington, Delaware.
          </p>
          <p>
            Notwithstanding the above, either party may seek injunctive or other equitable
            relief in any court of competent jurisdiction to prevent irreparable harm.
          </p>
        </Section>

        <Section title="11. Termination">
          <p>
            We may suspend or terminate your access to the Service at any time, with or without
            cause, and with or without notice. Upon termination, your license to use the Game
            immediately ceases and any unused virtual currency or items are forfeited without
            compensation, to the extent permitted by law.
          </p>
          <p>
            You may terminate your account at any time by contacting{' '}
            <a
              href="mailto:support@kingdoms-of-war.com"
              className="text-amber-500 hover:text-amber-400 underline underline-offset-2"
            >
              support@kingdoms-of-war.com
            </a>
            .
          </p>
        </Section>

        <Section title="12. Contact">
          <address className="not-italic text-stone-300 space-y-1">
            <p className="font-semibold text-white">Kingdoms of War Inc. — Legal</p>
            <p>
              Email:{' '}
              <a
                href="mailto:legal@kingdoms-of-war.com"
                className="text-amber-500 hover:text-amber-400 underline underline-offset-2"
              >
                legal@kingdoms-of-war.com
              </a>
            </p>
            <p>Address: 123 Strategy Lane, Wilmington, DE 19801, USA</p>
          </address>
        </Section>
      </main>
      <SiteFooter />
    </>
  );
}
