'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { del, errorMessage, get, patch, post } from '@/lib/api';
import { canWrite } from '@/lib/permissions';
import { fmtDate } from '@/lib/format';
import { Btn, Card, flashError, flashOk, Label, PageHeader, Pill, Select, Table, TextArea, TextInput, Toggle } from '@/components/kit/kit';

interface Ann { id: string; kind: 'news' | 'popup' | 'banner'; title: Record<string, string>; body: Record<string, string>; platforms: string[]; minVersion: string | null; maxVersion: string | null; priority: number; startsAt: string; endsAt: string | null; isActive: boolean }
const KINDS = [
  { value: 'news', label: 'Haber (ana menü "Haberler" kutusu)' },
  { value: 'popup', label: 'Açılış penceresi (oyuncu başına bir kez gösterilir)' },
  { value: 'banner', label: 'Şerit (menüde sabit mesaj)' },
];
const PLATFORMS = ['android', 'ios', 'windows'];
const empty = () => ({ kind: 'news', titleTr: '', titleEn: '', bodyTr: '', bodyEn: '', platforms: [] as string[], minVersion: '', maxVersion: '', priority: 0, startsAt: '', endsAt: '', isActive: true });

export default function AnnouncementsPage() {
  const { data: session } = useSession();
  const writable = canWrite((session as { role?: string } | null)?.role, 'live');
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['announcements'], queryFn: () => get<Ann[]>('/live-admin/announcements') });
  const [f, setF] = useState(empty()); const [editing, setEditing] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['announcements'] });

  const body = () => ({
    kind: f.kind, title: { tr: f.titleTr, en: f.titleEn || f.titleTr }, body: { tr: f.bodyTr, en: f.bodyEn || f.bodyTr }, platforms: f.platforms,
    minVersion: f.minVersion || undefined, maxVersion: f.maxVersion || undefined, priority: Number(f.priority) || 0,
    startsAt: f.startsAt ? new Date(f.startsAt).toISOString() : undefined, endsAt: f.endsAt ? new Date(f.endsAt).toISOString() : null, isActive: f.isActive,
  });
  const save = useMutation({
    mutationFn: () => (editing ? patch(`/live-admin/announcements/${editing}`, body()) : post('/live-admin/announcements', body())),
    onSuccess: () => { flashOk(editing ? 'Duyuru güncellendi.' : 'Duyuru yayınlandı: oyuncular açılışta / 5 dk içinde görür.'); setF(empty()); setEditing(null); refresh(); },
    onError: (e) => flashError(errorMessage(e)),
  });
  const remove = useMutation({ mutationFn: (id: string) => del(`/live-admin/announcements/${id}`), onSuccess: () => { flashOk('Silindi.'); refresh(); }, onError: (e) => flashError(errorMessage(e)) });
  const toggle = useMutation({ mutationFn: (a: Ann) => patch(`/live-admin/announcements/${a.id}`, { isActive: !a.isActive }), onSuccess: refresh, onError: (e) => flashError(errorMessage(e)) });

  const edit = (a: Ann) => { setEditing(a.id); setF({ kind: a.kind, titleTr: a.title.tr ?? '', titleEn: a.title.en ?? '', bodyTr: a.body.tr ?? '', bodyEn: a.body.en ?? '', platforms: a.platforms, minVersion: a.minVersion ?? '', maxVersion: a.maxVersion ?? '', priority: a.priority, startsAt: a.startsAt.slice(0, 16), endsAt: a.endsAt ? a.endsAt.slice(0, 16) : '', isActive: a.isActive }); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  return (
    <div className="space-y-6">
      <PageHeader title="Duyurular & Haberler" subtitle="Oyunun ana menüsündeki haberleri, açılış pencerelerini ve şeritleri yönetin. Yayınlanan duyuru, uygulama güncellemesi olmadan oyunculara ulaşır; platform, sürüm ve tarih aralığına göre hedefleyebilirsiniz. Oyuncunun diline göre Türkçe/İngilizce metin gösterilir." />
      <Card title={editing ? 'Duyuruyu düzenle' : 'Yeni duyuru'} right={editing && <Btn size="sm" variant="ghost" onClick={() => { setEditing(null); setF(empty()); }}>Vazgeç</Btn>}>
        <div className="grid gap-4 md:grid-cols-2">
          <Label text="Tür"><Select value={f.kind} onChange={(v) => setF({ ...f, kind: v })} options={KINDS} className="w-full" /></Label>
          <Label text="Öncelik" hint="Büyük sayı = üstte gösterilir"><TextInput type="number" value={f.priority} onChange={(e) => setF({ ...f, priority: Number(e.target.value) })} /></Label>
          <Label text="Başlık (Türkçe)"><TextInput value={f.titleTr} onChange={(e) => setF({ ...f, titleTr: e.target.value })} /></Label>
          <Label text="Başlık (İngilizce)" hint="Boşsa Türkçe kullanılır"><TextInput value={f.titleEn} onChange={(e) => setF({ ...f, titleEn: e.target.value })} /></Label>
          <Label text="Metin (Türkçe)"><TextArea rows={4} value={f.bodyTr} onChange={(e) => setF({ ...f, bodyTr: e.target.value })} /></Label>
          <Label text="Metin (İngilizce)"><TextArea rows={4} value={f.bodyEn} onChange={(e) => setF({ ...f, bodyEn: e.target.value })} /></Label>
          <div>
            <div className="mb-1 text-xs font-medium text-gray-400">Platformlar (hiçbiri seçili değilse hepsi)</div>
            <div className="flex gap-4">{PLATFORMS.map((p) => <label key={p} className="flex items-center gap-1.5 text-sm text-gray-300"><input type="checkbox" checked={f.platforms.includes(p)} onChange={(e) => setF({ ...f, platforms: e.target.checked ? [...f.platforms, p] : f.platforms.filter((x) => x !== p) })} />{p}</label>)}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Label text="En düşük sürüm"><TextInput value={f.minVersion} onChange={(e) => setF({ ...f, minVersion: e.target.value })} placeholder="0.2.0" /></Label>
            <Label text="En yüksek sürüm"><TextInput value={f.maxVersion} onChange={(e) => setF({ ...f, maxVersion: e.target.value })} placeholder="0.9.9" /></Label>
          </div>
          <Label text="Başlangıç (boşsa şimdi)"><TextInput type="datetime-local" value={f.startsAt} onChange={(e) => setF({ ...f, startsAt: e.target.value })} /></Label>
          <Label text="Bitiş (boşsa süresiz)"><TextInput type="datetime-local" value={f.endsAt} onChange={(e) => setF({ ...f, endsAt: e.target.value })} /></Label>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <Toggle checked={f.isActive} onChange={(v) => setF({ ...f, isActive: v })} label="Aktif" />
          <Btn disabled={!writable || !f.titleTr.trim() || !f.bodyTr.trim() || save.isPending} onClick={() => save.mutate()}>{editing ? 'Güncelle' : 'Yayınla'}</Btn>
        </div>
      </Card>

      <Card title="Mevcut duyurular">
        <Table rows={list.data ?? []} empty="Duyuru yok" cols={[
          { label: 'Tür', render: (a) => <Pill tone={a.kind === 'popup' ? 'amber' : a.kind === 'banner' ? 'blue' : 'gray'}>{a.kind}</Pill> },
          { label: 'Başlık', render: (a) => <div><div className="text-white">{a.title.tr || a.title.en}</div><div className="max-w-md truncate text-xs text-gray-500">{a.body.tr || a.body.en}</div></div> },
          { label: 'Hedef', render: (a) => <span className="text-xs text-gray-400">{a.platforms.length ? a.platforms.join(', ') : 'tümü'}{a.minVersion ? ` · ≥${a.minVersion}` : ''}{a.maxVersion ? ` · ≤${a.maxVersion}` : ''}</span> },
          { label: 'Tarih', render: (a) => <span className="text-xs text-gray-400">{fmtDate(a.startsAt)} → {a.endsAt ? fmtDate(a.endsAt) : 'süresiz'}</span> },
          { label: 'Durum', render: (a) => (a.isActive ? <Pill tone="green">aktif</Pill> : <Pill>kapalı</Pill>) },
          { label: '', render: (a) => writable && <div className="flex gap-1"><Btn size="sm" variant="ghost" onClick={() => edit(a)}>Düzenle</Btn><Btn size="sm" variant="ghost" onClick={() => toggle.mutate(a)}>{a.isActive ? 'Kapat' : 'Aç'}</Btn><Btn size="sm" variant="danger" onClick={() => { if (confirm('Duyuru silinsin mi?')) remove.mutate(a.id); }}>Sil</Btn></div> },
        ]} />
      </Card>
    </div>
  );
}
