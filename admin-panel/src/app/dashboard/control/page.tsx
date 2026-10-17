'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { errorMessage, get, post, put } from '@/lib/api';
import { canWrite } from '@/lib/permissions';
import { fmtAgo, fmtDuration } from '@/lib/format';
import { Btn, Card, flashError, flashOk, Label, Notice, PageHeader, Pill, Stat, TextArea, TextInput } from '@/components/kit/kit';

interface Health {
  status: string; time: string;
  server: { uptimeSeconds: number; node: string; host: string; cpuCores: number; loadAvg1m: number; processCpuPercent: number; memoryMB: number; heapMB: number; systemFreeMB: number; systemTotalMB: number; eventLoopLagMs: number; eventLoopLagP99Ms: number };
  database: { ok: boolean; latencyMs: number; version: string };
  redis: { configured: boolean };
  game: { onlinePlayers: number; runningMatches: number; undeliveredCommands: number; staleCommands: number; contentRelease: number | null; maintenance: boolean | null; services: Record<string, boolean> | null };
  requests: { total: number; clientErrors: number; serverErrors: number; serverErrorRatePercent: number; sinceSeconds: number };
  backups: { lastCompleted: string | null; type: string | null; hoursSince: number | null };
}
interface Settings { maintenance: { enabled: boolean; message: Record<string, string>; endsAt: string | null }; update: unknown; services: Record<string, boolean> }

