'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { errorMessage, get, patch, post } from '@/lib/api';
import { canWrite } from '@/lib/permissions';
import { fmtDate } from '@/lib/format';
import { Btn, Card, flashError, flashOk, Label, Notice, PageHeader, Pill, Table, TextInput } from '@/components/kit/kit';

interface Season { id: string; number: number; name: string; startAt: string; endAt: string; bpMaxLevel: number; isActive: boolean; battlePasses: number }

export default function SeasonsPage() {
  const { data: session } = useSession();
  const writable = canWrite((session as { role?: string } | null)?.role, 'liveops');
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['seasons'], queryFn: () => get<Season[]>('/liveops/season') });
  const [f, setF] = useState({ number: '', name: '', startAt: '', endAt: '', bpMaxLevel: '100' });
  const create = useMutation({ mutationFn: () => post('/liveops/season', { number: Number(f.number), name: f.name, startAt: new Date(f.startAt).toISOString(), endAt: new Date(f.endAt).toISOString(), bpMaxLevel: Number(f.bpMaxLevel) || 100 }), onSuccess: () => { flashOk('Sezon oluşturuldu.'); setF({ number: '', name: '', startAt: '', endAt: '', bpMaxLevel: '100' }); qc.invalidateQueries({ queryKey: ['seasons'] }); }, onError: (e) => flashError(errorMessage(e)) });
  const activate = useMutation({ mutationFn: (id: string) => patch(`/liveops/season/${id}/activate`), onSuccess: () => { flashOk('Sezon aktif edildi (diğerleri kapandı).'); qc.invalidateQueries({ queryKey: ['seasons'] }); }, onError: (e) => flashError(errorMessage(e)) });
  const active = list.data?.find((s) => s.isActive);
  return (
    <div className="space-y-6">
      <PageHeader title="Sezonlar" subtitle="Dereceli sezonlar ve Battle Pass dönemleri. Aynı anda yalnızca bir sezon aktif olur; yeni sezonu aktif etmek öncekini kapatır." />
      {!active && list.data && <Notice kind="warn">Şu an aktif sezon yok.</Notice>}
      {active && <Notice kind="ok">Aktif sezon: <b>{active.name}</b> (#{active.number}) — {fmtDate(active.startAt)} → {fmtDate(active.endAt)}</Notice>}
      {writable && <Card title="Yeni sezon"><div className="grid gap-3 md:grid-cols-5"><Label text="Numara"><TextInput type="number" value={f.number} onChange={(e) => setF({ ...f, number: e.target.value })} /></Label><Label text="Ad"><TextInput value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Sezon 1: Kılıçların Doğuşu" /></Label><Label text="Başlangıç"><TextInput type="datetime-local" value={f.startAt} onChange={(e) => setF({ ...f, startAt: e.target.value })} /></Label><Label text="Bitiş"><TextInput type="datetime-local" value={f.endAt} onChange={(e) => setF({ ...f, endAt: e.target.value })} /></Label><Label text="Battle Pass seviyesi"><TextInput type="number" value={f.bpMaxLevel} onChange={(e) => setF({ ...f, bpMaxLevel: e.target.value })} /></Label></div><div className="mt-3"><Btn disabled={!f.number || !f.name || !f.startAt || !f.endAt || create.isPending} onClick={() => create.mutate()}>Oluştur</Btn></div></Card>}
      <Table<Season> rows={list.data ?? []} empty={list.isLoading ? 'Yükleniyor…' : 'Henüz sezon yok'} cols={[{ label: '#', render: (s) => s.number }, { label: 'Ad', render: (s) => <span className="font-medium text-white">{s.name}</span> }, { label: 'Tarih', render: (s) => <span className="text-xs text-gray-400">{fmtDate(s.startAt)} → {fmtDate(s.endAt)}</span> }, { label: 'Battle Pass', render: (s) => `${s.battlePasses} oyuncu · ${s.bpMaxLevel} sv` }, { label: 'Durum', render: (s) => (s.isActive ? <Pill tone="green">aktif</Pill> : <Pill>pasif</Pill>) }, { label: '', render: (s) => writable && !s.isActive && <Btn size="sm" variant="ghost" onClick={() => { if (confirm(`${s.name} aktif edilsin mi?`)) activate.mutate(s.id); }}>Aktif et</Btn> }]} />
    </div>
  );
}
