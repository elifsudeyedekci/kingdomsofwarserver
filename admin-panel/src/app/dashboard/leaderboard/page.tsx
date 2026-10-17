'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { get } from '@/lib/api';
import { fmtNumber } from '@/lib/format';
import { Btn, PageHeader, Pill, Select, Table } from '@/components/kit/kit';

interface P { userId: string; username: string; mmr: number; rank: string; wins: number; losses: number; totalMatches: number; level: number; hours: number; online: boolean; banned: unknown }
interface Resp { total: number; players: P[]; limit: number }

export default function LeaderboardPage() {
  const [page, setPage] = useState(1); const [min, setMin] = useState('1');
  const r = useQuery({ queryKey: ['ladder-admin', page], queryFn: () => get<Resp>('/insights/players', { sort: 'mmr', dir: 'desc', page, limit: 50 }) });
  const rows = (r.data?.players ?? []).filter((p) => p.totalMatches >= Number(min));
  const pages = r.data ? Math.max(1, Math.ceil(r.data.total / r.data.limit)) : 1;
  return (
    <div className="space-y-5">
      <PageHeader title="Liderlik Tablosu" subtitle="Dereceli sıralama: oyuncuların gerçek MMR değerlerine göre (oyundaki sıralama ekranıyla aynı veri). Şüpheli bir yükseliş görürseniz oyuncu dosyasından ve Hile Merkezi'nden inceleyin."
        actions={<><span className="text-sm text-gray-400">En az maç:</span><Select value={min} onChange={setMin} options={[{ value: '0', label: '0' }, { value: '1', label: '1' }, { value: '10', label: '10' }, { value: '30', label: '30' }]} /></>} />
      <Table<P> rows={rows} empty={r.isLoading ? 'Yükleniyor…' : 'Sıralanacak oyuncu yok'} cols={[
        { label: '#', render: (p) => <span className="text-gray-500">{(page - 1) * 50 + rows.indexOf(p) + 1}</span> },
        { label: 'Oyuncu', render: (p) => <Link className="font-medium text-amber-400 hover:underline" href={`/dashboard/players/${p.userId}`}>{p.username}</Link> },
        { label: 'MMR', render: (p) => <span className="font-semibold text-white">{fmtNumber(p.mmr)}</span> }, { label: 'Derece', render: (p) => <Pill tone="amber">{p.rank}</Pill> },
        { label: 'Maç', render: (p) => `${p.totalMatches} (${p.wins}G/${p.losses}M)` }, { label: 'Seviye', render: (p) => p.level }, { label: 'Süre', render: (p) => `${p.hours} sa` },
        { label: '', render: (p) => <>{p.online && <Pill tone="green">çevrimiçi</Pill>} {p.banned ? <Pill tone="red">yasaklı</Pill> : null}</> },
      ]} />
      <div className="flex items-center justify-between text-sm text-gray-400"><Btn size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Önceki</Btn><span>Sayfa {page} / {pages}</span><Btn size="sm" variant="ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>Sonraki →</Btn></div>
    </div>
  );
}
