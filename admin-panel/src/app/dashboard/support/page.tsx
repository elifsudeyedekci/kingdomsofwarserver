'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { errorMessage, get, patch, post } from '@/lib/api';
import { canWrite } from '@/lib/permissions';
import { fmtAgo, fmtDate } from '@/lib/format';
import { Btn, Card, flashError, flashOk, PageHeader, Pill, Select, Stat, Table, Tabs, TextArea } from '@/components/kit/kit';

interface Msg { id: string; senderId: string; body: string; isAdminReply: boolean; createdAt: string }
interface Ticket { id: string; userId: string; subject: string; category: string; priority: string; status: string; assignedTo: string | null; messages: Msg[]; createdAt: string; updatedAt: string }
interface Resp { items: Ticket[]; total: number }
interface Report { id: string; reporterId: string; targetUserId: string; type: string; reason: string; status: string; createdAt: string; reviewNote: string | null }
interface Stats { open: number; in_progress: number; waiting_player: number; resolved: number; closed: number; total: number; avgResolutionHours: number | null }
const STATUS = [{ value: '', label: 'tüm durumlar' }, { value: 'open', label: 'açık' }, { value: 'in_progress', label: 'işlemde' }, { value: 'waiting_player', label: 'oyuncu bekleniyor' }, { value: 'resolved', label: 'çözüldü' }, { value: 'closed', label: 'kapandı' }];
const tone = (s: string) => (s === 'open' ? 'red' : s === 'in_progress' ? 'amber' : s === 'waiting_player' ? 'blue' : 'green') as 'red' | 'amber' | 'blue' | 'green';

