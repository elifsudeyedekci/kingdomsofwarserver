'use client';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { get, put, errorMessage } from '@/lib/api';
import { canWrite } from '@/lib/permissions';
import { Btn, Card, flashError, flashOk, Label, Notice, PageHeader, Pill, TextArea, TextInput, Toggle } from '@/components/kit/kit';

type Platform = 'android' | 'ios' | 'windows';
interface Settings {
  maintenance: { enabled: boolean; message: Record<string, string>; endsAt: string | null };
  update: Record<Platform, { min: string; latest: string; url: string; notes: Record<string, string> }>;
  services: Record<string, boolean>;
}
interface Bootstrap {
  maintenance: { enabled: boolean; message: string; endsAt: string | null };
  update: { required: boolean; available: boolean; min: string; latest: string; url: string; notes: string };
  services: Record<string, boolean>;
  content: { version: number; hash: string; files: unknown[] };
  announcements: { id: string; title: string }[];
}

const SERVICES: { key: string; label: string; hint: string }[] = [
  { key: 'online', label: 'Çevrimiçi özellikler (genel şalter)', hint: 'Kapatırsanız oyun yalnızca çevrimdışı (yapay zekâya karşı) modda çalışır.' },
  { key: 'matchmaking', label: 'Eşleştirme / çok oyunculu', hint: 'Kapalıyken "Çok Oyunculu" kuyruğuna girilemez.' },
  { key: 'ranked', label: 'Dereceli maçlar', hint: 'Kapalıyken yalnızca normal (dereceli olmayan) maçlar oynanır.' },
  { key: 'store', label: 'Mağaza & satın alma', hint: 'Mağaza ekranı satın almayı reddeder (örneğin ödeme sağlayıcı sorunu).' },
  { key: 'clans', label: 'Klanlar', hint: 'Klan özelliklerini geçici kapatır.' },
  { key: 'friends', label: 'Arkadaşlar', hint: 'Arkadaş listesi / davetleri kapatır.' },
  { key: 'leaderboards', label: 'Liderlik tabloları', hint: 'Sıralama ekranlarını kapatır.' },
  { key: 'rewards', label: 'Ödül toplama', hint: 'Sezon / görev ödülü talep etmeyi durdurur (ödül hatası bulunursa).' },
  { key: 'analytics', label: 'Analitik gönderimi', hint: 'İstemciden olay göndermeyi durdurur.' },
  { key: 'chat', label: 'Sohbet', hint: 'Oyun içi sohbeti kapatır.' },
];
const PLATFORMS: { id: Platform; label: string }[] = [{ id: 'android', label: 'Android' }, { id: 'ios', label: 'iOS' }, { id: 'windows', label: 'Windows' }];

