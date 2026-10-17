'use client';

import { useEffect } from 'react';
import Link from 'next/link';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function MatchesError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Production: replace with Sentry.captureException(error)
    console.error('[MatchesError]', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 space-y-6">

      {/* Icon */}
      <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-7 h-7 text-red-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </div>

      {/* Heading */}
      <div className="text-center space-y-1 max-w-sm">
        <h2 className="text-lg font-bold text-white">Failed to load match data</h2>
        <p className="text-sm text-gray-400">
          The match list could not be retrieved. Check your connection or try again.
        </p>
      </div>

      {/* Error message */}
      {error.message && (
        <div className="w-full max-w-sm rounded-lg border border-gray-800 bg-gray-900 px-4 py-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1 font-medium">Error</p>
          <p className="font-mono text-sm text-red-300 break-words">{error.message}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="bg-amber-500 hover:bg-amber-400 text-gray-950 font-semibold text-sm px-5 py-2.5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-gray-950"
        >
          Retry
        </button>

        <Link
          href="/dashboard"
          className="bg-gray-800 hover:bg-gray-700 text-gray-200 font-medium text-sm px-5 py-2.5 rounded-lg border border-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-950"
        >
          Back to Dashboard
        </Link>
      </div>

    </div>
  );
}
