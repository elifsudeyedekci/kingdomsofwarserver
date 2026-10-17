'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { del, errorMessage, get, post } from '@/lib/api';
import { canWrite } from '@/lib/permissions';
import { fmtDate } from '@/lib/format';
import { Btn, Card, flashError, flashOk, Label, Notice, PageHeader, Pill, Select, Table, TextArea, TextInput } from '@/components/kit/kit';
import { GrantForm, type Rewards } from '@/components/kit/grant-form';

interface Gift { id: string; userId: string; status: string; title: Record<string, string>; rewards: unknown; createdAt: string; expiresAt: string | null; claimedAt: string | null; source: string }
type Mode = 'users' | 'segment';

export default function GrantsPage() {
  const { data: session } = useSession();
  const writable = canWrite((session as { role?: string } | null)?.role, 'grants');
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>('users');
  const [names, setNames] = useState('');
  const [seg, setSeg] = useState({ all: true, platform: '', minLevel: '', activeWithinDays: '', inactiveForDays: '', hasPurchased: '' });
  const [msg, setMsg] = useState({ titleTr: '', titleEn: '', bodyTr: '', bodyEn: '', days: '30' });
  const [status, setStatus] = useState('');
  const target = () => (mode === 'users'
    ? { usernames: names.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean) }
    : { all: true, platform: seg.platform || undefined, minLevel: Number(seg.minLevel) || undefined, activeWithinDays: Number(seg.activeWithinDays) || undefined, inactiveForDays: Number(seg.inactiveForDays) || undefined, hasPurchased: seg.hasPurchased === '' ? undefined : seg.hasPurchased === 'true' });
  const preview = useMutation({ mutationFn: () => post<{ recipients: number }>('/grants/gifts/preview', { target: target() }), onError: (e) => flashError(errorMessage(e)) });
  const send = useMutation({
    mutationFn: (v: { r: Rewards; reason: string }) => post<{ recipients: number }>('/grants/gifts', { target: target(), title: { tr: msg.titleTr || 'Hediye', en: msg.titleEn || msg.titleTr || 'Gift' }, body: { tr: msg.bodyTr || v.reason, en: msg.bodyEn || msg.bodyTr || v.reason }, rewards: v.r, expiresInDays: Number(msg.days) || undefined }),
    onSuccess: (r) => { flashOk(`${r.recipients} oyuncunun posta kutusuna bırakıldı. Çevrimiçi olanlar anında bildirim alır.`); qc.invalidateQueries({ queryKey: ['gifts'] }); },
    onError: (e) => flashError(errorMessage(e)),
  });
  const gifts = useQuery({ queryKey: ['gifts', status], queryFn: () => get<Gift[]>('/grants/gifts', { status: status || undefined, take: 150 }) });
  const cancel = useMutation({ mutationFn: (id: string) => del(`/grants/gifts/${id}`), onSuccess: () => { flashOk('İptal edildi.'); qc.invalidateQueries({ queryKey: ['gifts'] }); }, onError: (e) => flashError(errorMessage(e)) });

  return (
    <div className="space-y-6">
      <PageHeader title="Verme & Hediyeler" subtitle="Oyunculara kaynak, para, içerik paketi (ücretli paketler dahil), eşya, başlangıç askeri/kaynağı ve XP verin. Bir oyuncu, bir liste ya da bütün bir kitle (herkes, platform, seviye, aktiflik, satın alma durumuna göre) seçebilirsiniz. Hediyeler oyuncunun posta kutusuna düşer ve oyuncu 'Al' dediğinde işlenir; tek bir oyuncuya anında vermek için oyuncunun dosyasındaki 'Ekonomi & Verme' sekmesini kullanın." />
      {!writable && <Notice kind="warn">Rolünüz hediye gönderemez; yalnızca geçmişi görebilirsiniz.</Notice>}
      <Card title="1 · Kime?">
        <div className="mb-4 flex gap-2"><Btn variant={mode === 'users' ? 'primary' : 'ghost'} size="sm" onClick={() => setMode('users')}>Belirli oyuncular</Btn><Btn variant={mode === 'segment' ? 'primary' : 'ghost'} size="sm" onClick={() => setMode('segment')}>Kitle (filtre)</Btn></div>
        {mode === 'users' ? (
          <Label text="Kullanıcı adları (boşluk, virgül ya da satır ile ayırın)"><TextArea rows={3} value={names} onChange={(e) => setNames(e.target.value)} placeholder="ahmet123, savasci_ali" /></Label>
        ) : (
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
            <Label text="Platform"><Select className="w-full" value={seg.platform} onChange={(v) => setSeg({ ...seg, platform: v })} options={[{ value: '', label: 'hepsi' }, { value: 'android', label: 'Android' }, { value: 'ios', label: 'iOS' }, { value: 'windows', label: 'Windows' }]} /></Label>
            <Label text="En az seviye"><TextInput type="number" value={seg.minLevel} onChange={(e) => setSeg({ ...seg, minLevel: e.target.value })} /></Label>
            <Label text="Son N günde aktif"><TextInput type="number" value={seg.activeWithinDays} onChange={(e) => setSeg({ ...seg, activeWithinDays: e.target.value })} /></Label>
            <Label text="N+ gündür gelmeyen"><TextInput type="number" value={seg.inactiveForDays} onChange={(e) => setSeg({ ...seg, inactiveForDays: e.target.value })} /></Label>
            <Label text="Satın alma"><Select className="w-full" value={seg.hasPurchased} onChange={(v) => setSeg({ ...seg, hasPurchased: v })} options={[{ value: '', label: 'hepsi' }, { value: 'true', label: 'ödeme yapanlar' }, { value: 'false', label: 'hiç ödeme yapmayanlar' }]} /></Label>
          </div>
        )}
        <div className="mt-4 flex items-center gap-3"><Btn variant="ghost" size="sm" onClick={() => preview.mutate()} disabled={preview.isPending}>Kaç kişi? (önizleme)</Btn>{preview.data && <Pill tone="blue">{preview.data.recipients} oyuncu bu hediyeyi alacak</Pill>}</div>
      </Card>
      <Card title="2 · Mesaj">
        <div className="grid gap-3 md:grid-cols-2"><Label text="Başlık (TR)"><TextInput value={msg.titleTr} onChange={(e) => setMsg({ ...msg, titleTr: e.target.value })} placeholder="Hoş geldin hediyesi" /></Label><Label text="Başlık (EN)"><TextInput value={msg.titleEn} onChange={(e) => setMsg({ ...msg, titleEn: e.target.value })} /></Label><Label text="Metin (TR)"><TextArea rows={2} value={msg.bodyTr} onChange={(e) => setMsg({ ...msg, bodyTr: e.target.value })} /></Label><Label text="Metin (EN)"><TextArea rows={2} value={msg.bodyEn} onChange={(e) => setMsg({ ...msg, bodyEn: e.target.value })} /></Label><Label text="Kaç gün içinde alınmalı"><TextInput type="number" value={msg.days} onChange={(e) => setMsg({ ...msg, days: e.target.value })} /></Label></div>
      </Card>
      <Card title="3 · Ne verilsin?"><GrantForm submitLabel="Hediyeyi gönder" busy={send.isPending} onSubmit={(r, reason) => { if (!writable) return; if (confirm(`Bu hediye ${preview.data ? preview.data.recipients : 'seçilen'} oyuncuya gönderilsin mi?`)) send.mutate({ r, reason }); }} /></Card>

      <Card title="Gönderilen hediyeler" right={<Select value={status} onChange={setStatus} options={[{ value: '', label: 'hepsi' }, { value: 'pending', label: 'bekleyen' }, { value: 'claimed', label: 'alınmış' }, { value: 'cancelled', label: 'iptal' }, { value: 'expired', label: 'süresi dolmuş' }]} />}>
        <Table<Gift> rows={gifts.data ?? []} empty="Hediye yok" cols={[
          { label: 'Tarih', render: (g) => fmtDate(g.createdAt) }, { label: 'Oyuncu', render: (g) => <Link className="text-amber-400 hover:underline" href={`/dashboard/players/${g.userId}`}>{g.userId.slice(0, 8)}…</Link> },
          { label: 'Başlık', render: (g) => g.title.tr ?? g.title.en }, { label: 'İçerik', render: (g) => <span className="text-xs text-gray-400">{JSON.stringify(g.rewards).slice(0, 90)}</span> },
          { label: 'Durum', render: (g) => <Pill tone={g.status === 'claimed' ? 'green' : g.status === 'pending' ? 'amber' : 'gray'}>{g.status}</Pill> },
          { label: '', render: (g) => g.status === 'pending' && writable && <Btn size="sm" variant="danger" onClick={() => cancel.mutate(g.id)}>İptal</Btn> },
        ]} />
      </Card>
    </div>
  );
}
