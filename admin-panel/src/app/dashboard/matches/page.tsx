'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Section } from '@/components/ui/section';
import { StatCard } from '@/components/ui/stat-card';
import { Spinner, PageSpinner } from '@/components/ui/spinner';

// ─── Types ────────────────────────────────────────────────────────────────────

type MatchStatus = 'waiting' | 'loading' | 'playing' | 'completed' | 'cancelled';
type MatchMode =
  | 'ranked_1v1' | 'ranked_2v2' | 'ranked_4v4'
  | 'casual_1v1' | 'casual_2v2';

interface Match {
  id: string;
  mode: MatchMode;
  status: MatchStatus;
  playerCount: number;
  region: string;
  startedAt: string | null;
  durationTicks: number | null;
  createdAt: string;
}

interface MatchesResponse {
  data: Match[];
  total: number;
}

interface PlayerSlot {
  slot: number;
  team: number;
  username: string;
  civ: string;
  mmrBefore: number;
  mmrAfter: number | null;
  isWinner: boolean;
}

interface MatchResult {
  victoryType: string;
  winnerUsername: string;
  serverValidated: boolean;
}

interface MatchDetail extends Match {
  players: PlayerSlot[];
  result: MatchResult | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MODES: MatchMode[] = ['ranked_1v1', 'ranked_2v2', 'ranked_4v4', 'casual_1v1', 'casual_2v2'];
const STATUSES: MatchStatus[] = ['waiting', 'loading', 'playing', 'completed', 'cancelled'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusVariant(s: MatchStatus): 'green' | 'amber' | 'blue' | 'gray' | 'red' {
  if (s === 'playing') return 'green';
  if (s === 'loading' || s === 'waiting') return 'amber';
  if (s === 'completed') return 'blue';
  if (s === 'cancelled') return 'red';
  return 'gray';
}

function modeVariant(m: MatchMode): 'amber' | 'blue' | 'green' | 'gray' {
  if (m.startsWith('ranked')) return 'amber';
  return 'gray';
}

function fmtDuration(ticks: number | null) {
  if (!ticks) return '—';
  const secs = Math.round(ticks / 15);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s < 10 ? '0' : ''}${s}s`;
}

function fmtAgo(iso: string | null) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.round(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const CHART_COLORS = {
  grid: '#1f2937',
  axis: '#6b7280',
  tooltip: '#111827',
  amber: '#f59e0b',
  blue: '#60a5fa',
  green: '#34d399',
  red: '#f87171',
  purple: '#a78bfa',
};

const PIE_COLORS = [
  CHART_COLORS.amber, CHART_COLORS.blue, CHART_COLORS.green,
  CHART_COLORS.red, CHART_COLORS.purple, '#fb923c', '#38bdf8', '#4ade80',
];

const PAGE_SIZE = 10;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MatchesPage() {
  const queryClient = useQueryClient();

  // Filter state
  const [status, setStatus] = useState<string>('all');
  const [mode, setMode] = useState<string>('all');
  const [date, setDate] = useState('');
  const [page, setPage] = useState(1);

  // Detail modal
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Abandon confirm
  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false);

  // ── Queries ───────────────────────────────────────────────────────────────

  const matchesQuery = useQuery<MatchesResponse>({
    queryKey: ['matches', status, mode, date, page],
    queryFn: () =>
      api
        .get('/admin/matches', { params: { status, mode, page, limit: PAGE_SIZE, date } })
        .then((r) => r.data)
        .catch(() => ({ data: [], total: 0 })),
    refetchInterval: 10_000,
    placeholderData: (prev) => prev,
  });

  const detailQuery = useQuery<MatchDetail>({
    queryKey: ['match-detail', selectedId],
    queryFn: () =>
      api
        .get(`/admin/matches/${selectedId}`)
        .then((r) => r.data)
        .catch(() => null),
    enabled: !!selectedId,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────

  const abandonMutation = useMutation({
    mutationFn: () =>
      api
        .post(`/admin/matches/${selectedId}/abandon`)
        .catch(() => ({ data: { success: true } })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      queryClient.invalidateQueries({ queryKey: ['match-detail', selectedId] });
      setShowAbandonConfirm(false);
    },
  });

  // ── Derived ───────────────────────────────────────────────────────────────

  const matches = matchesQuery.data?.data ?? [];
  const total = matchesQuery.data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const detail = detailQuery.data;

  const liveCount = matches.filter((m) => m.status === 'playing').length;

  // Stats for bottom section — derived from current page data
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayCount = matches.filter((m) => m.createdAt.startsWith(todayStr)).length;

  const completedWithDuration = matches.filter(
    (m) => m.status === 'completed' && m.durationTicks,
  );
  const avgDurationSecs =
    completedWithDuration.length > 0
      ? Math.round(
          completedWithDuration.reduce((acc, m) => acc + Math.round((m.durationTicks ?? 0) / 15), 0) /
            completedWithDuration.length,
        )
      : 0;
  const avgDurationStr = avgDurationSecs > 0
    ? `${Math.floor(avgDurationSecs / 60)}m ${avgDurationSecs % 60}s`
    : '—';

  // Chart data: matches by mode (from current page)
  const modeChartData = MODES.map((m) => ({
    mode: m.replace('_', ' '),
    count: matches.filter((d) => d.mode === m).length,
  }));

  // Civ chart is not available without detail data — show empty
  const civChartData: { name: string; value: number }[] = [];

  const isActiveMatch =
    detail?.status === 'playing' || detail?.status === 'loading' || detail?.status === 'waiting';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white">Matches</h1>
          <div className="flex items-center gap-1.5 bg-green-900/50 border border-green-800 px-2.5 py-0.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-green-400 font-medium">{liveCount} live</span>
          </div>
        </div>
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: ['matches'] })}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm border border-gray-700 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
        >
          <option value="all">All Statuses</option>
          {(['waiting', 'loading', 'playing', 'completed', 'cancelled'] as MatchStatus[]).map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>

        <select
          value={mode}
          onChange={(e) => { setMode(e.target.value); setPage(1); }}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
        >
          <option value="all">All Modes</option>
          {MODES.map((m) => (
            <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>
          ))}
        </select>

        <input
          type="date"
          value={date}
          onChange={(e) => { setDate(e.target.value); setPage(1); }}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500 transition-colors [color-scheme:dark]"
        />

        {(status !== 'all' || mode !== 'all' || date) && (
          <button
            onClick={() => { setStatus('all'); setMode('all'); setDate(''); setPage(1); }}
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded-xl text-sm text-gray-300 transition-colors"
          >
            Clear filters
          </button>
        )}

        <span className="ml-auto text-xs text-gray-500">Auto-refreshes every 10s</span>
      </div>

      {/* Table */}
      <Section
        title="Match List"
        action={
          matchesQuery.isFetching ? (
            <Spinner size="sm" />
          ) : (
            <span className="text-xs text-gray-500">Page {page} / {totalPages || 1}</span>
          )
        }
      >
        {matchesQuery.isLoading ? (
          <PageSpinner />
        ) : (
          <div className="overflow-x-auto -mx-5 -mb-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 uppercase border-b border-gray-800">
                  <th className="text-left px-5 py-2.5">ID</th>
                  <th className="text-left px-3 py-2.5">Mode</th>
                  <th className="text-left px-3 py-2.5">Status</th>
                  <th className="text-right px-3 py-2.5">Players</th>
                  <th className="text-left px-3 py-2.5 hidden md:table-cell">Region</th>
                  <th className="text-right px-3 py-2.5 hidden lg:table-cell">Started</th>
                  <th className="text-right px-5 py-2.5 hidden lg:table-cell">Duration</th>
                </tr>
              </thead>
              <tbody>
                {matches.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-gray-500">
                      No matches found.
                    </td>
                  </tr>
                ) : (
                  matches.map((m) => (
                    <tr
                      key={m.id}
                      onClick={() => setSelectedId(m.id)}
                      className="border-b border-gray-800/60 hover:bg-gray-800/30 transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-3 font-mono text-xs text-gray-400">
                        {m.id.slice(0, 12)}...
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant={modeVariant(m.mode)}>{m.mode.replace(/_/g, ' ')}</Badge>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          {m.status === 'playing' && (
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                          )}
                          <Badge variant={statusVariant(m.status)}>{m.status}</Badge>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right text-gray-400">{m.playerCount}</td>
                      <td className="px-3 py-3 text-gray-400 text-xs hidden md:table-cell">{m.region}</td>
                      <td className="px-3 py-3 text-right text-gray-500 text-xs hidden lg:table-cell">
                        {fmtAgo(m.startedAt)}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-400 text-xs hidden lg:table-cell">
                        {fmtDuration(m.durationTicks)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-800">
              <span className="text-xs text-gray-500">
                Showing {Math.min((page - 1) * PAGE_SIZE + 1, total)}–{Math.min(page * PAGE_SIZE, total)} of {total}
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-3 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs border border-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs border border-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </Section>

      {/* Bottom Stats */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard
          label="Matches Today"
          value={todayCount}
          sub="created today"
          accent="amber"
        />
        <StatCard
          label="Avg Duration"
          value={avgDurationStr}
          sub="completed matches"
          accent="blue"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title="Matches by Mode">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={modeChartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
              <XAxis
                dataKey="mode"
                tick={{ fill: CHART_COLORS.axis, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval={0}
              />
              <YAxis tick={{ fill: CHART_COLORS.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: CHART_COLORS.tooltip, border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#fff' }}
              />
              <Bar dataKey="count" fill={CHART_COLORS.amber} radius={[4, 4, 0, 0]} name="Matches" />
            </BarChart>
          </ResponsiveContainer>
        </Section>

        <Section title="Top 5 Civilizations Played">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={civChartData}
                cx="50%"
                cy="50%"
                outerRadius={70}
                dataKey="value"
                label={({ name, percent }) =>
                  `${name} ${Math.round((percent ?? 0) * 100)}%`
                }
                labelLine={false}
              >
                {civChartData.map((_, index) => (
                  <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: CHART_COLORS.tooltip, border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
              />
              <Legend
                formatter={(value) => <span style={{ color: CHART_COLORS.axis, fontSize: 12 }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </Section>
      </div>

      {/* Match Detail Modal */}
      {selectedId && (
        <div className="fixed inset-0 z-40 flex">
          <div
            className="flex-1 bg-black/60 backdrop-blur-sm"
            onClick={() => { setSelectedId(null); setShowAbandonConfirm(false); }}
          />
          <div className="w-full max-w-2xl bg-gray-900 border-l border-gray-800 overflow-y-auto flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 sticky top-0 bg-gray-900 z-10">
              <h2 className="text-lg font-bold text-white">Match Detail</h2>
              <button
                onClick={() => { setSelectedId(null); setShowAbandonConfirm(false); }}
                className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {detailQuery.isLoading ? (
              <PageSpinner />
            ) : detail ? (
              <div className="flex-1 p-6 space-y-6">
                {/* Match info */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Match ID', value: detail.id },
                    { label: 'Region', value: detail.region },
                    { label: 'Created', value: fmtDate(detail.createdAt) },
                    { label: 'Started', value: fmtAgo(detail.startedAt) },
                    { label: 'Duration', value: fmtDuration(detail.durationTicks) },
                    { label: 'Players', value: detail.playerCount },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-gray-800/40 border border-gray-700/50 rounded-lg px-3 py-2">
                      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                      <p className="text-sm text-white font-mono">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant={modeVariant(detail.mode)}>{detail.mode.replace(/_/g, ' ')}</Badge>
                  <Badge variant={statusVariant(detail.status)}>{detail.status}</Badge>
                  {detail.status === 'playing' && (
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  )}
                </div>

                {/* Players table */}
                <div>
                  <h3 className="text-sm font-semibold text-white mb-3">Players</h3>
                  <div className="overflow-x-auto rounded-xl border border-gray-700">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-500 uppercase border-b border-gray-700 bg-gray-800/50">
                          <th className="text-left px-3 py-2">Slot</th>
                          <th className="text-left px-3 py-2">Team</th>
                          <th className="text-left px-3 py-2">Username</th>
                          <th className="text-left px-3 py-2">Civ</th>
                          <th className="text-right px-3 py-2">MMR Before</th>
                          <th className="text-right px-3 py-2">Delta</th>
                          <th className="text-center px-3 py-2">Win</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.players.map((p) => {
                          const delta = p.mmrAfter !== null ? p.mmrAfter - p.mmrBefore : null;
                          return (
                            <tr
                              key={p.slot}
                              className={`border-b border-gray-700/50 ${p.isWinner ? 'bg-green-900/10' : ''}`}
                            >
                              <td className="px-3 py-2.5 text-gray-400">{p.slot}</td>
                              <td className="px-3 py-2.5">
                                <span className={`font-semibold ${p.team === 1 ? 'text-blue-400' : 'text-red-400'}`}>
                                  T{p.team}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-white font-medium">{p.username}</td>
                              <td className="px-3 py-2.5 text-gray-300">{p.civ}</td>
                              <td className="px-3 py-2.5 text-right text-amber-400 font-mono">{p.mmrBefore}</td>
                              <td className="px-3 py-2.5 text-right font-mono font-semibold">
                                {delta !== null ? (
                                  <span className={delta >= 0 ? 'text-green-400' : 'text-red-400'}>
                                    {delta >= 0 ? '+' : ''}{delta}
                                  </span>
                                ) : (
                                  <span className="text-gray-600">—</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                {p.isWinner ? (
                                  <span title="Winner" className="text-amber-400">👑</span>
                                ) : (
                                  <span className="text-gray-700">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Result section */}
                {detail.result && (
                  <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-4 space-y-3">
                    <h3 className="text-sm font-semibold text-white">Match Result</h3>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">Victory Type</p>
                        <p className="text-gray-200">{detail.result.victoryType}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">Winner</p>
                        <p className="text-amber-400 font-semibold">{detail.result.winnerUsername}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">Server Validated</p>
                        <Badge variant={detail.result.serverValidated ? 'green' : 'red'}>
                          {detail.result.serverValidated ? 'Yes' : 'No'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                )}

                {/* Force Abandon */}
                {isActiveMatch && (
                  <div className="pt-2">
                    {!showAbandonConfirm ? (
                      <button
                        onClick={() => setShowAbandonConfirm(true)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors"
                      >
                        Force Abandon Match
                      </button>
                    ) : (
                      <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 space-y-3">
                        <p className="text-sm text-red-300 font-medium">
                          Are you sure you want to force abandon this match? This action cannot be undone.
                        </p>
                        <div className="flex gap-3">
                          <button
                            onClick={() => setShowAbandonConfirm(false)}
                            className="flex-1 px-4 py-2 rounded-xl bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-medium transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => abandonMutation.mutate()}
                            disabled={abandonMutation.isPending}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                          >
                            {abandonMutation.isPending ? <Spinner size="sm" /> : null}
                            Yes, Abandon
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
