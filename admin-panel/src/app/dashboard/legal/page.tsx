'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { StatCard } from '@/components/ui/stat-card';
import { Section } from '@/components/ui/section';
import { Badge } from '@/components/ui/badge';
import { PageSpinner } from '@/components/ui/spinner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PrivacyRequest {
  id: string;
  userId: string;
  type: 'export' | 'delete';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  completedAt: string | null;
}

interface LegalText {
  id: string;
  type: string;
  language: string;
  version: string;
  isActive: boolean;
  publishedAt: string | null;
}

interface PrivacyRequestsResponse {
  data: PrivacyRequest[];
  total: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type StatusVariant = 'yellow' | 'blue' | 'green' | 'red' | 'gray';

function statusVariant(s: PrivacyRequest['status']): StatusVariant {
  if (s === 'pending')    return 'yellow';
  if (s === 'processing') return 'blue';
  if (s === 'completed')  return 'green';
  if (s === 'failed')     return 'red';
  return 'gray';
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LegalOverviewPage() {
  const requests = useQuery<PrivacyRequestsResponse>({
    queryKey: ['legal-privacy-requests-overview'],
    queryFn: () =>
      api.get('/legal/privacy-requests?status=pending&page=1&limit=5').then((r) => r.data).catch(() => ({ data: [], total: 0 })),
    refetchInterval: 60_000,
  });

  const texts = useQuery<LegalText[]>({
    queryKey: ['legal-texts-overview'],
    queryFn: () =>
      api.get('/legal/texts?language=en').then((r) => r.data).catch(() => []),
  });

  const reqData  = requests.data  ?? { data: [], total: 0 };
  const textData = texts.data     ?? [];

  const pendingCount = reqData.total;
  const activeCount  = textData.filter((t) => t.isActive).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Legal &amp; GDPR</h1>
        <span className="text-xs text-gray-500">Auto-refreshes every 60s</span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Pending Requests"
          value={pendingCount}
          sub="awaiting action"
          accent={pendingCount > 0 ? 'red' : 'green'}
        />
        <StatCard
          label="Active Legal Texts"
          value={activeCount}
          sub="published"
          accent="blue"
        />
        <StatCard
          label="Total Legal Texts"
          value={textData.length}
          sub="all versions"
          accent="amber"
        />
        <StatCard
          label="Total Requests"
          value={reqData.total}
          sub="all time"
          accent="amber"
        />
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Pending Requests */}
        <Section
          title="Pending Privacy Requests"
          action={
            <Link
              href="/dashboard/legal/privacy-requests"
              className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
            >
              View all
            </Link>
          }
        >
          {requests.isLoading ? (
            <PageSpinner />
          ) : (
            <div className="overflow-x-auto -mx-5 -mb-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 uppercase border-b border-gray-800">
                    <th className="text-left px-5 py-2">User ID</th>
                    <th className="text-left px-3 py-2">Type</th>
                    <th className="text-left px-3 py-2">Status</th>
                    <th className="text-right px-5 py-2">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {reqData.data.map((r) => (
                    <tr key={r.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                      <td className="px-5 py-2.5 text-gray-300 font-mono text-xs">{r.userId}</td>
                      <td className="px-3 py-2.5">
                        <Badge variant={r.type === 'export' ? 'blue' : 'red'}>{r.type}</Badge>
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                      </td>
                      <td className="px-5 py-2.5 text-right text-gray-500 text-xs">{fmtDate(r.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* Active Legal Texts */}
        <Section
          title="Active Legal Texts"
          action={
            <Link
              href="/dashboard/legal/texts"
              className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
            >
              Manage
            </Link>
          }
        >
          {texts.isLoading ? (
            <PageSpinner />
          ) : (
            <div className="overflow-x-auto -mx-5 -mb-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 uppercase border-b border-gray-800">
                    <th className="text-left px-5 py-2">Type</th>
                    <th className="text-left px-3 py-2">Lang</th>
                    <th className="text-left px-3 py-2">Version</th>
                    <th className="text-right px-5 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {textData.map((t) => (
                    <tr key={t.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                      <td className="px-5 py-2.5 text-gray-200 text-xs font-mono">{t.type}</td>
                      <td className="px-3 py-2.5 text-gray-400 text-xs uppercase">{t.language}</td>
                      <td className="px-3 py-2.5 text-gray-400 text-xs">v{t.version}</td>
                      <td className="px-5 py-2.5 text-right">
                        <Badge variant={t.isActive ? 'green' : 'gray'}>
                          {t.isActive ? 'active' : 'draft'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
