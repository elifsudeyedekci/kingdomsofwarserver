'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { errorMessage, get, post } from '@/lib/api';
import { canWrite } from '@/lib/permissions';
import { fmtDate } from '@/lib/format';
import { Btn, Card, flashError, flashOk, Label, PageHeader, Pill, Select, Table, TextArea, TextInput, useDebounced } from '@/components/kit/kit';

interface Ban { id: string; userId: string; username: string | null; type: string; reason: string; evidence: string | null; bannedBy: string; startsAt: string; endsAt: string | null; isActive: boolean; liftNote: string | null; online: boolean }

export default function BansPage() {
  const { data: session } = useSession();
  const writable = canWrite((session as { role?: string } | null)?.role, 'moderation');
  const qc = useQueryClient();
  const [active, setActive] = useState('true'); const [type, setType] = useState(''); const [q, setQ] = useState(''); const dq = useDebounced(q);
  const bans = useQuery({ queryKey: ['bans', active, type, dq], queryFn: () => get<Ban[]>('/moderation/bans', { active: active || undefined, type: type || undefined, q: dq || undefined, take: 200 }), refetchInterval: 20_000 });
  const [f, setF] = useState({ username: '', kind: 'kick', type: 'temporary', hours: '72', reason: '', evidence: '' });
  const resolveId = async (name: string) => { const r = await get<{ players: { userId: string; username: string }[] }>('/insights/players', { q: name, limit: 5 }); const p = r.players.find((x) => x.username.toLowerCase() === name.toLowerCase()) ?? r.players[0]; if (!p) throw new Error('Oyuncu bulunamadı'); return p.userId; };
  const act = useMutation({
    mutationFn: async () => { const userId = await resolveId(f.username.trim()); return f.kind === 'kick' ? post('/moderation/kick', { userId, reason: f.reason }) : post('/moderation/ban', { userId, type: f.type, hours: f.type === 'temporary' ? Number(f.hours) : undefined, reason: f.reason, evidence: f.evidence || undefined }); },
    onSuccess: () => { flashOk(f.kind === 'kick' ? 'Oyuncu atıldı.' : 'Yasak uygulandı; çevrimiçiyse oyun anında kapandı.'); setF({ ...f, username: '', reason: '', evidence: '' }); qc.invalidateQueries({ queryKey: ['bans'] }); }, onError: (e) => flashError(errorMessage(e)),
  });
  const unban = useMutation({ mutationFn: (b: Ban) => post('/moderation/unban', { userId: b.userId, note: 'panelden kaldırıldı' }), onSuccess: () => { flashOk('Yasak kaldırıldı.'); qc.invalidateQueries({ queryKey: ['bans'] }); }, onError: (e) => flashError(errorMessage(e)) });

  return (
    <div className="space-y-5">
      <PageHeader title="Banlar & Kickler" subtitle="Oyuncuyu anında oyundan atın (kick) ya da yasaklayın. Süreli / süresiz yasak oyuncuyu oyundan tamamen engeller: giriş yapamaz, çevrimiçiyse oyunu saniyeler içinde kapanır, yasak nedeni kendisine gösterilir. 'Yalnızca dereceli' yasak sadece dereceli kuyruğu kapatır. Otomatik hile yasakları da burada görünür." />
      {writable && (
        <Card title="Hızlı işlem">
          <div className="grid gap-3 md:grid-cols-6">
            <Label text="Kullanıcı adı"><TextInput value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} /></Label>
            <Label text="İşlem"><Select className="w-full" value={f.kind} onChange={(v) => setF({ ...f, kind: v })} options={[{ value: 'kick', label: 'Oyundan at (kick)' }, { value: 'ban', label: 'Yasakla' }]} /></Label>
            {f.kind === 'ban' && <Label text="Yasak türü"><Select className="w-full" value={f.type} onChange={(v) => setF({ ...f, type: v })} options={[{ value: 'temporary', label: 'Süreli' }, { value: 'permanent', label: 'Süresiz' }, { value: 'ranked_only', label: 'Yalnızca dereceli' }]} /></Label>}
            {f.kind === 'ban' && f.type === 'temporary' && <Label text="Süre (saat)"><TextInput type="number" value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} /></Label>}
            <div className="md:col-span-2"><Label text="Neden (oyuncuya gösterilir)"><TextInput value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Label></div>
          </div>
          {f.kind === 'ban' && <div className="mt-3"><Label text="Kanıt / iç not"><TextArea rows={2} value={f.evidence} onChange={(e) => setF({ ...f, evidence: e.target.value })} /></Label></div>}
          <div className="mt-3"><Btn variant={f.kind === 'ban' ? 'danger' : 'warn'} disabled={!f.username.trim() || !f.reason.trim() || act.isPending} onClick={() => { if (confirm(`${f.username} için işlem uygulansın mı?`)) act.mutate(); }}>Uygula</Btn></div>
        </Card>
      )}
      <Card>
        <div className="flex flex-wrap gap-3">
          <Select value={active} onChange={setActive} options={[{ value: 'true', label: 'yürürlükte' }, { value: '', label: 'tümü (geçmiş dahil)' }, { value: 'false', label: 'bitmiş / kaldırılmış' }]} />
          <Select value={type} onChange={setType} options={[{ value: '', label: 'tüm türler' }, { value: 'temporary', label: 'süreli' }, { value: 'permanent', label: 'süresiz' }, { value: 'ranked_only', label: 'dereceli' }]} />
          <TextInput placeholder="oyuncu / neden ara…" className="w-64" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </Card>
      <Table<Ban> rows={bans.data ?? []} empty={bans.isLoading ? 'Yükleniyor…' : 'Yasak yok'} cols={[
        { label: 'Oyuncu', render: (b) => <Link className="font-medium text-amber-400 hover:underline" href={`/dashboard/players/${b.userId}`}>{b.username ?? b.userId.slice(0, 8)}</Link> },
        { label: 'Tür', render: (b) => <Pill tone={b.isActive ? 'red' : 'gray'}>{b.type}</Pill> },
        { label: 'Neden / kanıt', render: (b) => <div><div className="text-gray-200">{b.reason}</div>{b.evidence && <div className="max-w-md truncate text-xs text-gray-500" title={b.evidence}>{b.evidence}</div>}</div> },
        { label: 'Yasaklayan', render: (b) => (b.bannedBy === 'cheat-engine' ? <Pill tone="purple">hile motoru</Pill> : <span className="text-xs text-gray-400">{b.bannedBy.slice(0, 10)}</span>) },
        { label: 'Başlangıç → Bitiş', render: (b) => <span className="text-xs text-gray-400">{fmtDate(b.startsAt)} → {b.endsAt ? fmtDate(b.endsAt) : 'süresiz'}</span> },
        { label: '', render: (b) => b.isActive && writable && <Btn size="sm" variant="success" onClick={() => { if (confirm('Yasak kaldırılsın mı?')) unban.mutate(b); }}>Kaldır</Btn> },
      ]} />
    </div>
  );
}
