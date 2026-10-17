'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { errorMessage, get, post } from '@/lib/api';
import { canWrite } from '@/lib/permissions';
import { fmtDuration } from '@/lib/format';
import { Btn, Card, flashError, flashOk, Label, PageHeader, Pill, Stat, Table, TextArea, TextInput } from '@/components/kit/kit';

interface Online { userId: string; username: string; state: string; platform?: string; appVersion?: string; ip?: string; deviceId?: string; matchId?: string; onlineSeconds: number; lastBeatAgoSeconds: number }
interface Resp { count: number; inMatch: number; players: Online[] }

export default function OnlinePage() {
  const { data: session } = useSession();
  const mod = canWrite((session as { role?: string } | null)?.role, 'moderation');
  const { data, isLoading } = useQuery({ queryKey: ['online'], queryFn: () => get<Resp>('/moderation/online'), refetchInterval: 5000 });
  const [bc, setBc] = useState({ title: '', body: '' });
  const broadcast = useMutation({ mutationFn: () => post<{ delivered: number }>('/moderation/message', bc), onSuccess: (r) => { flashOk(`${r.delivered} oyuncunun ekranına gönderildi.`); setBc({ title: '', body: '' }); }, onError: (e) => flashError(errorMessage(e)) });
  const kick = useMutation({ mutationFn: (v: { id: string; reason: string }) => post('/moderation/kick', { userId: v.id, reason: v.reason }), onSuccess: () => flashOk('Oyuncu atıldı.'), onError: (e) => flashError(errorMessage(e)) });

  return (
    <div className="space-y-5">
      <PageHeader title="Şu An Çevrimiçi" subtitle="Oyunu şu anda açık olan oyuncular (5 saniyede bir yenilenir). Oyun açıkken her oyuncu sunucuya bağlıdır; atma ve mesaj komutları saniyeler içinde oyuna ulaşır." />
      <div className="grid gap-3 md:grid-cols-3">
        <Stat label="Çevrimiçi" value={data?.count ?? '…'} tone="green" /><Stat label="Maçta" value={data?.inMatch ?? '…'} tone="blue" /><Stat label="Menüde" value={data ? data.count - data.inMatch : '…'} tone="gray" />
      </div>
      <Table<Online> rows={data?.players ?? []} empty={isLoading ? 'Yükleniyor…' : 'Şu an çevrimiçi oyuncu yok'} cols={[
        { label: 'Oyuncu', render: (p) => <Link href={`/dashboard/players/${p.userId}`} className="font-medium text-amber-400 hover:underline">{p.username}</Link> },
        { label: 'Durum', render: (p) => (p.state === 'match' ? <Pill tone="blue">maçta</Pill> : <Pill>menüde</Pill>) },
        { label: 'Bağlı kalma', render: (p) => fmtDuration(p.onlineSeconds) },
        { label: 'Platform', render: (p) => `${p.platform ?? '—'} ${p.appVersion ?? ''}` },
        { label: 'IP', render: (p) => <span className="text-xs text-gray-400">{p.ip ?? '—'}</span> },
        { label: '', render: (p) => mod && <Btn size="sm" variant="warn" onClick={() => { const r = prompt(`${p.username} için atma nedeni:`); if (r) kick.mutate({ id: p.userId, reason: r }); }}>At</Btn> },
      ]} />
      <Card title="Herkese duyuru (şu an çevrimiçi olan tüm oyuncuların ekranında görünür)">
        <div className="grid gap-3 md:grid-cols-2"><Label text="Başlık"><TextInput value={bc.title} onChange={(e) => setBc({ ...bc, title: e.target.value })} /></Label><Label text="Mesaj"><TextArea rows={2} value={bc.body} onChange={(e) => setBc({ ...bc, body: e.target.value })} /></Label></div>
        <div className="mt-3"><Btn disabled={!mod || !bc.title.trim() || !bc.body.trim() || broadcast.isPending} onClick={() => { if (confirm(`${data?.count ?? 0} oyuncuya gönderilsin mi?`)) broadcast.mutate(); }}>Gönder</Btn></div>
      </Card>
    </div>
  );
}