export default function SupportPage() {
  const { data: session } = useSession();
  const writable = canWrite((session as { role?: string } | null)?.role, 'support');
  const me = (session as { user?: { id?: string } } | null)?.user?.id;
  const qc = useQueryClient();
  const [tab, setTab] = useState<'tickets' | 'reports'>('tickets'); const [status, setStatus] = useState('open'); const [sel, setSel] = useState<string | null>(null); const [reply, setReply] = useState(''); const [resolution, setResolution] = useState('');
  const stats = useQuery({ queryKey: ['sup-stats'], queryFn: () => get<Stats>('/support/stats'), refetchInterval: 30_000 });
  const list = useQuery({ queryKey: ['tickets', status], queryFn: () => get<Resp>('/support', { page: 1, limit: 50, status: status || undefined }), refetchInterval: 20_000, enabled: tab === 'tickets' });
  const detail = useQuery({ queryKey: ['ticket', sel], queryFn: () => get<Ticket>(`/support/${sel}`), enabled: !!sel });
  const reports = useQuery({ queryKey: ['mod-reports'], queryFn: () => get<{ items: Report[] }>('/support/reports', { page: 1, limit: 50 }), enabled: tab === 'reports' });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['tickets'] }); qc.invalidateQueries({ queryKey: ['ticket', sel] }); qc.invalidateQueries({ queryKey: ['sup-stats'] }); qc.invalidateQueries({ queryKey: ['mod-reports'] }); };
  const done = (m: string) => ({ onSuccess: () => { flashOk(m); refresh(); }, onError: (e: unknown) => flashError(errorMessage(e)) });
  const sendReply = useMutation({ mutationFn: () => post(`/support/${sel}/reply`, { body: reply, senderId: 'panel', isAdminReply: true }), ...done('Yanıt gönderildi.'), onSuccess: () => { setReply(''); flashOk('Yanıt gönderildi.'); refresh(); } });
  const setSt = useMutation({ mutationFn: (s: string) => patch(`/support/${sel}/status`, { status: s }), ...done('Durum güncellendi.') });
  const assign = useMutation({ mutationFn: () => patch(`/support/${sel}/assign`, { adminId: me }), ...done('Talep size atandı.') });
  const resolve = useMutation({ mutationFn: () => patch(`/support/${sel}/resolve`, { resolution }), ...done('Çözüldü olarak işaretlendi.'), onSuccess: () => { setResolution(''); flashOk('Çözüldü.'); refresh(); } });
  const review = useMutation({ mutationFn: (v: { id: string; status: string }) => patch(`/support/reports/${v.id}/review`, { reviewedBy: me ?? 'panel', status: v.status, reviewNote: 'panelden incelendi' }), ...done('Şikâyet güncellendi.') });
  const t = detail.data;

  return (
    <div className="space-y-5">
      <PageHeader title="Destek Talepleri" subtitle="Oyuncuların oyun içinden gönderdiği talepler ve oyuncu şikâyetleri. Yanıtınız oyuncunun oyun içi destek ekranında görünür." />
      <div className="grid gap-3 md:grid-cols-5"><Stat label="Açık" value={stats.data?.open ?? '…'} tone={stats.data?.open ? 'red' : 'green'} /><Stat label="İşlemde" value={stats.data?.in_progress ?? '…'} tone="amber" /><Stat label="Oyuncu bekleniyor" value={stats.data?.waiting_player ?? '…'} tone="blue" /><Stat label="Çözülen" value={stats.data?.resolved ?? '…'} tone="green" /><Stat label="Ort. çözüm süresi" value={stats.data?.avgResolutionHours != null ? `${Math.round(stats.data.avgResolutionHours)} sa` : '—'} tone="gray" /></div>
      <Tabs active={tab} onChange={setTab} tabs={[{ id: 'tickets', label: 'Talepler' }, { id: 'reports', label: 'Oyuncu şikâyetleri' }]} />
      {tab === 'tickets' && (
        <div className="grid gap-5 lg:grid-cols-[26rem_1fr]">
          <div className="space-y-3">
            <Select value={status} onChange={setStatus} options={STATUS} />
            {(list.data?.items ?? []).map((x) => (
              <button key={x.id} onClick={() => setSel(x.id)} className={`block w-full rounded-lg border p-3 text-left ${sel === x.id ? 'border-amber-600 bg-amber-950/20' : 'border-gray-800 hover:bg-gray-800/50'}`}>
                <div className="flex items-start justify-between gap-2"><span className="font-medium text-white">{x.subject}</span><Pill tone={tone(x.status)}>{x.status}</Pill></div>
                <div className="mt-1 text-xs text-gray-500">{x.category} · {x.priority} · {fmtAgo(x.updatedAt)}</div>
              </button>
            ))}
            {list.data && list.data.items.length === 0 && <div className="rounded-lg border border-gray-800 p-6 text-center text-sm text-gray-500">Bu durumda talep yok.</div>}
          </div>
          <div>
            {!t ? <Card><div className="py-16 text-center text-gray-500">Soldan bir talep seçin.</div></Card> : (
              <Card title={t.subject} right={<div className="flex items-center gap-2"><Pill tone={tone(t.status)}>{t.status}</Pill><Link href={`/dashboard/players/${t.userId}`} className="text-sm text-amber-400 hover:underline">oyuncu dosyası →</Link></div>}>
                <div className="mb-4 max-h-96 space-y-3 overflow-auto">{t.messages.map((m) => <div key={m.id} className={`rounded-lg p-3 text-sm ${m.isAdminReply ? 'ml-10 bg-amber-950/30' : 'mr-10 bg-gray-800'}`}><div className="mb-1 text-xs text-gray-500">{m.isAdminReply ? 'Destek' : 'Oyuncu'} · {fmtDate(m.createdAt)}</div><div className="whitespace-pre-wrap text-gray-200">{m.body}</div></div>)}</div>
                {writable && (
                  <div className="space-y-3 border-t border-gray-800 pt-4">
                    <TextArea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Yanıtınız…" />
                    <div className="flex flex-wrap gap-2"><Btn disabled={!reply.trim() || sendReply.isPending} onClick={() => sendReply.mutate()}>Yanıtla</Btn><Btn variant="ghost" onClick={() => assign.mutate()}>Bana ata</Btn><Btn variant="ghost" onClick={() => setSt.mutate('waiting_player')}>Oyuncu bekleniyor</Btn><Btn variant="ghost" onClick={() => setSt.mutate('closed')}>Kapat</Btn>{t.status === 'closed' && <Btn variant="ghost" onClick={() => setSt.mutate('open')}>Yeniden aç</Btn>}</div>
                    <div className="flex gap-2"><TextArea rows={2} className="flex-1" value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="Çözüm notu (en az 5 karakter)…" /><Btn variant="success" disabled={resolution.trim().length < 5 || resolve.isPending} onClick={() => resolve.mutate()}>Çözüldü</Btn></div>
                  </div>
                )}
              </Card>
            )}
          </div>
        </div>
      )}
      {tab === 'reports' && (
        <Table<Report> rows={reports.data?.items ?? []} empty="Şikâyet yok" cols={[
          { label: 'Tarih', render: (r) => fmtDate(r.createdAt) }, { label: 'Şikâyet edilen', render: (r) => <Link className="text-amber-400 hover:underline" href={`/dashboard/players/${r.targetUserId}`}>{r.targetUserId.slice(0, 8)}…</Link> },
          { label: 'Tür', render: (r) => r.type }, { label: 'Neden', render: (r) => r.reason }, { label: 'Durum', render: (r) => <Pill tone={r.status === 'pending' ? 'amber' : 'green'}>{r.status}</Pill> },
          { label: '', render: (r) => writable && r.status === 'pending' && <div className="flex gap-1"><Btn size="sm" variant="success" onClick={() => review.mutate({ id: r.id, status: 'actioned' })}>İşlem yapıldı</Btn><Btn size="sm" variant="ghost" onClick={() => review.mutate({ id: r.id, status: 'dismissed' })}>Reddet</Btn></div> },
        ]} />
      )}
    </div>
  );
}
