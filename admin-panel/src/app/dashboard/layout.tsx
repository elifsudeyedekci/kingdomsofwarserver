import { Sidebar } from '@/components/layout/sidebar';
import { RealtimeIndicator } from '@/components/realtime/realtime-indicator';
import { LiveFeedConnector } from '@/lib/live-feed';
import { ToastStack } from '@/components/ui/toast-stack';
import { FlashHost } from '@/components/kit/kit';
import { LimitedGuard } from '@/components/layout/limited-guard';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="flex items-center justify-between border-b border-gray-800 bg-gray-900/60 px-8 py-3">
          <RealtimeIndicator />
        </header>
        <main className="flex-1 p-8 overflow-auto">{children}</main>
      </div>
      <LimitedGuard />
      <LiveFeedConnector />
      <ToastStack />
      <FlashHost />
    </div>
  );
}
