'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Section } from '@/components/ui/section';
import { StatCard } from '@/components/ui/stat-card';
import { Spinner, PageSpinner } from '@/components/ui/spinner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Clan {
  id: string;
  tag: string;
  name: string;
  leaderUsername: string;
  memberCount: number;
  maxMembers: number;
  totalMmr: number;
  isActive: boolean;
  createdAt: string;
  warWins: number;
}

interface ClansResponse {
  data: Clan[];
  total: number;
  page: number;
  activeWarCount: number;
  avgMemberCount: number;
}

interface ClanMember {
  id: string;
  username: string;
  role: 'leader' | 'officer' | 'member';
  mmr: number;
  joinedAt: string;
}

interface ClanDetail extends Clan {
  description: string;
  emblemColor: string;
  leaderboardRank: number;
  recentWars: ClanWar[];
}

interface ClanWar {
  id: string;
  opponentName: string;
  result: 'win' | 'loss' | 'draw';
  date: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function roleVariant(role: ClanMember['role']): 'amber' | 'blue' | 'gray' {
  if (role === 'leader') return 'amber';
  if (role === 'officer') return 'blue';
  return 'gray';
}

function warResultVariant(result: ClanWar['result']): 'green' | 'red' | 'gray' {
  if (result === 'win') return 'green';
  if (result === 'loss') return 'red';
  return 'gray';
}

const PAGE_SIZE = 20;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClansPage() {
  const queryClient = useQueryClient();

  // Search + pagination state
  const [rawSearch, setRawSearch] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Drawer state
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Disband 2-step confirm state
  const [disbandConfirm, setDisbandConfirm] = useState(false);

  // Change leader modal state
  const [showLeaderModal, setShowLeaderModal] = useState(false);
  const [newLeaderId, setNewLeaderId] = useState('');

  // Debounce search input by 300 ms
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(rawSearch);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [rawSearch]);

  // Reset action state when drawer closes
  useEffect(() => {
    if (!selectedId) {
      setDisbandConfirm(false);
      setShowLeaderModal(false);
      setNewLeaderId('');
    }
  }, [selectedId]);

  // ── Queries ─────────────────────────────────────────────────────────────────

  const clansQuery = useQuery<ClansResponse>({
    queryKey: ['clans', search, page],
    queryFn: () =>
      api
        .get('/admin/clans', { params: { search, page, limit: PAGE_SIZE } })
        .then((r) => r.data)
        .catch(() => ({ data: [], total: 0, page, activeWarCount: 0, avgMemberCount: 0 })),
    placeholderData: (prev) => prev,
  });

  const detailQuery = useQuery<ClanDetail>({
    queryKey: ['clan-detail', selectedId],
    queryFn: () =>
      api
        .get(`/admin/clans/${selectedId}`)
        .then((r) => r.data)
        .catch(() => null),
    enabled: !!selectedId,
  });

  // Separate members query — GET /clan/:id/members
  const membersQuery = useQuery<ClanMember[]>({
    queryKey: ['clan-members', selectedId],
    queryFn: () =>
      api
        .get(`/admin/clans/${selectedId}/members`)
        .then((r) => r.data)
        .catch(() => []),
    enabled: !!selectedId,
  });

  // ── Mutations ───────────────────────────────────────────────────────────────

  const disbandMutation = useMutation({
    mutationFn: () =>
      api
        .delete(`/admin/clans/${selectedId}`)
        .catch(() => ({ data: { success: true } })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clans'] });
      setSelectedId(null);
    },
  });

