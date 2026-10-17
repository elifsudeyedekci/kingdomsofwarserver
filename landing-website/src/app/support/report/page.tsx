import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';

export const metadata: Metadata = {
  title: 'Report an Issue | Kingdoms of War',
  description: 'Report a bug, cheater, or inappropriate content in Kingdoms of War.',
};

const REPORT_TYPES = [
  { value: 'bug', label: 'Bug / Game Crash' },
  { value: 'cheater', label: 'Cheating / Hacking' },
  { value: 'harassment', label: 'Harassment / Toxic Behavior' },
  { value: 'inappropriate', label: 'Inappropriate Content' },
  { value: 'payment', label: 'Payment / Billing Issue' },
  { value: 'account', label: 'Account / Login Problem' },
  { value: 'other', label: 'Other' },
];

export default function ReportPage() {
  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      <SiteHeader />

      <main className="mx-auto max-w-2xl px-6 py-24">
        <Link href="/support" className="mb-8 inline-flex items-center gap-2 text-sm text-amber-500 hover:text-amber-400">
          ← Back to Support
        </Link>

        <h1 className="mb-4 text-4xl font-bold text-white">Report an Issue</h1>
        <p className="mb-10 text-stone-400">
          Please provide as much detail as possible so our team can investigate quickly.
        </p>

        {/* Static form — actual submission handled by contact email */}
        <form
          action={`mailto:report@kingdoms-of-war.com`}
          method="get"
          className="space-y-6"
        >
          <div>
            <label className="mb-2 block text-sm font-medium text-stone-300" htmlFor="type">
              Issue Type
            </label>
            <select
              id="type"
              name="subject"
              className="w-full rounded-lg border border-stone-700 bg-stone-900 px-4 py-3 text-stone-100 focus:border-amber-500 focus:outline-none"
            >
              {REPORT_TYPES.map((t) => (
                <option key={t.value} value={t.label}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-stone-300" htmlFor="player">
              Your Player ID (optional)
            </label>
            <input
              id="player"
              name="player-id"
              type="text"
              placeholder="e.g. KoW#123456"
              className="w-full rounded-lg border border-stone-700 bg-stone-900 px-4 py-3 text-stone-100 placeholder-stone-600 focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-stone-300" htmlFor="description">
              Description
            </label>
            <textarea
              id="description"
              name="body"
              rows={6}
              placeholder="Describe the issue in detail. For cheater reports include the player name and match ID."
              className="w-full rounded-lg border border-stone-700 bg-stone-900 px-4 py-3 text-stone-100 placeholder-stone-600 focus:border-amber-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-amber-500 px-6 py-3 font-semibold text-stone-950 hover:bg-amber-400 transition-colors"
          >
            Submit Report
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-stone-500">
          For urgent account issues email{' '}
          <Link href="mailto:support@kingdoms-of-war.com" className="text-amber-500 hover:text-amber-400">
            support@kingdoms-of-war.com
          </Link>
        </p>
      </main>

      <SiteFooter />
    </div>
  );
}
