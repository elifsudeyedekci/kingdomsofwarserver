'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RootError({ error, reset }: ErrorProps) {
  const router = useRouter();

  useEffect(() => {
    // Production: replace with Sentry.captureException(error)
    console.error('[RootError]', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">

        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-8 h-8 text-red-400"
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
        </div>

        {/* Heading */}
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold text-white">Something went wrong</h1>
          <p className="text-sm text-gray-400">An unexpected error occurred. You can try again or return to the dashboard.</p>
        </div>

        {/* Error message */}
        {error.message && (
          <div className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1 font-medium">Error</p>
            <p className="font-mono text-sm text-red-300 break-words">{error.message}</p>
          </div>
        )}

        {/* Digest */}
        {error.digest && (
          <div className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1 font-medium">Support Reference</p>
            <p className="font-mono text-xs text-gray-400 break-all">{error.digest}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={reset}
            className="flex-1 bg-amber-500 hover:bg-amber-400 text-gray-950 font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-gray-950"
          >
            Try again
          </button>
          <button
            onClick={() => router.push('/dashboard')}
            className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-200 font-medium text-sm px-4 py-2.5 rounded-lg border border-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-950"
          >
            Go to Dashboard
          </button>
        </div>

      </div>
    </div>
  );
}
