'use client';
import Link from 'next/link';
import { useEffect } from 'react';
import { useFeed } from '@/lib/live-feed';

const COLORS: Record<string, string> = { critical: 'border-red-600 bg-red-950', high: 'border-red-700 bg-red-950/90', medium: 'border-amber-600 bg-amber-950/90', low: 'border-gray-600 bg-gray-900' };

/** Pop-ups for live cheat / security alerts (top right). They stay 12 seconds or until closed. */
export function ToastStack() {
  const { toasts, dismissToast } = useFeed();
  useEffect(() => { const timers = toasts.map((t) => setTimeout(() => dismissToast(t.id), 12_000)); return () => timers.forEach(clearTimeout); }, [toasts, dismissToast]);
  return (
    <div className="fixed right-4 top-4 z-50 flex w-96 flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className={`rounded-lg border p-3 shadow-xl ${COLORS[t.severity ?? 'medium'] ?? COLORS.medium}`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-white">{t.title}</div>
              {t.detail && <div className="mt-0.5 text-xs text-gray-300">{t.detail}</div>}
              {t.href && <Link href={t.href} onClick={() => dismissToast(t.id)} className="mt-1 inline-block text-xs text-amber-400 underline">İncele →</Link>}
            </div>
            <button onClick={() => dismissToast(t.id)} className="text-gray-400 hover:text-white" aria-label="Kapat">✕</button>
          </div>
        </div>
      ))}
    </div>
  );
}
