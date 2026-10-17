'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { get } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { Btn, Card, PageHeader, Table, TextInput, useDebounced } from '@/components/kit/kit';

interface Ev { id: string; eventName: string; userId: string | null; platform: string | null; properties: unknown; createdAt: string }
interface Resp { data: Ev[]; meta: { total: number; page: number; limit: number; totalPages: number } }

export default function AnalyticsEventsPage() {
  const [q, setQ] = useState(''); const dq = useDebounced(q); const [page, setPage] = useState(1);
  const r = useQuery({ queryKey: ['an-events', dq, page], queryFn: () => get<Resp>('/analytics/events', { page, limit: 50, eventName: dq || undefined }), refetchInterval: 30_000 });
  return (
    <div className="space-y-5">
      <PageHeader title="Analitik · Ham Olaylar" subtitle="Oyundan gelen olay kayıtları (oturum başlangıcı, maç sonu, satın alma...). Bir olayın ayrıntısını görmek için satırın özelliklerine bakın." actions={<Link href="/dashboard/analytics" className="text-sm text-amber-400 hover:underline">← Analitik</Link>} />
      <Card><TextInput placeholder="olay adı filtrele (örn. match_end)" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="w-80" /></Card>
      <Table<Ev> rows={r.data?.data ?? []} empty={r.isLoading ? 'Yükleniyor…' : 'Olay yok'} cols={[
        { label: 'Zaman', render: (e) => fmtDate(e.createdAt) }, { label: 'Olay', render: (e) => <span className="font-medium text-white">{e.eventName}</span> },
        { label: 'Oyuncu', render: (e) => (e.userId ? <Link className="text-amber-400 hover:underline" href={`/dashboard/players/${e.userId}`}>{e.userId.slice(0, 8)}…</Link> : '—') },
        { label: 'Platform', render: (e) => e.platform ?? '—' }, { label: 'Özellikler', render: (e) => <span className="break-all text-xs text-gray-500">{JSON.stringify(e.properties ?? {}).slice(0, 140)}</span> },
      ]} />
      <div className="flex items-center justify-between text-sm text-gray-400"><Btn size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Önceki</Btn><span>Sayfa {page} / {r.data?.meta.totalPages ?? 1} · {r.data?.meta.total ?? 0} olay</span><Btn size="sm" variant="ghost" disabled={page >= (r.data?.meta.totalPages ?? 1)} onClick={() => setPage(page + 1)}>Sonraki →</Btn></div>
    </div>
  );
}
