import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kingdomsofwar.game';
const OG_IMAGE = `${SITE_URL}/og-image.png`;

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'Read the Kingdoms of War Privacy Policy. Learn how we collect, use, and protect your personal data when you play our mobile RTS strategy game on iOS and Android.',
  keywords: ['kingdoms of war privacy policy', 'mobile game privacy', 'data protection'],
  alternates: {
    canonical: `${SITE_URL}/privacy`,
  },
  openGraph: {
    title: 'Privacy Policy | Kingdoms of War',
    description:
      'Read the Kingdoms of War Privacy Policy. Learn how we collect, use, and protect your personal data when you play our mobile RTS strategy game.',
    url: `${SITE_URL}/privacy`,
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Kingdoms of War' }],
  },
  twitter: {
    title: 'Privacy Policy | Kingdoms of War',
    description:
      'Read the Kingdoms of War Privacy Policy. Learn how we collect, use, and protect your personal data when you play our mobile RTS strategy game.',
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

export default function PrivacyPolicyPage() {
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

        <h1 className="text-4xl font-extrabold text-white mb-2">Privacy Policy</h1>
        <p className="text-stone-500 text-sm mb-12">Effective Date: January 1, 2026</p>

        <p className="text-stone-300 leading-relaxed mb-10">
          Kingdoms of War (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is committed to protecting
          your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard
          your information when you play our mobile real-time strategy game (&quot;the Game&quot;)
          on iOS and Android. Please read this policy carefully. If you disagree with its terms,
          please discontinue use of the Game.
        </p>

        <Section title="1. Information We Collect">
          <p>
            <strong className="text-white">Account Data:</strong> When you create an account, we
            collect your username, email address, and a hashed password. If you register via a
            third-party service (Apple Sign-In, Google Play Games), we receive a unique identifier
            and, if permitted, your display name.
          </p>
          <p>
            <strong className="text-white">Gameplay Telemetry:</strong> We collect data about
            your in-game actions — battles fought, civilizations used, session lengths, feature
            usage, and match outcomes — to improve game balance and player experience.
          </p>
          <p>
            <strong className="text-white">Payment Information:</strong> In-app purchases are
            processed by Apple App Store or Google Play. We do not store your credit card number
            or payment credentials. We receive a transaction ID and purchase record to credit your
            account with virtual currency or items.
          </p>
          <p>
            <strong className="text-white">Device &amp; Technical Data:</strong> We automatically
            collect your device model, operating system version, IP address, language settings, and
            crash/error logs to provide support and maintain service stability.
          </p>
          <p>
            <strong className="text-white">Push Notification Tokens:</strong> If you grant
            permission, we store a device push token to deliver game notifications (alliance
            invites, attack alerts, event reminders). You can revoke this permission at any time
            in your device settings.
          </p>
        </Section>

        <Section title="2. How We Use Your Information">
          <p>We use the information we collect to:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Create and manage your game account</li>
            <li>Provide, operate, and improve the Game</li>
            <li>Process in-app purchases and credit virtual items</li>
            <li>Deliver push notifications you have opted into</li>
            <li>Detect and prevent cheating, fraud, and unauthorized access</li>
            <li>Respond to support requests and bug reports</li>
            <li>Analyze aggregated gameplay data to balance game mechanics</li>
            <li>Comply with legal obligations</li>
          </ul>
          <p>
            We do not sell your personal data to third parties for their own marketing purposes.
          </p>
        </Section>

        <Section title="3. Information Sharing">
          <p>We may share your information with:</p>
          <p>
            <strong className="text-white">Service Providers:</strong> Trusted vendors who
            assist us in operating the Game (cloud hosting, analytics, customer support tools).
            They are contractually obligated to use your data only to perform services for us.
          </p>
          <p>
            <strong className="text-white">Platform Partners:</strong> Apple and Google receive
            data necessary to process purchases and deliver push notifications per their own
            privacy policies.
          </p>
          <p>
            <strong className="text-white">Legal Requirements:</strong> We may disclose
            information when required by law, court order, or to protect the rights, property,
            or safety of Kingdoms of War, our players, or the public.
          </p>
          <p>
            <strong className="text-white">Business Transfers:</strong> In the event of a
            merger, acquisition, or sale of assets, your information may be transferred as part
            of that transaction. We will notify you before your data becomes subject to a
            different privacy policy.
          </p>
        </Section>

        <Section title="4. Data Retention">
          <p>
            We retain your account data for as long as your account is active. If you request
            account deletion, we will delete or anonymize your personal data within 30 days,
            except where retention is required by law or legitimate business interests (such as
            fraud records). Aggregated, non-identifiable gameplay statistics may be retained
            indefinitely.
          </p>
        </Section>

        <Section title="5. Children's Privacy (COPPA)">
          <p>
            The Game is intended for users aged 13 and older. We do not knowingly collect
            personal information from children under 13. If you are a parent or guardian and
            believe your child has provided us with personal information, please contact us at{' '}
            <a
              href="mailto:privacy@kingdoms-of-war.com"
              className="text-amber-500 hover:text-amber-400 underline underline-offset-2"
            >
              privacy@kingdoms-of-war.com
            </a>
            . We will promptly delete such information.
          </p>
          <p>
            For users in the European Economic Area, the minimum age is 16 unless local law
            permits a lower age with parental consent.
          </p>
        </Section>

        <Section title="6. Your Rights">
          <p>Depending on your jurisdiction, you may have the right to:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Access the personal data we hold about you</li>
            <li>Correct inaccurate or incomplete data</li>
            <li>Request deletion of your data (&quot;right to be forgotten&quot;)</li>
            <li>Object to or restrict certain processing activities</li>
            <li>Data portability — receive your data in a structured, machine-readable format</li>
            <li>Withdraw consent at any time where processing is based on consent</li>
          </ul>
          <p>
            To exercise any of these rights, please contact us at{' '}
            <a
              href="mailto:privacy@kingdoms-of-war.com"
              className="text-amber-500 hover:text-amber-400 underline underline-offset-2"
            >
              privacy@kingdoms-of-war.com
            </a>
            . We will respond within 30 days.
          </p>
        </Section>

        <Section title="7. Security">
          <p>
            We implement industry-standard technical and organizational measures to protect your
            data, including TLS encryption in transit, encrypted storage at rest, and access
            controls limiting who can view personal data. However, no system is perfectly secure.
            We encourage you to use a strong, unique password for your account.
          </p>
        </Section>

        <Section title="8. Contact Us">
          <p>
            If you have questions or concerns about this Privacy Policy, please reach out:
          </p>
          <address className="not-italic text-stone-300 space-y-1">
            <p className="font-semibold text-white">Kingdoms of War — Privacy Team</p>
            <p>
              Email:{' '}
              <a
                href="mailto:privacy@kingdoms-of-war.com"
                className="text-amber-500 hover:text-amber-400 underline underline-offset-2"
              >
                privacy@kingdoms-of-war.com
              </a>
            </p>
            <p>Address: 123 Strategy Lane, Wilmington, DE 19801, USA</p>
          </address>
        </Section>

        <p className="text-stone-500 text-sm border-t border-stone-800 pt-8 mt-4">
          We may update this Privacy Policy periodically. We will notify you of material changes
          via in-game notification or email. Continued use of the Game after changes take effect
          constitutes your acceptance of the revised policy.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
