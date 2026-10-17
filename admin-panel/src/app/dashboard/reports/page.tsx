'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { get } from '@/lib/api';
import { fmtNumber, fmtUsd } from '@/lib/format';
import { Card, PageHeader, Select, Stat } from '@/components/kit/kit';

interface Overview { totalPlayers: number; newPlayers: number; totalMatches: number; revenue: number; period: string }
interface Revenue { totalRevenue: number; totalTransactions: number; groups: { key?: string; date?: string; revenue?: number; total?: number }[] }
const tip = { contentStyle: { background: '#111827', border: '1px solid #374151' } };

export default function ReportsPage() {
  const [period, setPeriod] = useState('30d');
  const ov = useQuery({ queryKey: ['rp-ov', period], queryFn: () => get<Overview>('/reports/overview', { period }) });
  const growth = useQuery({ queryKey: ['rp-growth', period], queryFn: () => get<{ date: string; registrations: number }[]>('/reports/growth', { period }) });
  const md = useQuery({ queryKey: ['rp-md'], queryFn: () => get<{ date: string; matches: number }[]>('/reports/matches-by-day', { period: '14d' }) });
  const rev = useQuery({ queryKey: ['rp-rev', period], queryFn: () => get<Revenue>('/reports/revenue', { period }) });
  const ret = useQuery({ queryKey: ['rp-ret'], queryFn: () => get<{ d1: number; d7: number; d30: number; cohortSize: number }>('/reports/retention') });
  const played = useQuery({ queryKey: ['rp-played'], queryFn: () => get<{ civId: string; count?: number; played?: number }[]>('/reports/civ-played') });
  const o = ov.data;
  return (
    <div className="space-y-6">
      <PageHeader title="Raporlar" subtitle="Dönem raporları: büyüme, maç sayısı, gelir ve oyuncu elde tutma (retention). Hepsi veritabanındaki gerçek kayıtlardan hesaplanır." actions={<Select value={period} onChange={setPeriod} options={[{ value: '7d', label: 'son 7 gün' }, { value: '30d', label: 'son 30 gün' }, { value: '90d', label: 'son 90 gün' }]} />} />
      <div className="grid gap-3 md:grid-cols-4"><Stat label="Toplam oyuncu" value={o ? fmtNumber(o.totalPlayers) : '…'} /><Stat label="Yeni oyuncu" value={o ? fmtNumber(o.newPlayers) : '…'} tone="green" /><Stat label="Maç" value={o ? fmtNumber(o.totalMatches) : '…'} tone="blue" /><Stat label="Gelir" value={o ? fmtUsd(o.revenue) : '…'} tone="green" /></div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Yeni kayıtlar"><div className="h-60"><ResponsiveContainer width="100%" height="100%"><LineChart data={growth.data ?? []}><CartesianGrid stroke="#1f2937" /><XAxis dataKey="date" stroke="#6b7280" tick={{ fontSize: 10 }} /><YAxis stroke="#6b7280" allowDecimals={false} /><Tooltip {...tip} /><Line dataKey="registrations" stroke="#34d399" dot={false} /></LineChart></ResponsiveContainer></div></Card>
        <Card title="Günlük maç sayısı (14 gün)"><div className="h-60"><ResponsiveContainer width="100%" height="100%"><BarChart data={md.data ?? []}><CartesianGrid stroke="#1f2937" /><XAxis dataKey="date" stroke="#6b7280" tick={{ fontSize: 10 }} /><YAxis stroke="#6b7280" allowDecimals={false} /><Tooltip {...tip} /><Bar dataKey="matches" fill="#60a5fa" /></BarChart></ResponsiveContainer></div></Card>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Elde tutma (retention)">{ret.data ? <div className="grid grid-cols-3 gap-3"><Stat label="1. gün" value={`%${Math.round(ret.data.d1 * 100)}`} tone="green" /><Stat label="7. gün" value={`%${Math.round(ret.data.d7 * 100)}`} tone="amber" /><Stat label="30. gün" value={`%${Math.round(ret.data.d30 * 100)}`} tone="blue" /></div> : '…'}<div className="mt-2 text-xs text-gray-500">Kohort büyüklüğü: {ret.data?.cohortSize ?? 0} oyuncu</div></Card>
        <Card title="Gelir"><div className="text-2xl font-bold text-green-400">{rev.data ? fmtUsd(rev.data.totalRevenue) : '…'}</div><div className="text-sm text-gray-500">{rev.data?.totalTransactions ?? 0} işlem</div></Card>
      </div>
      <Card title="En çok oynanan medeniyetler"><ul className="grid gap-1 text-sm text-gray-300 md:grid-cols-2">{(played.data ?? []).map((c) => <li key={c.civId} className="flex justify-between"><span>{c.civId}</span><span className="text-gray-500">{c.count ?? c.played}</span></li>)}{!played.data?.length && <li className="text-gray-500">Henüz maç verisi yok.</li>}</ul></Card>
    </div>
  );
}