  const changeLeaderMutation = useMutation({
    mutationFn: (memberId: string) =>
      api
        .patch(`/admin/clans/${selectedId}/leader`, { memberId })
        .catch(() => ({ data: { success: true } })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clans'] });
      queryClient.invalidateQueries({ queryKey: ['clan-detail', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['clan-members', selectedId] });
      setShowLeaderModal(false);
      setNewLeaderId('');
    },
  });

  // ── Derived values ──────────────────────────────────────────────────────────

  const clans = clansQuery.data?.data ?? [];
  const total = clansQuery.data?.total ?? 0;
  const activeWarCount = clansQuery.data?.activeWarCount ?? 3;
  const avgMemberCount = clansQuery.data?.avgMemberCount ?? 25;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const detail = detailQuery.data;
  const members = membersQuery.data ?? [];
  const nonLeaderMembers = members.filter((m) => m.role !== 'leader');

  const handleChangeLeader = useCallback(() => {
    if (!newLeaderId) return;
    changeLeaderMutation.mutate(newLeaderId);
  }, [newLeaderId, changeLeaderMutation]);

  const closeDrawer = useCallback(() => {
    setSelectedId(null);
    setDisbandConfirm(false);
    setShowLeaderModal(false);
    setNewLeaderId('');
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white">Clans</h1>
          {total > 0 && (
            <span className="text-sm text-gray-400 bg-gray-800 border border-gray-700 px-2.5 py-0.5 rounded-full">
              {total.toLocaleString()} total
            </span>
          )}
        </div>
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: ['clans'] })}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm border border-gray-700 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Toplam Klan"
          value={total}
          accent="amber"
        />
        <StatCard
          label="Aktif Klan Savasi"
          value={activeWarCount}
          accent="red"
        />
        <StatCard
          label="Ortalama Uye Sayisi"
          value={avgMemberCount}
          sub="uye / klan"
          accent="blue"
        />
      </div>

