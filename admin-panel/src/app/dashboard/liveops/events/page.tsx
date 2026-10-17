'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { del, errorMessage, get, patch, post } from '@/lib/api';
import { canWrite } from '@/lib/permissions';
import { fmtDate } from '@/lib/format';
import { Btn, Card, flashError, flashOk, Label, PageHeader, Pill, Table, TextArea, TextInput, Toggle } from '@/components/kit/kit';

interface Ev { id: string; titleKey: string; descKey: string; type: string; startAt: string; endAt: string; config: unknown; rewards: unknown; segment: string | null; countries: string[]; minVersion: string | null; isActive: boolean }
const empty = () => ({ titleKey: '', descKey: '', type: 'double_xp', startAt: '', endAt: '', config: '{}', rewards: '', segment: '', countries: '', minVersion: '', isActive: true });
const TYPES = ['double_xp', 'double_resources', 'bonus_reward', 'tournament', 'seasonal', 'special_mode'];

export default function EventsPage() {
  const { data: session } = useSession();
  const writable = canWrite((session as { role?: string } | null)?.role, 'liveops');
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['events'], queryFn: () => get<{ data: Ev[]; total: number }>('/liveops/events', { page: 1, limit: 50 }) });
  const [f, setF] = useState(empty()); const [editing, setEditing] = useState<string | null>(null);
  const body = () => { let config: unknown, rewards: unknown; try { config = JSON.parse(f.config || '{}'); rewards = f.rewards.trim() ? JSON.parse(f.rewards) : undefined; } catch { throw new Error('config / ödüller geçerli JSON olmalı'); } return { titleKey: f.titleKey, descKey: f.descKey, type: f.type, startAt: new Date(f.startAt).toISOString(), endAt: new Date(f.endAt).toISOString(), config, rewards, segment: f.segment || undefined, countries: f.countries.split(/[\s,]+/).filter(Boolean), minVersion: f.minVersion || undefined, isActive: f.isActive }; };
  const refresh = () => qc.invalidateQueries({ queryKey: ['events'] });
  const save = useMutation({ mutationFn: async () => (editing ? patch(`/liveops/events/${editing}`, body()) : post('/liveops/events', body())), onSuccess: () => { flashOk('Etkinlik kaydedildi.'); setF(empty()); setEditing(null); refresh(); }, onError: (e) => flashError(e instanceof Error && !('response' in e) ? e.message : errorMessage(e)) });
  const remove = useMutation({ mutationFn: (id: string) => del(`/liveops/events/${id}`), onSuccess: () => { flashOk('Silindi.'); refresh(); }, onError: (e) => flashError(errorMessage(e)) });
  const toggle = useMutation({ mutationFn: (e: Ev) => patch(`/liveops/events/${e.id}`, { isActive: !e.isActive }), onSuccess: refresh, onError: (e) => flashError(errorMessage(e)) });
  const edit = (e: Ev) => { setEditing(e.id); setF({ titleKey: e.titleKey, descKey: e.descKey, type: e.type, startAt: e.startAt.slice(0, 16), endAt: e.endAt.slice(0, 16), config: JSON.stringify(e.config ?? {}, null, 2), rewards: e.rewards ? JSON.stringify(e.rewards, null, 2) : '', segment: e.segment ?? '', countries: e.countries.join(', '), minVersion: e.minVersion ?? '', isActive: e.isActive }); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  return (
    <div className="space-y-6">
      <PageHeader title="Etkinlikler" subtitle="Zamanlanmış canlı etkinlikler (çift XP, bonus ödül, turnuva...). Sunucu, aktif etkinlikleri oyun açılışında istemciye bildirir. Ülke ve en düşük sürüme göre hedeflenebilir." />
      {writable && (
        <Card title={editing ? 'Etkinliği düzenle' : 'Yeni etkinlik'} right={editing && <Btn size="sm" variant="ghost" onClick={() => { setEditing(null); setF(empty()); }}>Vazgeç</Btn>}>
          <div className="grid gap-3 md:grid-cols-4"><Label text="Başlık (anahtar/metin)"><TextInput value={f.titleKey} onChange={(e) => setF({ ...f, titleKey: e.target.value })} /></Label><Label text="Açıklama (anahtar/metin)"><TextInput value={f.descKey} onChange={(e) => setF({ ...f, descKey: e.target.value })} /></Label><Label text="Tür"><select className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></Label><Toggle checked={f.isActive} onChange={(v) => setF({ ...f, isActive: v })} label="Aktif" />
            <Label text="Başlangıç"><TextInput type="datetime-local" value={f.startAt} onChange={(e) => setF({ ...f, startAt: e.target.value })} /></Label><Label text="Bitiş"><TextInput type="datetime-local" value={f.endAt} onChange={(e) => setF({ ...f, endAt: e.target.value })} /></Label><Label text="Ülkeler (boş = hepsi)"><TextInput value={f.countries} onChange={(e) => setF({ ...f, countries: e.target.value })} placeholder="TR, DE" /></Label><Label text="En düşük sürüm"><TextInput value={f.minVersion} onChange={(e) => setF({ ...f, minVersion: e.target.value })} /></Label>
            <div className="md:col-span-2"><Label text="Ayarlar (JSON)" hint='örn. {"multiplier": 2}'><TextArea rows={4} value={f.config} onChange={(e) => setF({ ...f, config: e.target.value })} className="font-mono text-xs" /></Label></div><div className="md:col-span-2"><Label text="Ödüller (JSON, isteğe bağlı)" hint='"Verme" formundaki ödül biçimi: {"wallet":{"gems":50}}'><TextArea rows={4} value={f.rewards} onChange={(e) => setF({ ...f, rewards: e.target.value })} className="font-mono text-xs" /></Label></div></div>
          <div className="mt-3"><Btn disabled={!f.titleKey || !f.startAt || !f.endAt || save.isPending} onClick={() => save.mutate()}>{editing ? 'Güncelle' : 'Oluştur'}</Btn></div>
        </Card>
      )}
      <Table<Ev> rows={list.data?.data ?? []} empty={list.isLoading ? 'Yükleniyor…' : 'Etkinlik yok'} cols={[{ label: 'Etkinlik', render: (e) => <div><div className="font-medium text-white">{e.titleKey}</div><div className="text-xs text-gray-500">{e.type}</div></div> }, { label: 'Tarih', render: (e) => <span className="text-xs text-gray-400">{fmtDate(e.startAt)} → {fmtDate(e.endAt)}</span> }, { label: 'Hedef', render: (e) => <span className="text-xs text-gray-400">{e.countries.length ? e.countries.join(', ') : 'tümü'}{e.minVersion ? ` · ≥${e.minVersion}` : ''}</span> }, { label: 'Durum', render: (e) => (e.isActive ? <Pill tone="green">aktif</Pill> : <Pill>kapalı</Pill>) }, { label: '', render: (e) => writable && <div className="flex gap-1"><Btn size="sm" variant="ghost" onClick={() => edit(e)}>Düzenle</Btn><Btn size="sm" variant="ghost" onClick={() => toggle.mutate(e)}>{e.isActive ? 'Kapat' : 'Aç'}</Btn><Btn size="sm" variant="danger" onClick={() => { if (confirm('Etkinlik silinsin mi?')) remove.mutate(e.id); }}>Sil</Btn></div> }]} />
    </div>
  );
}