export default function LiveControlPage() {
  const { data: session } = useSession();
  const writable = canWrite((session as { role?: string } | null)?.role, 'live');
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['live-settings'], queryFn: () => get<Settings>('/live-admin/settings') });
  const [s, setS] = useState<Settings | null>(null);
  const [preview, setPreview] = useState<{ platform: Platform; version: string }>({ platform: 'android', version: '0.2.0' });
  useEffect(() => { if (data) setS(structuredClone(data)); }, [data]);

  const save = useMutation({
    mutationFn: (body: Settings) => put<Settings>('/live-admin/settings', body),
    onSuccess: () => { flashOk('Kaydedildi. Oyunlar en geç birkaç saniye içinde yeni durumu görür.'); qc.invalidateQueries({ queryKey: ['live-settings'] }); qc.invalidateQueries({ queryKey: ['live-preview'] }); },
    onError: (e) => flashError(errorMessage(e)),
  });
  const pv = useQuery({ queryKey: ['live-preview', preview], queryFn: () => get<Bootstrap>('/live/bootstrap', { platform: preview.platform, version: preview.version, locale: 'tr' }), refetchInterval: 15_000 });

  if (isLoading || !s) return <div className="text-gray-400">Yükleniyor…</div>;
  const dirty = JSON.stringify(s) !== JSON.stringify(data);
  const set = (fn: (d: Settings) => void) => { const c = structuredClone(s); fn(c); setS(c); };

  return (
    <div className="space-y-6">
      <PageHeader title="Canlı Kontrol" subtitle="Oyuncuların açılışta gördüğü kapılar: bakım modu, zorunlu / isteğe bağlı güncelleme ve özellik şalterleri. Buradaki her değişiklik uygulama güncellemesi gerektirmeden, oyuncular oyunu açtığında (ve açıkken en geç 5 dakika içinde) devreye girer."
        actions={<>{dirty && <Pill tone="amber">kaydedilmemiş değişiklik</Pill>}<Btn disabled={!writable || !dirty || save.isPending} onClick={() => save.mutate(s)}>{save.isPending ? 'Kaydediliyor…' : 'Kaydet'}</Btn></>} />
      {!writable && <Notice kind="warn">Rolünüz bu ayarları yalnızca görüntüleyebilir.</Notice>}

      <Card title="Bakım modu" right={s.maintenance.enabled ? <Pill tone="red">AÇIK</Pill> : <Pill tone="green">kapalı</Pill>}>
        <div className="space-y-4">
          <Toggle checked={s.maintenance.enabled} onChange={(v) => set((d) => { d.maintenance.enabled = v; })} disabled={!writable} label="Bakım modunu aç" hint="Oyuncular açılışta bir bakım ekranı görür; çevrimdışı oynamaya devam edebilir. Sunucuyu güncellerken / acil durumlarda açın." />
          <div className="grid gap-4 md:grid-cols-2">
            <Label text="Mesaj (Türkçe)"><TextArea rows={3} disabled={!writable} value={s.maintenance.message.tr ?? ''} onChange={(e) => set((d) => { d.maintenance.message.tr = e.target.value; })} /></Label>
            <Label text="Mesaj (İngilizce)"><TextArea rows={3} disabled={!writable} value={s.maintenance.message.en ?? ''} onChange={(e) => set((d) => { d.maintenance.message.en = e.target.value; })} /></Label>
          </div>
          <Label text="Otomatik bitiş (isteğe bağlı)" hint="Bu saatten sonra bakım modu kendiliğinden kalkar. Boş bırakırsanız elle kapatana kadar sürer.">
            <TextInput type="datetime-local" disabled={!writable} value={s.maintenance.endsAt ? s.maintenance.endsAt.slice(0, 16) : ''} onChange={(e) => set((d) => { d.maintenance.endsAt = e.target.value ? new Date(e.target.value).toISOString() : null; })} />
          </Label>
        </div>
      </Card>

      <Card title="Güncelleme kapıları (mağaza sürümü)">
        <p className="mb-4 text-sm text-gray-400"><b>En düşük sürüm</b>: bunun altındaki oyuncular oyuna giremez, "Güncelle" ekranı görür (büyük değişiklikler için). <b>Son sürüm</b>: bunun altındakilere isteğe bağlı "yeni sürüm var" bildirimi gösterilir. Veri/denge değişiklikleri için güncelleme gerekmez — onlar için <i>Oyun Verisi &amp; Yamalar</i> sayfasını kullanın.</p>
        <div className="grid gap-4 lg:grid-cols-3">
          {PLATFORMS.map((p) => (
            <div key={p.id} className="space-y-3 rounded-lg border border-gray-800 p-4">
              <div className="font-medium text-white">{p.label}</div>
              <Label text="En düşük sürüm (zorunlu)"><TextInput disabled={!writable} value={s.update[p.id].min} onChange={(e) => set((d) => { d.update[p.id].min = e.target.value; })} placeholder="0.2.0" /></Label>
              <Label text="Son sürüm"><TextInput disabled={!writable} value={s.update[p.id].latest} onChange={(e) => set((d) => { d.update[p.id].latest = e.target.value; })} placeholder="0.3.0" /></Label>
              <Label text="Mağaza bağlantısı"><TextInput disabled={!writable} value={s.update[p.id].url} onChange={(e) => set((d) => { d.update[p.id].url = e.target.value; })} placeholder="https://play.google.com/store/apps/details?id=…" /></Label>
              <Label text="Yenilik notu (TR)"><TextArea rows={2} disabled={!writable} value={s.update[p.id].notes.tr ?? ''} onChange={(e) => set((d) => { d.update[p.id].notes.tr = e.target.value; })} /></Label>
              <Label text="Yenilik notu (EN)"><TextArea rows={2} disabled={!writable} value={s.update[p.id].notes.en ?? ''} onChange={(e) => set((d) => { d.update[p.id].notes.en = e.target.value; })} /></Label>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Özellik şalterleri">
        <div className="grid gap-4 md:grid-cols-2">
          {SERVICES.map((sv) => (
            <Toggle key={sv.key} checked={s.services[sv.key] !== false} disabled={!writable} onChange={(v) => set((d) => { d.services[sv.key] = v; })} label={sv.label} hint={sv.hint} />
          ))}
        </div>
      </Card>

      <Card title="Oyuncu gözüyle önizleme" right={pv.data && <span className="text-xs text-gray-500">canlı yanıt · 15 sn'de bir yenilenir</span>}>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <Label text="Platform"><select className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white" value={preview.platform} onChange={(e) => setPreview({ ...preview, platform: e.target.value as Platform })}>{PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></Label>
          <Label text="Oyuncunun sürümü"><TextInput value={preview.version} onChange={(e) => setPreview({ ...preview, version: e.target.value })} className="w-32" /></Label>
        </div>
        {pv.data ? (
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-gray-800 p-3"><div className="text-xs text-gray-500">Bakım</div><div className="mt-1">{pv.data.maintenance.enabled ? <Pill tone="red">bakım ekranı</Pill> : <Pill tone="green">yok</Pill>}</div></div>
            <div className="rounded-lg border border-gray-800 p-3"><div className="text-xs text-gray-500">Güncelleme</div><div className="mt-1">{pv.data.update.required ? <Pill tone="red">ZORUNLU</Pill> : pv.data.update.available ? <Pill tone="amber">isteğe bağlı</Pill> : <Pill tone="green">güncel</Pill>}</div></div>
            <div className="rounded-lg border border-gray-800 p-3"><div className="text-xs text-gray-500">Veri yaması</div><div className="mt-1 text-sm text-white">v{pv.data.content.version || '—'} <span className="text-gray-500">({pv.data.content.files.length} dosya)</span></div></div>
            <div className="rounded-lg border border-gray-800 p-3"><div className="text-xs text-gray-500">Aktif duyuru</div><div className="mt-1 text-sm text-white">{pv.data.announcements.length}</div></div>
          </div>
        ) : <div className="text-sm text-gray-500">Yükleniyor…</div>}
      </Card>
    </div>
  );
}
