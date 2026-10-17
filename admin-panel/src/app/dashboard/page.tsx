'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { get } from '@/lib/api';
import { canRead } from '@/lib/permissions';
import { useFeed } from '@/lib/live-feed';
import { fmtAgo, fmtNumber, fmtUsd } from '@/lib/format';
import { Card, PageHeader, Pill, sevTone, Stat } from '@/components/kit/kit';

interface Summary {
  players: { total: number; guests: number; registered: number; newLast24h: number; newLast7d: number };
  activity: { onlineNow: number; inMatchNow: number; dau: number; wau: number; mau: number; stickiness: number };
  playtime: { totalHours: number; avgHoursPerPlayer: number };
  matches: { last24h: number; runningNow: number };
  revenue: { last30dUsd: number; purchases30d: number };
  moderation: { activeBans: number };
  platforms: { platform: string; players: number }[];
  versions: { version: string; players: number }[];
  civPicks30d: { civ: string; picks: number }[];
}

const SHORTCUTS = [
  { href: '/dashboard/live-control', label: 'Bakım / güncelleme kapısı', hint: 'Oyunu bakıma al, güncellemeyi zorunlu kıl' },
  { href: '/dashboard/game-data', label: 'Denge & veri yaması', hint: 'Birim canı, maliyet, ekonomi... uygulama güncellemesi olmadan' },
  { href: '/dashboard/grants', label: 'Hediye / kaynak / paket ver', hint: 'Tek oyuncuya ya da kitleye' },
  { href: '/dashboard/cheat-center', label: 'Hile Merkezi', hint: 'Canlı hile uyarıları ve kararlar' },
  { href: '/dashboard/online', label: 'Çevrimiçi oyuncular', hint: 'Anlık atma, mesaj, duyuru' },
  { href: '/dashboard/announcements', label: 'Duyuru yayınla', hint: 'Haber, açılış penceresi, şerit' },
];

export default function DashboardHome() {
  const { data: session } = useSession();
  const role = (session as { role?: string } | null)?.role;
  const sum = useQuery({ queryKey: ['summary'], queryFn: () => get<Summary>('/insights/summary'), refetchInterval: 15_000 });
  const cheat = useQuery({ queryKey: ['cheat-stats'], queryFn: () => get<{ openFlags: number; last24h: number }>('/cheatwatch/stats'), enabled: canRead(role, 'cheat'), retry: false, refetchInterval: 30_000 });
  const items = useFeed((s) => s.items);
  const s = sum.data;

  return (
    <div className="space-y-6">
      <PageHeader title="Ana Sayfa" subtitle="Oyunun anlık durumu. Sayılar 15 saniyede bir yenilenir; olaylar canlı akıştan gelir." actions={<Link href="/dashboard/guide" className="rounded-lg border border-amber-600 px-4 py-2 text-sm text-amber-400 hover:bg-amber-600/10">Rehber: neler yapabilirim? →</Link>} />
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Stat label="Çevrimiçi" value={s ? fmtNumber(s.activity.onlineNow) : '…'} sub={s ? `${s.activity.inMatchNow} maçta` : ''} tone="green" />
        <Stat label="Günlük aktif (DAU)" value={s ? fmtNumber(s.activity.dau) : '…'} sub={s ? `haftalık ${fmtNumber(s.activity.wau)} · aylık ${fmtNumber(s.activity.mau)}` : ''} tone="blue" />
        <Stat label="Toplam oyuncu" value={s ? fmtNumber(s.players.total) : '…'} sub={s ? `+${s.players.newLast24h} bugün · +${s.players.newLast7d} bu hafta` : ''} />
        <Stat label="Toplam oynama" value={s ? `${fmtNumber(Math.round(s.playtime.totalHours))} sa` : '…'} sub={s ? `kişi başı ${s.playtime.avgHoursPerPlayer} sa` : ''} tone="gray" />
        <Stat label="Gelir (30 gün)" value={s ? fmtUsd(s.revenue.last30dUsd) : '…'} sub={s ? `${s.revenue.purchases30d} satın alma` : ''} tone="green" />
        <Stat label="Açık hile bulgusu" value={cheat.data ? cheat.data.openFlags : '—'} sub={cheat.data ? `son 24 saatte ${cheat.data.last24h}` : s ? `${s.moderation.activeBans} aktif yasak` : ''} tone={cheat.data?.openFlags ? 'red' : 'gray'} />
      </div>

      <Card title="Kısayollar"><div className="grid gap-3 md:grid-cols-3">{SHORTCUTS.map((x) => <Link key={x.href} href={x.href} className="rounded-lg border border-gray-800 p-4 hover:border-amber-600 hover:bg-gray-800/50"><div className="font-medium text-white">{x.label}</div><div className="mt-1 text-xs text-gray-500">{x.hint}</div></Link>)}</div></Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Canlı olaylar" className="lg:col-span-1">
          {items.length === 0 ? <div className="text-sm text-gray-500">Henüz olay yok. Oyuncular bağlandıkça burada akar.</div> : (
            <ul className="max-h-96 space-y-2 overflow-auto">{items.slice(0, 40).map((i) => <li key={i.id} className="flex items-start justify-between gap-2 text-sm"><div>{i.href ? <Link href={i.href} className="text-gray-200 hover:text-amber-400">{i.title}</Link> : <span className="text-gray-200">{i.title}</span>}{i.detail && <div className="text-xs text-gray-500">{i.detail}</div>}</div><div className="shrink-0 text-right">{i.severity && <Pill tone={sevTone(i.severity)}>{i.severity}</Pill>}<div className="text-[10px] text-gray-600">{fmtAgo(new Date(i.at))}</div></div></li>)}</ul>
          )}
        </Card>
        <Card title="Medeniyet tercihleri (30 gün)" className="lg:col-span-1">
          <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={s?.civPicks30d ?? []} layout="vertical" margin={{ left: 20 }}><CartesianGrid stroke="#1f2937" /><XAxis type="number" stroke="#6b7280" /><YAxis type="category" dataKey="civ" stroke="#6b7280" width={90} tick={{ fontSize: 11 }} /><Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151' }} /><Bar dataKey="picks" fill="#f59e0b" /></BarChart></ResponsiveContainer></div>
        </Card>
        <Card title="Platform & sürüm dağılımı" className="lg:col-span-1">
          <div className="space-y-4">
            <div>{(s?.platforms ?? []).map((p) => <div key={p.platform} className="flex justify-between text-sm"><span className="text-gray-300">{p.platform}</span><span className="text-gray-400">{fmtNumber(p.players)}</span></div>)}</div>
            <div className="border-t border-gray-800 pt-3"><div className="mb-1 text-xs uppercase text-gray-500">Sürümler</div>{(s?.versions ?? []).slice(0, 8).map((v) => <div key={v.version} className="flex justify-between text-sm"><span className="text-gray-300">{v.version}</span><span className="text-gray-400">{fmtNumber(v.players)}</span></div>)}</div>
          </div>
        </Card>
      </div>
    </div>
  );
}
