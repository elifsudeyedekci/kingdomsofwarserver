'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { get } from '@/lib/api';
import { fmtNumber, fmtUsd } from '@/lib/format';
import { Card, PageHeader, Stat } from '@/components/kit/kit';

interface Summary { totalPlayers: number; activePlayers: number; totalMatches: number; revenue: number; date: string; dau: number; newRegistrations: number; totalEvents: number; activeSessions: number }
interface MatchStats { completedMatches: number; avgDurationTicks: number; topMaps: { mapId: string; count: number }[]; civWinRates: { civId: string; winRate: number; games: number }[] }
const tip = { contentStyle: { background: '#111827', border: '1px solid #374151' } };

export default function AnalyticsPage() {
  const sum = useQuery({ queryKey: ['an-summary'], queryFn: () => get<Summary>('/analytics/summary'), refetchInterval: 60_000 });
  const dau = useQuery({ queryKey: ['an-dau'], queryFn: () => get<{ date: string; dau: number }[]>('/analytics/dau-trend') });
  const civ = useQuery({ queryKey: ['an-civ'], queryFn: () => get<{ civId: string; count: number; pickRate: number }[]>('/analytics/civ-picks') });
  const ms = useQuery({ queryKey: ['an-ms'], queryFn: () => get<MatchStats>('/analytics/match-stats') });
  const s = sum.data;
  return (
    <div className="space-y-6">
      <PageHeader title="Analitik" subtitle="Oyundan gelen olaylardan hesaplanan gerçek veriler. Oyun, her oturum ve maçta sunucuya olay gönderir; hiç oyuncu yoksa grafikler boş kalır." actions={<Link href="/dashboard/analytics/events" className="text-sm text-amber-400 hover:underline">Ham olay akışı →</Link>} />
      <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-6">
        <Stat label="Günlük aktif (DAU)" value={s ? fmtNumber(s.dau) : '…'} tone="blue" /><Stat label="Toplam oyuncu" value={s ? fmtNumber(s.totalPlayers) : '…'} /><Stat label="Aktif oyuncu" value={s ? fmtNumber(s.activePlayers) : '…'} tone="green" />
        <Stat label="Toplam maç" value={s ? fmtNumber(s.totalMatches) : '…'} tone="gray" /><Stat label="Bugün yeni kayıt" value={s ? fmtNumber(s.newRegistrations) : '…'} /><Stat label="Gelir" value={s ? fmtUsd(s.revenue) : '…'} tone="green" />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Günlük aktif oyuncu (30 gün)"><div className="h-64"><ResponsiveContainer width="100%" height="100%"><LineChart data={dau.data ?? []}><CartesianGrid stroke="#1f2937" /><XAxis dataKey="date" stroke="#6b7280" tick={{ fontSize: 10 }} /><YAxis stroke="#6b7280" allowDecimals={false} /><Tooltip {...tip} /><Line dataKey="dau" stroke="#60a5fa" dot={false} /></LineChart></ResponsiveContainer></div></Card>
        <Card title="Medeniyet seçimleri"><div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={civ.data ?? []}><CartesianGrid stroke="#1f2937" /><XAxis dataKey="civId" stroke="#6b7280" tick={{ fontSize: 10 }} /><YAxis stroke="#6b7280" allowDecimals={false} /><Tooltip {...tip} /><Bar dataKey="count" fill="#f59e0b" /></BarChart></ResponsiveContainer></div></Card>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Maç istatistikleri"><dl className="grid grid-cols-2 gap-y-2 text-sm"><dt className="text-gray-500">Tamamlanan maç</dt><dd className="text-gray-200">{ms.data ? fmtNumber(ms.data.completedMatches) : '…'}</dd><dt className="text-gray-500">Ortalama süre</dt><dd className="text-gray-200">{ms.data ? `${Math.round(ms.data.avgDurationTicks / 15 / 60)} dk` : '…'}</dd></dl><div className="mt-4 text-xs uppercase text-gray-500">En çok oynanan haritalar</div><ul className="mt-1 text-sm text-gray-300">{(ms.data?.topMaps ?? []).map((m) => <li key={m.mapId} className="flex justify-between"><span>{m.mapId}</span><span className="text-gray-500">{m.count}</span></li>)}</ul></Card>
        <Card title="Medeniyet galibiyet oranları"><ul className="text-sm text-gray-300">{(ms.data?.civWinRates ?? []).map((c) => <li key={c.civId} className="flex justify-between"><span>{c.civId}</span><span className="text-gray-500">%{Math.round(c.winRate * 100)} · {c.games} maç</span></li>)}{!ms.data?.civWinRates?.length && <li className="text-gray-500">Henüz yeterli maç yok.</li>}</ul></Card>
      </div>
    </div>
  );
}