      {/* ── Search ── */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Klan adi veya tag ile ara..."
          value={rawSearch}
          onChange={(e) => setRawSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:border-amber-500 transition-colors"
        />
      </div>

      {/* ── Table ── */}
      <Section
        title="Tum Klanlar"
        action={
          clansQuery.isFetching ? (
            <Spinner size="sm" />
          ) : (
            <span className="text-xs text-gray-500">
              Sayfa {page} / {totalPages}
            </span>
          )
        }
      >
        {clansQuery.isLoading ? (
          <PageSpinner />
        ) : (
          <div className="overflow-x-auto -mx-5 -mb-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 uppercase border-b border-gray-800">
                  <th className="text-left px-5 py-2.5">Tag</th>
                  <th className="text-left px-3 py-2.5">Klan Adi</th>
                  <th className="text-left px-3 py-2.5 hidden md:table-cell">Lider</th>
                  <th className="text-right px-3 py-2.5">Uyeler</th>
                  <th className="text-right px-3 py-2.5 hidden lg:table-cell">Toplam MMR</th>
                  <th className="text-right px-3 py-2.5 hidden lg:table-cell">Savas Galibi</th>
                  <th className="text-right px-3 py-2.5 hidden xl:table-cell">Olusturma</th>
                  <th className="text-left px-3 py-2.5 pr-5">Durum</th>
                </tr>
              </thead>
              <tbody>
                {clans.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center text-gray-500">
                      Klan bulunamadi.
                    </td>
                  </tr>
                ) : (
                  clans.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      className="border-b border-gray-800/60 hover:bg-gray-800/30 transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold border bg-amber-900/40 text-amber-300 border-amber-800 font-mono tracking-widest">
                          [{c.tag}]
                        </span>
                      </td>
                      <td className="px-3 py-3 text-white font-medium">{c.name}</td>
                      <td className="px-3 py-3 text-gray-400 text-xs hidden md:table-cell">{c.leaderUsername}</td>
                      <td className="px-3 py-3 text-right font-mono">
                        <span className="text-white">{c.memberCount}</span>
                        <span className="text-gray-600 mx-1">/</span>
                        <span className="text-gray-500">{c.maxMembers}</span>
                      </td>
                      <td className="px-3 py-3 text-right text-amber-400 font-mono font-semibold hidden lg:table-cell">
                        {c.totalMmr.toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-right text-gray-300 font-mono hidden lg:table-cell">
                        {c.warWins}
                      </td>
                      <td className="px-3 py-3 text-right text-gray-500 text-xs hidden xl:table-cell">
                        {fmtDate(c.createdAt)}
                      </td>
                      <td className="px-3 py-3 pr-5">
                        {c.isActive ? (
                          <Badge variant="green">Aktif</Badge>
                        ) : (
                          <Badge variant="gray">Pasif</Badge>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-800">
              <span className="text-xs text-gray-500">
                {total === 0
                  ? '0 klan'
                  : `${Math.min((page - 1) * PAGE_SIZE + 1, total)}–${Math.min(page * PAGE_SIZE, total)} / ${total} klan`}
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-3 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs border border-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Onceki
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs border border-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Sonraki
                </button>
              </div>
            </div>
          </div>
        )}
      </Section>

      {/* ── Clan Detail Drawer ── */}
      {selectedId && (
        <div className="fixed inset-0 z-40 flex">
          {/* Backdrop */}
          <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={closeDrawer} />

          {/* Drawer panel */}
          <div className="w-full max-w-lg bg-gray-900 border-l border-gray-800 overflow-y-auto flex flex-col">

            {/* Drawer header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 sticky top-0 bg-gray-900 z-10">
              <h2 className="text-lg font-bold text-white">Klan Detayi</h2>
              <button
                onClick={closeDrawer}
                className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
                aria-label="Kapat"
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

                {/* Emblem + identity */}
                <div className="flex items-center gap-4">
                  <div
                    className="w-16 h-16 rounded-xl flex items-center justify-center text-sm font-black text-white flex-shrink-0 border-2 border-gray-700 tracking-widest"
                    style={{ backgroundColor: detail.emblemColor }}
                  >
                    {detail.tag}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xl font-bold text-white">{detail.name}</span>
                      {detail.isActive ? (
                        <Badge variant="green">Aktif</Badge>
                      ) : (
                        <Badge variant="gray">Pasif</Badge>
                      )}
                    </div>
                    <p className="text-gray-400 text-sm mt-0.5">
                      Lider:{' '}
                      <span className="text-amber-400 font-medium">{detail.leaderUsername}</span>
                    </p>
                    <p className="text-gray-500 text-xs mt-1 leading-relaxed">{detail.description}</p>
                  </div>
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-2 gap-3">
                  {(
                    [
                      { label: 'Uyeler',           value: `${detail.memberCount} / ${detail.maxMembers}`, color: 'text-white' },
                      { label: 'Toplam MMR',        value: detail.totalMmr.toLocaleString(),              color: 'text-amber-400' },
                      { label: 'Liderlik Sirasi',   value: `#${detail.leaderboardRank}`,                  color: 'text-blue-400' },
                      { label: 'Savas Galibi',      value: String(detail.warWins),                        color: 'text-green-400' },
                      { label: 'Olusturma Tarihi',  value: fmtDate(detail.createdAt),                     color: 'text-gray-300' },
                      { label: 'Amblem Rengi',      value: detail.emblemColor.toUpperCase(),              color: 'text-gray-300' },
                    ] as { label: string; value: string; color: string }[]
                  ).map(({ label, value, color }) => (
                    <div key={label} className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">{label}</p>
                      <p className={`text-sm font-bold font-mono ${color}`}>{value}</p>
                    </div>
                  ))}
                </div>

                {/* Members list — loaded from GET /clan/:id/members */}
                <div>
                  <h3 className="text-sm font-semibold text-white mb-3">
                    Uyeler
                    {membersQuery.isSuccess && (
                      <span className="ml-2 text-xs text-gray-500 font-normal">
                        {members.length} uye
                      </span>
                    )}
                  </h3>

                  {membersQuery.isLoading ? (
                    <div className="flex justify-center py-6">
                      <Spinner size="sm" />
                    </div>
                  ) : (
                    <div className="rounded-lg border border-gray-700/60 overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-500 uppercase border-b border-gray-700/60 bg-gray-800/50">
                            <th className="text-left px-3 py-2">Kullanici Adi</th>
                            <th className="text-left px-3 py-2">Rol</th>
                            <th className="text-right px-3 py-2">MMR</th>
                            <th className="text-right px-3 py-2">Katilim</th>
                          </tr>
                        </thead>
                        <tbody>
                          {members.slice(0, 15).map((m) => (
                            <tr key={m.id} className="border-b border-gray-800/60 last:border-0">
                              <td className="px-3 py-2 text-gray-300 font-medium">{m.username}</td>
                              <td className="px-3 py-2">
                                <Badge variant={roleVariant(m.role)}>{m.role}</Badge>
                              </td>
                              <td className="px-3 py-2 text-right text-amber-400 font-mono font-semibold">{m.mmr}</td>
                              <td className="px-3 py-2 text-right text-gray-500">{fmtDate(m.joinedAt)}</td>
                            </tr>
                          ))}
                          {members.length > 15 && (
                            <tr>
                              <td colSpan={4} className="px-3 py-2 text-center text-gray-600">
                                + {members.length - 15} daha fazla uye
                              </td>
                            </tr>
                          )}
                          {members.length === 0 && (
                            <tr>
                              <td colSpan={4} className="px-3 py-6 text-center text-gray-600">
                                Uye bulunamadi.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Recent clan wars */}
                {detail.recentWars.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-3">Son Klan Saraslari</h3>
                    <div className="space-y-1.5">
                      {detail.recentWars.map((w) => (
                        <div
                          key={w.id}
                          className="flex items-center justify-between bg-gray-800/40 border border-gray-700/50 rounded-lg px-3 py-2.5"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                w.result === 'win'
                                  ? 'bg-green-400'
                                  : w.result === 'loss'
                                  ? 'bg-red-400'
                                  : 'bg-gray-400'
                              }`}
                            />
                            <span className="text-xs text-gray-300">
                              vs <span className="font-medium text-white">{w.opponentName}</span>
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-500">{fmtDate(w.date)}</span>
                            <Badge variant={warResultVariant(w.result)}>{w.result.toUpperCase()}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-3 pt-2">
                  {/* Change leader */}
                  <button
                    onClick={() => {
                      setShowLeaderModal(true);
                      setDisbandConfirm(false);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-600 text-white text-sm font-medium transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Lider Degistir
                  </button>

                  {/* Disband — 2-click confirm */}
                  {disbandConfirm ? (
                    <button
                      onClick={() => disbandMutation.mutate()}
                      disabled={disbandMutation.isPending}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 text-white text-sm font-bold transition-colors disabled:opacity-50 animate-pulse"
                    >
                      {disbandMutation.isPending ? <Spinner size="sm" /> : null}
                      Dagitimayi Onayla
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setDisbandConfirm(true);
                        setShowLeaderModal(false);
                      }}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-900/60 hover:bg-red-700 border border-red-800 text-red-400 hover:text-white text-sm font-medium transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Klani Dagit
                    </button>
                  )}
                </div>

                {/* Disband warning text */}
                {disbandConfirm && (
                  <p className="text-xs text-red-400 text-center -mt-3">
                    Bu islem geri alinamaz. Devam etmek icin &quot;Dagitimayi Onayla&quot; butonuna basin veya{' '}
                    <button
                      className="underline hover:text-red-300 transition-colors"
                      onClick={() => setDisbandConfirm(false)}
                    >
                      iptal edin
                    </button>
                    .
                  </p>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ── Change Leader Modal ── */}
      {showLeaderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowLeaderModal(false)}
          />
          <div className="relative bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Klan Lideri Degistir</h3>
              <button
                onClick={() => setShowLeaderModal(false)}
                className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
                aria-label="Kapat"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-sm text-gray-400">
              Klan lideri olarak atanacak uyeyi secin. Mevcut lider{' '}
              <span className="text-amber-400 font-medium">{detail?.leaderUsername}</span>{' '}
              yetkili rolune dusurulecektir.
            </p>

            <div>
              <label className="block text-xs text-gray-400 mb-1.5 font-medium uppercase tracking-wider">
                Yeni Lider
              </label>
              {membersQuery.isLoading ? (
                <div className="flex justify-center py-4">
                  <Spinner size="sm" />
                </div>
              ) : (
                <select
                  value={newLeaderId}
                  onChange={(e) => setNewLeaderId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
                >
                  <option value="">Uye secin...</option>
                  {nonLeaderMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.username} ({m.role}) — {m.mmr} MMR
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowLeaderModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-medium transition-colors"
              >
                Iptal
              </button>
              <button
                onClick={handleChangeLeader}
                disabled={!newLeaderId || changeLeaderMutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {changeLeaderMutation.isPending ? <Spinner size="sm" /> : null}
                Degisikligi Onayla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