export default function ControlPage() {
  const { data: session } = useSession();
  const role = (session as { role?: string } | null)?.role;
  const live = canWrite(role, 'live'), mod = canWrite(role, 'moderation');
  const qc = useQueryClient();
  const h = useQuery({ queryKey: ['health'], queryFn: () => get<Health>('/system/health'), refetchInterval: 10_000 });
  const st = useQuery({ queryKey: ['live-settings'], queryFn: () => get<Settings>('/live-admin/settings'), refetchInterval: 20_000 });
  const [msg, setMsg] = useState({ title: '', body: '' });
  const save = useMutation({ mutationFn: (patch: Partial<Settings>) => put('/live-admin/settings', patch), onSuccess: () => { flashOk('Uygulandı. Oyunlar birkaç saniye içinde yeni durumu görür.'); qc.invalidateQueries({ queryKey: ['live-settings'] }); qc.invalidateQueries({ queryKey: ['health'] }); }, onError: (e) => flashError(errorMessage(e)) });
  const bc = useMutation({ mutationFn: () => post<{ delivered: number }>('/moderation/message', msg), onSuccess: (r) => { flashOk(`${r.delivered} çevrimiçi oyuncuya gönderildi.`); setMsg({ title: '', body: '' }); }, onError: (e) => flashError(errorMessage(e)) });
  const d = h.data; const s = st.data;
  const tone = (ok: boolean, warn = false) => (ok ? (warn ? 'amber' : 'green') : 'red') as 'green' | 'amber' | 'red';

  return (
    <div className="space-y-6">
      <PageHeader title="Sunucu Kontrolü & Acil Durum" subtitle="Sunucunun GERÇEK ölçülmüş durumu (tahmin ya da örnek veri yok) ve acil durum düğmeleri. Sayılar 10 saniyede bir yenilenir." actions={d && <Pill tone={d.status === 'ok' ? 'green' : 'red'}>{d.status === 'ok' ? 'sunucu sağlıklı' : 'SORUNLU'}</Pill>} />
      {!d && <Notice>Yükleniyor…</Notice>}
      {d && (
        <>
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
            <Stat label="Çevrimiçi oyuncu" value={d.game.onlinePlayers} tone="green" /><Stat label="Süren maç" value={d.game.runningMatches} tone="blue" />
            <Stat label="Veritabanı" value={d.database.ok ? `${d.database.latencyMs} ms` : 'KOPUK'} sub={d.database.version} tone={tone(d.database.ok, d.database.latencyMs > 100)} />
            <Stat label="CPU (süreç)" value={`%${d.server.processCpuPercent}`} sub={`yük ort. ${d.server.loadAvg1m} · ${d.server.cpuCores} çekirdek`} tone={tone(d.server.processCpuPercent < 85, d.server.processCpuPercent > 60)} />
            <Stat label="Bellek" value={`${d.server.memoryMB} MB`} sub={`sistemde boş ${d.server.systemFreeMB}/${d.server.systemTotalMB} MB`} tone={tone(d.server.systemFreeMB > 300, d.server.systemFreeMB < 800)} />
            <Stat label="Olay döngüsü gecikmesi" value={`${d.server.eventLoopLagMs} ms`} sub={`p99 ${d.server.eventLoopLagP99Ms} ms`} tone={tone(d.server.eventLoopLagP99Ms < 200, d.server.eventLoopLagP99Ms > 60)} />
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <Stat label="Çalışma süresi" value={fmtDuration(d.server.uptimeSeconds)} tone="gray" />
            <Stat label="İstekler / sunucu hatası" value={`${d.requests.total} / ${d.requests.serverErrors}`} sub={`hata oranı %${d.requests.serverErrorRatePercent} · ${fmtDuration(d.requests.sinceSeconds)} içinde`} tone={tone(d.requests.serverErrorRatePercent < 1, d.requests.serverErrorRatePercent > 0.2)} />
            <Stat label="Son yedek" value={d.backups.lastCompleted ? `${d.backups.hoursSince} sa önce` : 'HİÇ YOK'} sub={d.backups.type ?? 'yedekleme alınmamış'} tone={tone(d.backups.hoursSince !== null && d.backups.hoursSince < 30, d.backups.hoursSince !== null && d.backups.hoursSince > 24)} />
            <Stat label="Oyuna iletilmemiş komut" value={d.game.undeliveredCommands} sub={d.game.staleCommands > 0 ? `${d.game.staleCommands} tanesi 2 dk+ bekliyor` : 'bekleyen gecikme yok'} tone={tone(d.game.staleCommands === 0)} />
          </div>
          {d.backups.hoursSince === null && <Notice kind="warn"><b>Yedek yok.</b> Veritabanı yedeği alınmamış görünüyor. Dağıtım paketindeki yedekleme betiğini (cron) kurun; sonuç burada ve Yedekleme sayfasında görünür.</Notice>}
        </>
      )}

      <Card title="Acil durum düğmeleri" right={<Link href="/dashboard/live-control" className="text-sm text-amber-400 hover:underline">tüm canlı ayarlar →</Link>}>
        {!live && <div className="mb-3"><Notice kind="warn">Rolünüz bu düğmeleri kullanamaz.</Notice></div>}
        {s && (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-gray-800 p-4"><div className="mb-1 font-medium text-white">Bakım modu {s.maintenance.enabled ? <Pill tone="red">AÇIK</Pill> : <Pill tone="green">kapalı</Pill>}</div><p className="mb-3 text-xs text-gray-500">Oyunculara bakım ekranı gösterir; çevrimdışı oynamaya devam edebilirler.</p><Btn variant={s.maintenance.enabled ? 'success' : 'danger'} disabled={!live || save.isPending} onClick={() => { if (confirm(s.maintenance.enabled ? 'Bakım modu kapatılsın mı?' : 'Bakım modu AÇILSIN mı? Tüm oyuncular bakım ekranı görecek.')) save.mutate({ maintenance: { ...s.maintenance, enabled: !s.maintenance.enabled } }); }}>{s.maintenance.enabled ? 'Bakımı kapat' : 'Bakıma al'}</Btn></div>
            <div className="rounded-lg border border-gray-800 p-4"><div className="mb-1 font-medium text-white">Eşleştirme {s.services.matchmaking === false ? <Pill tone="red">DURDURULDU</Pill> : <Pill tone="green">açık</Pill>}</div><p className="mb-3 text-xs text-gray-500">Kapalıyken yeni çok oyunculu kuyruğa girilemez (süren maçlar etkilenmez).</p><Btn variant={s.services.matchmaking === false ? 'success' : 'warn'} disabled={!live || save.isPending} onClick={() => save.mutate({ services: { ...s.services, matchmaking: s.services.matchmaking === false } })}>{s.services.matchmaking === false ? 'Eşleştirmeyi sürdür' : 'Eşleştirmeyi duraklat'}</Btn></div>
            <div className="rounded-lg border border-gray-800 p-4"><div className="mb-1 font-medium text-white">Tüm çevrimiçi özellikler {s.services.online === false ? <Pill tone="red">KAPALI</Pill> : <Pill tone="green">açık</Pill>}</div><p className="mb-3 text-xs text-gray-500">Oyunu yalnızca çevrimdışı (yapay zekâya karşı) moda alır: çok oyunculu, mağaza, sıralama kapanır.</p><Btn variant={s.services.online === false ? 'success' : 'danger'} disabled={!live || save.isPending} onClick={() => { if (confirm(s.services.online === false ? 'Çevrimiçi özellikler açılsın mı?' : 'Tüm çevrimiçi özellikler KAPATILSIN mı?')) save.mutate({ services: { ...s.services, online: s.services.online === false } }); }}>{s.services.online === false ? 'Çevrimiçiyi aç' : 'Çevrimdışı moda al'}</Btn></div>
          </div>
        )}
      </Card>

      <Card title="Herkese anlık mesaj">
        <div className="grid gap-3 md:grid-cols-2"><Label text="Başlık"><TextInput value={msg.title} onChange={(e) => setMsg({ ...msg, title: e.target.value })} /></Label><Label text="Mesaj"><TextArea rows={2} value={msg.body} onChange={(e) => setMsg({ ...msg, body: e.target.value })} /></Label></div>
        <div className="mt-3"><Btn disabled={!mod || !msg.title.trim() || !msg.body.trim() || bc.isPending} onClick={() => { if (confirm('Şu an çevrimiçi herkese gönderilsin mi?')) bc.mutate(); }}>Gönder</Btn> <span className="ml-3 text-xs text-gray-500">Şu an çevrimiçi olan oyuncuların ekranında açılır (ör. "5 dakika sonra bakım").</span></div>
      </Card>
      {d && <div className="text-xs text-gray-600">Sunucu: {d.server.host} · Node {d.server.node} · Redis {d.redis.configured ? 'yapılandırılmış' : 'yok'} · içerik yaması {d.game.contentRelease ? `v${d.game.contentRelease}` : 'yok'} · ölçüm {fmtAgo(d.time)}</div>}
    </div>
  );
}
