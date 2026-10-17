import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';

export const metadata: Metadata = {
  title: 'About | Kingdoms of War',
  description: 'Learn about the team behind Kingdoms of War, the epic mobile RTS strategy game.',
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      <SiteHeader />

      <main className="mx-auto max-w-3xl px-6 py-24">
        <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-amber-500 hover:text-amber-400">
          ← Back to Home
        </Link>

        <h1 className="mb-4 text-4xl font-bold text-white">About Us</h1>
        <p className="mb-12 text-stone-400">Building the next generation of mobile strategy games.</p>

        <section className="mb-12">
          <h2 className="mb-4 text-2xl font-semibold text-amber-500">Our Mission</h2>
          <p className="leading-relaxed text-stone-300">
            We believe strategy games should be accessible to everyone. Kingdoms of War brings the depth
            of classic real-time strategy titles like Age of Empires to mobile devices — without
            compromising on the complexity and satisfaction that genre fans love.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="mb-4 text-2xl font-semibold text-amber-500">The Game</h2>
          <p className="mb-4 leading-relaxed text-stone-300">
            Kingdoms of War is an online multiplayer RTS featuring 10 historical civilizations,
            a deterministic lockstep simulation engine, and deep strategic gameplay built for
            both casual and competitive players.
          </p>
          <ul className="ml-6 list-disc space-y-2 text-stone-300">
            <li>10 unique civilizations with distinct units and bonuses</li>
            <li>Real-time multiplayer with up to 8 players</li>
            <li>Clan wars, tournaments, and seasonal events</li>
            <li>60 FPS on mid-range iOS and Android devices</li>
          </ul>
        </section>

        <section className="mb-12">
          <h2 className="mb-4 text-2xl font-semibold text-amber-500">Contact</h2>
          <p className="text-stone-300">
            Interested in partnerships, press inquiries, or just want to say hello?{' '}
            <Link href="/contact" className="text-amber-500 hover:text-amber-400 underline">
              Get in touch
            </Link>
            .
          </p>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
