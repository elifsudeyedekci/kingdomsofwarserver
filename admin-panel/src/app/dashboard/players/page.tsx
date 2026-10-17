'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { get } from '@/lib/api';
import { fmtAgo, fmtNumber, fmtUsd } from '@/lib/format';
import { Btn, Card, PageHeader, Pill, Select, Table, TextInput, useDebounced } from '@/components/kit/kit';

interface P {
  userId: string; username: string; displayName: string | null; email: string | null; isGuest: boolean; country: string | null; level: number; mmr: number; rank: string;
  totalMatches: number; wins: number; losses: number; playSeconds: number; hours: number; sessions: number; lastSeenAt: string | null; platform: string | null; appVersion: string | null;
  registeredAt: string; online: boolean; banned: { type: string; endsAt: string | null } | null; spentUsd: number;
}
interface Resp { total: number; page: number; limit: number; players: P[] }

const SORTS = [
  { value: 'lastSeen', label: 'Son görülme' }, { value: 'playtime', label: 'Oynama süresi' }, { value: 'matches', label: 'Maç sayısı' }, { value: 'mmr', label: 'MMR' },
  { value: 'level', label: 'Seviye' }, { value: 'wins', label: 'Galibiyet' }, { value: 'created', label: 'Kayıt tarihi' },
];
const YN = [{ value: '', label: 'hepsi' }, { value: 'true', label: 'evet' }, { value: 'false', label: 'hayır' }];

export default function PlayersPage() {
  const [q, setQ] = useState(''); const dq = useDebounced(q);
  const [sort, setSort] = useState('lastSeen'); const [dir, setDir] = useState('desc');
  const [platform, setPlatform] = useState(''); const [online, setOnline] = useState(''); const [banned, setBanned] = useState(''); const [payer, setPayer] = useState(''); const [guest, setGuest] = useState('');
  const [minHours, setMinHours] = useState(''); const [page, setPage] = useState(1);
  const params = { q: dq || undefined, sort, dir, page, limit: 25, platform: platform || undefined, online: online || undefined, banned: banned || undefined, payer: payer || undefined, guest: guest || undefined, minHours: minHours || undefined };
  const { data, isLoading } = useQuery({ queryKey: ['players', params], queryFn: () => get<Resp>('/insights/players', params), placeholderData: (p) => p });
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="space-y-5">
      <PageHeader title="Tüm Oyuncular" subtitle="Her oyuncunun oynama süresi, maç sayısı, derecesi, harcaması ve durumu. Bir satıra tıklayarak oyuncunun tam dosyasını açın: oturumlar, maçlar, envanter, cüzdan, cihazlar, aynı cihazı paylaşan hesaplar ve tüm moderasyon geçmişi — oradan kaynak/asker/paket verebilir, uyarı gönderebilir, atabilir veya yasaklayabilirsiniz." />
      <Card>
        <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-8">
          <div className="md:col-span-2"><TextInput placeholder="kullanıcı adı, e-posta ya da kimlik…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
          <Select value={sort} onChange={setSort} options={SORTS} />
          <Select value={dir} onChange={setDir} options={[{ value: 'desc', label: 'azalan' }, { value: 'asc', label: 'artan' }]} />
          <Select value={platform} onChange={(v) => { setPlatform(v); setPage(1); }} options={[{ value: '', label: 'tüm platformlar' }, { value: 'android', label: 'Android' }, { value: 'ios', label: 'iOS' }, { value: 'windows', label: 'Windows' }]} />
          <Select value={online} onChange={(v) => { setOnline(v); setPage(1); }} options={[{ value: '', label: 'çevrimiçi: hepsi' }, { value: 'true', label: 'şu an çevrimiçi' }]} />
          <Select value={banned} onChange={(v) => { setBanned(v); setPage(1); }} options={[{ value: '', label: 'yasak: hepsi' }, { value: 'true', label: 'yasaklılar' }]} />
          <Select value={payer} onChange={(v) => { setPayer(v); setPage(1); }} options={[{ value: '', label: 'ödeme: hepsi' }, { value: 'true', label: 'ödeme yapanlar' }]} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-400">
          <span>Misafir:</span><Select value={guest} onChange={(v) => { setGuest(v); setPage(1); }} options={YN} />
          <span>En az</span><TextInput type="number" className="w-20" value={minHours} onChange={(e) => { setMinHours(e.target.value); setPage(1); }} placeholder="0" /><span>saat oynamış</span>
          <span className="ml-auto">{data ? `${fmtNumber(data.total)} oyuncu` : ''}</span>
        </div>
      </Card>

      <Table<P> rows={data?.players ?? []} empty={isLoading ? 'Yükleniyor…' : 'Oyuncu bulunamadı'} cols={[
        { label: 'Oyuncu', render: (p) => <Link href={`/dashboard/players/${p.userId}`} className="block"><div className="flex items-center gap-2 font-medium text-white">{p.online && <span className="h-2 w-2 rounded-full bg-green-500" title="çevrimiçi" />}{p.username}{p.isGuest && <Pill>misafir</Pill>}{p.banned && <Pill tone="red">{p.banned.type === 'permanent' ? 'kalıcı ban' : 'ban'}</Pill>}</div><div className="text-xs text-gray-500">{p.email ?? 'e-posta yok'}</div></Link> },
        { label: 'Seviye / Derece', render: (p) => <div><div className="text-white">Sv {p.level} · {fmtNumber(p.mmr)} MMR</div><div className="text-xs text-gray-500">{p.rank}</div></div> },
        { label: 'Oynama', render: (p) => <div><div className="text-white">{p.hours} saat</div><div className="text-xs text-gray-500">{p.sessions} oturum</div></div> },
        { label: 'Maçlar', render: (p) => <div><div className="text-white">{p.totalMatches}</div><div className="text-xs text-gray-500">{p.wins}G / {p.losses}M</div></div> },
        { label: 'Son görülme', render: (p) => <div><div className="text-gray-300">{p.online ? 'şimdi' : fmtAgo(p.lastSeenAt)}</div><div className="text-xs text-gray-500">{p.platform ?? '—'} {p.appVersion ?? ''}</div></div> },
        { label: 'Harcama', render: (p) => (p.spentUsd > 0 ? <Pill tone="green">{fmtUsd(p.spentUsd)}</Pill> : <span className="text-gray-600">—</span>) },
        { label: '', render: (p) => <Link href={`/dashboard/players/${p.userId}`}><Btn size="sm" variant="ghost">Dosya →</Btn></Link> },
      ]} />
      <div className="flex items-center justify-between text-sm text-gray-400">
        <Btn size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Önceki</Btn>
        <span>Sayfa {page} / {pages}</span>
        <Btn size="sm" variant="ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>Sonraki →</Btn>
      </div>
    </div>
  );
}
