'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { StatCard } from '@/components/ui/stat-card';
import { Section } from '@/components/ui/section';
import { Badge } from '@/components/ui/badge';

// ─── Types ────────────────────────────────────────────────────────────────────

type FraudRisk      = 'critical' | 'high' | 'medium' | 'low';
type FraudCategory  = 'chargeback' | 'account_sharing' | 'payment_fraud' | 'promo_abuse' | 'smurfing';
type FraudStatus    = 'open' | 'under_review' | 'confirmed' | 'dismissed';

interface FraudCase {
  id: string;
  playerId: string;
  playerName: string;
  category: FraudCategory;
  risk: FraudRisk;
  status: FraudStatus;
  amountUsd: number | null;
  detectedAt: string;
  assignedTo: string | null;
  notes: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function riskVariant(r: FraudRisk): 'red' | 'amber' | 'yellow' | 'gray' {
  if (r === 'critical') return 'red';
  if (r === 'high')     return 'amber';
  if (r === 'medium')   return 'yellow';
  return 'gray';
}

function statusVariant(s: FraudStatus): 'red' | 'blue' | 'green' | 'gray' {
  if (s === 'open')          return 'red';
  if (s === 'under_review')  return 'blue';
  if (s === 'confirmed')     return 'amber' as 'red'; // narrow type — reuse red for confirmed fraud
  if (s === 'dismissed')     return 'gray';
  return 'gray';
}

function statusBadgeVariant(s: FraudStatus): 'red' | 'blue' | 'amber' | 'gray' {
  if (s === 'open')         return 'red';
  if (s === 'under_review') return 'blue';
  if (s === 'confirmed')    return 'amber';
  return 'gray';
}

function categoryLabel(c: FraudCategory) {
  return c.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function fmtAgo(iso: string) {
  const secs = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60)   return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

// Suppress unused warning
void statusVariant;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FraudPage() {
  const [cases, setCases] = useState<FraudCase[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterRisk, setFilterRisk] = useState<string>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const casesQuery = useQuery({
    queryKey: ['fraud-cases'],
    queryFn: () => api.get('/fraud/flagged').then(r => r.data?.data ?? r.data ?? []),
  });

  const displayCases: FraudCase[] = casesQuery.data ?? cases;

  const open       = displayCases.filter((c) => c.status === 'open').length;
  const critical   = displayCases.filter((c) => c.risk === 'critical').length;
  const totalLoss  = displayCases.filter((c) => c.amountUsd && c.status !== 'dismissed').reduce((s, c) => s + (c.amountUsd ?? 0), 0);
  const confirmed  = displayCases.filter((c) => c.status === 'confirmed').length;

  const filtered = displayCases.filter((c) => {
    if (filterStatus !== 'all' && c.status !== filterStatus) return false;
    if (filterRisk   !== 'all' && c.risk   !== filterRisk)   return false;
    return true;
  });

  async function updateStatus(id: string, status: FraudStatus) {
    const decision = status === 'confirmed' ? 'reject' : 'approve';
    await api.post(`/fraud/review/${id}`, { decision });
    setCases((prev) => prev.map((c) => c.id === id ? { ...c, status } : c));
    casesQuery.refetch();
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Fraud Detection</h1>
        <p className="text-xs text-gray-500 mt-0.5">Payment fraud, chargebacks, account abuse</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Open Cases"       value={open}                              sub="awaiting action"    accent="red"   />
        <StatCard label="Critical Risk"    value={critical}                          sub="immediate review"   accent="red"   />
        <StatCard label="Confirmed Fraud"  value={confirmed}                         sub="this month"         accent="amber" />
        <StatCard label="At-Risk Revenue"  value={`$${totalLoss.toFixed(2)}`}        sub="open + confirmed"   accent="amber" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
        >
          <option value="all">All Statuses</option>
          <option value="open">Open</option>
          <option value="under_review">Under Review</option>
          <option value="confirmed">Confirmed</option>
          <option value="dismissed">Dismissed</option>
        </select>

        <select
          value={filterRisk}
          onChange={(e) => setFilterRisk(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
        >
          <option value="all">All Risk Levels</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {/* Cases table */}
      <Section title="Fraud Cases" action={<span className="text-xs text-gray-600">{filtered.length} cases</span>}>
        {casesQuery.isLoading ? (
          <p className="text-gray-500 text-sm py-8 text-center">Loading cases…</p>
        ) : (
          <div className="overflow-x-auto -mx-5 -mb-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 uppercase border-b border-gray-800">
                  <th className="text-left px-5 py-2.5">Case ID</th>
                  <th className="text-left px-3 py-2.5">Player</th>
                  <th className="text-left px-3 py-2.5">Category</th>
                  <th className="text-left px-3 py-2.5">Risk</th>
                  <th className="text-left px-3 py-2.5">Status</th>
                  <th className="text-right px-3 py-2.5 hidden md:table-cell">Amount</th>
                  <th className="text-right px-3 py-2.5 hidden lg:table-cell">Detected</th>
                  <th className="text-right px-5 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center text-gray-500">No cases match current filters.</td>
                  </tr>
                ) : (
                  filtered.map((c) => (
                    <>
                      <tr
                        key={c.id}
                        onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                        className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors cursor-pointer"
                      >
                        <td className="px-5 py-3 font-mono text-xs text-gray-400">{c.id}</td>
                        <td className="px-3 py-3">
                          <p className="text-white font-medium">{c.playerName}</p>
                          <p className="text-gray-600 text-xs font-mono">{c.playerId}</p>
                        </td>
                        <td className="px-3 py-3 text-gray-300 text-xs">{categoryLabel(c.category)}</td>
                        <td className="px-3 py-3"><Badge variant={riskVariant(c.risk)}>{c.risk}</Badge></td>
                        <td className="px-3 py-3"><Badge variant={statusBadgeVariant(c.status)}>{c.status.replace('_', ' ')}</Badge></td>
                        <td className="px-3 py-3 text-right text-gray-300 text-sm font-mono hidden md:table-cell">
                          {c.amountUsd !== null ? `$${c.amountUsd.toFixed(2)}` : '—'}
                        </td>
                        <td className="px-3 py-3 text-right text-gray-500 text-xs hidden lg:table-cell whitespace-nowrap">
                          {fmtAgo(c.detectedAt)}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className="text-xs text-gray-600">{expanded === c.id ? '▲' : '▼'}</span>
                        </td>
                      </tr>
                      {expanded === c.id && (
                        <tr key={`${c.id}-detail`} className="bg-gray-800/20">
                          <td colSpan={8} className="px-8 py-4">
                            <div className="flex items-start gap-6">
                              <div className="flex-1">
                                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Notes</p>
                                <p className="text-gray-300 text-sm">{c.notes}</p>
                                {c.assignedTo && (
                                  <p className="text-xs text-gray-600 mt-2">Assigned to: {c.assignedTo}</p>
                                )}
                              </div>
                              {c.status === 'open' || c.status === 'under_review' ? (
                                <div className="flex gap-2 shrink-0">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); updateStatus(c.id, 'under_review'); }}
                                    disabled={c.status === 'under_review'}
                                    className="text-xs px-3 py-1.5 rounded-lg bg-blue-900/30 border border-blue-800/50 text-blue-400 hover:bg-blue-900/50 disabled:opacity-40 transition-colors"
                                  >
                                    Review
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); updateStatus(c.id, 'confirmed'); }}
                                    className="text-xs px-3 py-1.5 rounded-lg bg-red-900/30 border border-red-800/50 text-red-400 hover:bg-red-900/50 transition-colors"
                                  >
                                    Confirm Fraud
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); updateStatus(c.id, 'dismissed'); }}
                                    className="text-xs px-3 py-1.5 rounded-lg bg-gray-700 border border-gray-600 text-gray-300 hover:bg-gray-600 transition-colors"
                                  >
                                    Dismiss
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
