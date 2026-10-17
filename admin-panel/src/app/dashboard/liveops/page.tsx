'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { get } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { Card, PageHeader, Pill } from '@/components/kit/kit';

interface Season { id: string; number: number; name: string; startAt: string; endAt: string }
interface Ev { id: string; titleKey: string; type: string; startAt: string; endAt: string; isActive: boolean }

export default function LiveOpsOverview() {
  const season = useQuery({ queryKey: ['active-season'], queryFn: () => get<Season | ''>('/liveops/season/active') });
  const events = useQuery({ queryKey: ['events-active'], queryFn: () => get<Ev[]>('/liveops/events/active') });
  const s = season.data ? (season.data as Season) : null;
  return (
    <div className="space-y-6">
      <PageHeader title="Canlı Etkinlikler" subtitle="Sezon, etkinlik ve Battle Pass yönetimi: oyuncuları oyunda tutan zamanlı içerik." />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Aktif sezon" right={<Link href="/dashboard/liveops/seasons" className="text-sm text-amber-400 hover:underline">yönet →</Link>}>{s ? <div><div className="text-lg font-semibold text-white">{s.name} <Pill tone="green">#{s.number}</Pill></div><div className="text-sm text-gray-400">{fmtDate(s.startAt)} → {fmtDate(s.endAt)}</div></div> : <div className="text-sm text-gray-500">Aktif sezon yok.</div>}</Card>
        <Card title="Şu an çalışan etkinlikler" right={<Link href="/dashboard/liveops/events" className="text-sm text-amber-400 hover:underline">yönet →</Link>}>{events.data?.length ? <ul className="space-y-2 text-sm">{events.data.map((e) => <li key={e.id} className="flex justify-between"><span className="text-white">{e.titleKey} <span className="text-gray-500">({e.type})</span></span><span className="text-xs text-gray-500">→ {fmtDate(e.endAt)}</span></li>)}</ul> : <div className="text-sm text-gray-500">Çalışan etkinlik yok.</div>}</Card>
      </div>
      <Card title="Battle Pass" right={<Link href="/dashboard/liveops/battle-pass" className="text-sm text-amber-400 hover:underline">ayrıntı →</Link>}><p className="text-sm text-gray-400">Aktif sezonun Battle Pass katılımı, premium oranı ve en ilerideki oyuncular.</p></Card>
    </div>
  );
}
