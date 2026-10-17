'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { get } from '@/lib/api';
import { fmtNumber, fmtUsd } from '@/lib/format';
import { Card, PageHeader, Select, Stat, Table, TextInput } from '@/components/kit/kit';

interface Economy {
  days: number; wallets: number; circulation: Record<string, number | null>;
  flows: { currency: string; source: string; amount: number; entries: number }[];
  topHolders: { userId: string; username: string | null; coins: number; gems: number }[];
  purchases: { count: number; usd: number }; adminGrants: number;
}
const CUR: Record<string, string> = { coins: 'Altın', gems: 'Mücevher', chestKeys: 'Sandık anahtarı', eventTokens: 'Etkinlik jetonu', bpXp: 'Battle Pass XP' };
const SRC: Record<string, string> = { admin_grant: 'Yönetici verdi', gift: 'Hediye', purchase: 'Satın alma', match: 'Maç', event: 'Etkinlik', refund: 'İade', revoke: 'Geri alma' };

export default function EconomyPage() {
  const [days, setDays] = useState('30'); const [q, setQ] = useState('');
  const eco = useQuery({ queryKey: ['economy', days], queryFn: () => get<Economy>('/grants/economy', { days }), refetchInterval: 60_000 });
  const found = useQuery({ queryKey: ['eco-find', q], queryFn: () => get<{ players: { userId: string; username: string }[] }>('/insights/players', { q, limit: 5 }), enabled: q.trim().length >= 2 });
  const d = eco.data;
  const byCur = new Map<string, { in: number; out: number }>();
  for (const f of d?.flows ?? []) { const e = byCur.get(f.currency) ?? { in: 0, out: 0 }; if (f.amount >= 0) e.in += f.amount; else e.out += -f.amount; byCur.set(f.currency, e); }

  return (
    <div className="space-y-6">
      <PageHeader title="Ekonomi" subtitle="Oyundaki para birimlerinin dolaşımı: ne kadarı var, dönem içinde ne kadarı hangi yoldan girdi ya da çıktı. Her hareket bakiye defterinden gelir (kim, ne zaman, neden)." actions={<Select value={days} onChange={setDays} options={[{ value: '7', label: 'son 7 gün' }, { value: '30', label: 'son 30 gün' }, { value: '90', label: 'son 90 gün' }]} />} />
      <div className="grid gap-3 md:grid-cols-5">
        <Stat label="Cüzdanı olan oyuncu" value={d ? fmtNumber(d.wallets) : '…'} tone="gray" />
        <Stat label="Dolaşımdaki altın" value={d ? fmtNumber(d.circulation.coins) : '…'} />
        <Stat label="Dolaşımdaki mücevher" value={d ? fmtNumber(d.circulation.gems) : '…'} tone="blue" />
        <Stat label="Satın alma geliri" value={d ? fmtUsd(d.purchases.usd) : '…'} sub={d ? `${d.purchases.count} işlem` : ''} tone="green" />
        <Stat label="Yönetici verme işlemi" value={d ? d.adminGrants : '…'} tone="amber" />
      </div>
      <Card title="Para birimi akışı (giren / çıkan)">
        <Table rows={[...byCur.entries()]} empty="Dönemde hareket yok" cols={[{ label: 'Birim', render: ([c]) => CUR[c] ?? c }, { label: 'Giren', render: ([, v]) => <span className="text-green-400">+{fmtNumber(v.in)}</span> }, { label: 'Çıkan', render: ([, v]) => <span className="text-red-400">−{fmtNumber(v.out)}</span> }, { label: 'Net', render: ([, v]) => fmtNumber(v.in - v.out) }]} />
      </Card>
      <Card title="Kaynağa göre hareketler"><Table rows={d?.flows ?? []} empty="Dönemde hareket yok" cols={[{ label: 'Birim', render: (f) => CUR[f.currency] ?? f.currency }, { label: 'Kaynak', render: (f) => SRC[f.source] ?? f.source }, { label: 'Toplam', render: (f) => <span className={f.amount >= 0 ? 'text-green-400' : 'text-red-400'}>{f.amount > 0 ? '+' : ''}{fmtNumber(f.amount)}</span> }, { label: 'Kayıt', render: (f) => f.entries }]} /></Card>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="En çok mücevheri olanlar"><Table rows={d?.topHolders ?? []} empty="—" cols={[{ label: 'Oyuncu', render: (h) => <Link className="text-amber-400 hover:underline" href={`/dashboard/players/${h.userId}`}>{h.username ?? h.userId.slice(0, 8)}</Link> }, { label: 'Mücevher', render: (h) => fmtNumber(h.gems) }, { label: 'Altın', render: (h) => fmtNumber(h.coins) }]} /></Card>
        <Card title="Oyuncunun cüzdanına git"><TextInput placeholder="kullanıcı adı ara…" value={q} onChange={(e) => setQ(e.target.value)} /><ul className="mt-3 space-y-1 text-sm">{(found.data?.players ?? []).map((p) => <li key={p.userId}><Link className="text-amber-400 hover:underline" href={`/dashboard/players/${p.userId}`}>{p.username}</Link></li>)}</ul><p className="mt-3 text-xs text-gray-500">Cüzdan, envanter ve defter oyuncu dosyasının "Ekonomi & Verme" sekmesindedir; para vermek/almak da oradan yapılır.</p></Card>
      </div>
    </div>
  );
}
