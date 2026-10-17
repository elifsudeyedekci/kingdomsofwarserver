'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { errorMessage, get, patch, post } from '@/lib/api';
import { canWrite } from '@/lib/permissions';
import { fmtDate } from '@/lib/format';
import { Btn, Card, flashError, flashOk, Label, Notice, PageHeader, Pill, Table, TextArea, TextInput } from '@/components/kit/kit';

interface T { id: string; name: string; description: string | null; startAt: string; endAt: string; maxPlayers: number | null; prizePool: unknown; status: string; createdAt: string }
const tone = (s: string) => (s === 'active' ? 'green' : s === 'upcoming' ? 'blue' : s === 'completed' ? 'gray' : 'amber') as 'green' | 'blue' | 'gray' | 'amber';

export default function TournamentsPage() {
  const { data: session } = useSession();
  const writable = canWrite((session as { role?: string } | null)?.role, 'tournaments');
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['tournaments'], queryFn: () => get<{ data: T[] }>('/tournament', { limit: 50 }) });
  const [f, setF] = useState({ name: '', description: '', startAt: '', endAt: '', maxPlayers: '', prizePool: '' });
  const refresh = () => qc.invalidateQueries({ queryKey: ['tournaments'] });
  const create = useMutation({ mutationFn: () => { let prize: unknown; try { prize = f.prizePool.trim() ? JSON.parse(f.prizePool) : undefined; } catch { throw new Error('Ödül havuzu geçerli JSON olmalı'); } return post('/tournament', { name: f.name, description: f.description || undefined, startAt: new Date(f.startAt).toISOString(), endAt: new Date(f.endAt).toISOString(), maxPlayers: Number(f.maxPlayers) || undefined, prizePool: prize }); }, onSuccess: () => { flashOk('Turnuva oluşturuldu.'); setF({ name: '', description: '', startAt: '', endAt: '', maxPlayers: '', prizePool: '' }); refresh(); }, onError: (e) => flashError(e instanceof Error && !('response' in e) ? e.message : errorMessage(e)) });
  const act = useMutation({ mutationFn: (v: { id: string; what: 'start' | 'complete' }) => patch(`/tournament/${v.id}/${v.what}`), onSuccess: () => { flashOk('Güncellendi.'); refresh(); }, onError: (e) => flashError(errorMessage(e)) });
  return (
    <div className="space-y-6">
      <PageHeader title="Turnuvalar" subtitle="Turnuva kayıtları: tarih, kontenjan, ödül havuzu ve durum. Oyun içi turnuva ekranı henüz oyunda yok; burada oluşturduklarınız sunucuda saklanır ve istemci tarafı eklendiğinde kullanılır." />
      <Notice kind="warn">Not: oyunun turnuva arayüzü henüz yapılmadı; bu sayfa yalnızca sunucu tarafını yönetir.</Notice>
      {writable && <Card title="Yeni turnuva"><div className="grid gap-3 md:grid-cols-3"><Label text="Ad"><TextInput value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Label><Label text="Başlangıç"><TextInput type="datetime-local" value={f.startAt} onChange={(e) => setF({ ...f, startAt: e.target.value })} /></Label><Label text="Bitiş"><TextInput type="datetime-local" value={f.endAt} onChange={(e) => setF({ ...f, endAt: e.target.value })} /></Label><Label text="Kontenjan"><TextInput type="number" value={f.maxPlayers} onChange={(e) => setF({ ...f, maxPlayers: e.target.value })} /></Label><div className="md:col-span-2"><Label text="Açıklama"><TextInput value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Label></div><div className="md:col-span-3"><Label text="Ödül havuzu (JSON, isteğe bağlı)" hint='örn. {"1": {"wallet":{"gems":500}}}'><TextArea rows={2} value={f.prizePool} onChange={(e) => setF({ ...f, prizePool: e.target.value })} className="font-mono text-xs" /></Label></div></div><div className="mt-3"><Btn disabled={!f.name || !f.startAt || !f.endAt || create.isPending} onClick={() => create.mutate()}>Oluştur</Btn></div></Card>}
      <Table<T> rows={list.data?.data ?? []} empty={list.isLoading ? 'Yükleniyor…' : 'Turnuva yok'} cols={[{ label: 'Turnuva', render: (t) => <div><div className="font-medium text-white">{t.name}</div><div className="text-xs text-gray-500">{t.description}</div></div> }, { label: 'Tarih', render: (t) => <span className="text-xs text-gray-400">{fmtDate(t.startAt)} → {fmtDate(t.endAt)}</span> }, { label: 'Kontenjan', render: (t) => t.maxPlayers ?? '—' }, { label: 'Durum', render: (t) => <Pill tone={tone(t.status)}>{t.status}</Pill> }, { label: '', render: (t) => writable && <div className="flex gap-1">{t.status === 'upcoming' && <Btn size="sm" variant="success" onClick={() => act.mutate({ id: t.id, what: 'start' })}>Başlat</Btn>}{t.status === 'active' && <Btn size="sm" variant="ghost" onClick={() => act.mutate({ id: t.id, what: 'complete' })}>Bitir</Btn>}</div> }]} />
    </div>
  );
}
