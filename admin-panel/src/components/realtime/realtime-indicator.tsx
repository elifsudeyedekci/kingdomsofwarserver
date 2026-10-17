'use client';
import Link from 'next/link';
import { useFeed } from '@/lib/live-feed';

/** Header strip: live-feed connection, last event, unread cheat / security alerts. */
export function RealtimeIndicator() {
  const { connected, items, unseenAlerts } = useFeed();
  const last = items[0];
  return (
    <div className="flex items-center gap-4 text-sm">
      <span className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
        <span className="text-gray-400">{connected ? 'Canlı akış açık' : 'Bağlanıyor…'}</span>
      </span>
      {last && <span className="hidden md:inline text-gray-500 truncate max-w-md">Son: {last.title}</span>}
      {unseenAlerts > 0 && <Link href="/dashboard/cheat-center" className="rounded bg-red-900/60 px-2 py-0.5 text-red-300 hover:bg-red-800">{unseenAlerts} yeni uyarı</Link>}
    </div>
  );
}
