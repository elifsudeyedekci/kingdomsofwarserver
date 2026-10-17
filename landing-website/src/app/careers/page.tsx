import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';

export const metadata: Metadata = {
  title: 'Careers | Kingdoms of War',
  description: 'Join the Kingdoms of War team. View open positions and help us build the next great mobile RTS.',
};

const OPEN_ROLES = [
  {
    title: 'Senior Unity Engineer',
    team: 'Engineering',
    location: 'Remote',
    type: 'Full-time',
    description: 'Own gameplay systems — combat, pathfinding, and simulation performance on mobile.',
  },
  {
    title: 'Game Designer',
    team: 'Design',
    location: 'Remote',
    type: 'Full-time',
    description: 'Design and balance civilization abilities, tech trees, and competitive matchmaking.',
  },
  {
    title: 'Backend Engineer (NestJS)',
    team: 'Engineering',
    location: 'Remote',
    type: 'Full-time',
    description: 'Scale our live services infrastructure for millions of concurrent players.',
  },
  {
    title: 'Community Manager',
    team: 'Community',
    location: 'Remote',
    type: 'Full-time',
    description: 'Build and nurture our player community across Discord, Reddit, and social media.',
  },
];

export default function CareersPage() {
  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      <SiteHeader />

      <main className="mx-auto max-w-3xl px-6 py-24">
        <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-amber-500 hover:text-amber-400">
          ← Back to Home
        </Link>

        <h1 className="mb-4 text-4xl font-bold text-white">Careers</h1>
        <p className="mb-12 text-stone-400">
          Help us build the future of mobile strategy gaming. We're a remote-first team that values
          craft, autonomy, and impact.
        </p>

        <section className="mb-12">
          <h2 className="mb-6 text-2xl font-semibold text-amber-500">Open Positions</h2>
          <div className="space-y-4">
            {OPEN_ROLES.map((role) => (
              <div
                key={role.title}
                className="rounded-lg border border-stone-800 bg-stone-900 p-6 hover:border-amber-500/40 transition-colors"
              >
                <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                  <h3 className="text-lg font-semibold text-white">{role.title}</h3>
                  <div className="flex gap-2">
                    <span className="rounded bg-stone-800 px-2 py-0.5 text-xs text-stone-400">{role.team}</span>
                    <span className="rounded bg-stone-800 px-2 py-0.5 text-xs text-stone-400">{role.location}</span>
                    <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-400">{role.type}</span>
                  </div>
                </div>
                <p className="text-sm text-stone-400">{role.description}</p>
                <Link
                  href={`mailto:careers@kingdoms-of-war.com?subject=${encodeURIComponent(role.title)}`}
                  className="mt-4 inline-block text-sm text-amber-500 hover:text-amber-400"
                >
                  Apply →
                </Link>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold text-amber-500">Don't see your role?</h2>
          <p className="text-stone-300">
            We're always looking for exceptional people. Send your CV to{' '}
            <Link href="mailto:careers@kingdoms-of-war.com" className="text-amber-500 hover:text-amber-400 underline">
              careers@kingdoms-of-war.com
            </Link>
            .
          </p>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
