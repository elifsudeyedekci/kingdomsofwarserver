'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { del, errorMessage, get, post, put } from '@/lib/api';
import { canWrite } from '@/lib/permissions';
import { fmtAgo, fmtDate } from '@/lib/format';
import { useFeed } from '@/lib/live-feed';
import { Btn, Card, flashError, flashOk, Label, Notice, PageHeader, Pill, Select, sevTone, Stat, Table, Tabs, TextArea, TextInput, Toggle } from '@/components/kit/kit';

interface Flag { id: string; userId: string; username: string | null; online: boolean; matchId: string | null; flagType: string; severity: string; reviewed: boolean; reviewedBy: string | null; reviewNote: string | null; createdAt: string; data: Record<string, unknown> | null }
interface FlagDetail { flag: Flag; profile: { username: string; level: number; mmr: number; totalMatches: number; wins: number } | null; otherFlagsOfPlayer: Flag[]; recentSessions: { startedAt: string; ip: string | null; deviceId: string | null; platform: string | null; appVersion: string | null }[]; activeBan: { type: string; reason: string } | null; online: boolean }
interface Rule { severity: string; auto?: { type: string; hours?: number; afterStrikes?: number; windowDays?: number } }
interface Policy { autoEnforce: boolean; rules: Record<string, Rule> }
interface Stats { openFlags: number; last24h: number; autoActions7d: number; byType7d: { type: string; severity: string; count: number }[]; perDay7d: Record<string, number> }
interface DeviceBan { id: string; deviceId: string | null; ip: string | null; reason: string; until: string | null; auto: boolean; createdAt: string }

const TYPE_HELP: Record<string, string> = {
  modified_game_data: 'Oyuncunun oyun verisi sunucudaki yayından farklı: oyun dosyaları değiştirilmiş (denge hilesi). Kesin kanıt.',
  result_mismatch: 'Aynı maçın oyuncuları farklı sonuç bildirdi.', false_result_claim: 'Bir oyuncu, diğer tüm oyuncuların tersini bildirdi (yalan sonuç).',
  win_rate_anomaly: 'Son maçlarda olağan dışı yüksek galibiyet oranı.', mmr_spike: 'Derece çok kısa sürede aşırı arttı.', win_trading: 'Aynı iki hesap birbirine sürekli galibiyet veriyor.',
  shared_device_match: 'Rakipler aynı cihaz / IP üzerinden oynuyor (kendi kendine maç / boost).', ban_evasion: 'Yasaklı bir oyuncunun cihazından / IP\'sinden yeni hesap.',
  client_tamper: 'Oyunun kendi koruması bellek değiştirme / kanca / bozuk ikili dosya tespit etti.', speed_hack: 'Oyun saatinde oynama (hız hilesi).', impossible_apm: 'İnsan dışı komut hızı.', api_abuse: 'API kötüye kullanımı.', manual: 'Moderatör tarafından işaretlendi.',
};
const ACTIONS = [
  { value: 'dismiss', label: 'Yanlış alarm (kapat; otomatik ceza varsa kaldır)' }, { value: 'warn', label: 'Uyar (oyuncuya mesaj)' }, { value: 'kick', label: 'Oyundan at' }, { value: 'ban_temp', label: 'Süreli yasakla' },
  { value: 'ban_perm', label: 'Kalıcı yasakla' }, { value: 'ban_ranked', label: 'Dereceliden yasakla' }, { value: 'ban_device', label: 'Cihaz + IP + hesabı yasakla' },
];

function Inner() {
  const sp = useSearchParams(); const wanted = sp.get('flag');
  const { data: session } = useSession();
  const writable = canWrite((session as { role?: string } | null)?.role, 'cheat');
  const qc = useQueryClient();
  const [tab, setTab] = useState<'flags' | 'policy' | 'devices'>('flags');
  const [status, setStatus] = useState('open'); const [severity, setSeverity] = useState(''); const [type, setType] = useState('');
  const [selected, setSelected] = useState<string | null>(wanted);
  const feed = useFeed(); const markSeen = feed.markSeen;
  useEffect(() => { markSeen(); }, [markSeen]);
  const newest = feed.items.find((i) => i.kind === 'cheat')?.id;
  useEffect(() => { if (newest) { qc.invalidateQueries({ queryKey: ['cheat-flags'] }); qc.invalidateQueries({ queryKey: ['cheat-stats'] }); } }, [newest, qc]);

  const stats = useQuery({ queryKey: ['cheat-stats'], queryFn: () => get<Stats>('/cheatwatch/stats'), refetchInterval: 30_000 });
  const flags = useQuery({ queryKey: ['cheat-flags', status, severity, type], queryFn: () => get<Flag[]>('/cheatwatch/flags', { status: status || undefined, severity: severity || undefined, type: type || undefined, take: 150 }), refetchInterval: 20_000 });
  const detail = useQuery({ queryKey: ['cheat-flag', selected], queryFn: () => get<FlagDetail>(`/cheatwatch/flags/${selected}`), enabled: !!selected });
  const [act, setAct] = useState({ action: 'ban_temp', note: '', hours: '72' });
  const resolve = useMutation({ mutationFn: () => post(`/cheatwatch/flags/${selected}/resolve`, { action: act.action, note: act.note, hours: ['ban_temp', 'ban_device'].includes(act.action) ? Number(act.hours) || undefined : undefined }), onSuccess: () => { flashOk('İşlem uygulandı.'); setAct({ ...act, note: '' }); qc.invalidateQueries({ queryKey: ['cheat-flags'] }); qc.invalidateQueries({ queryKey: ['cheat-flag', selected] }); qc.invalidateQueries({ queryKey: ['cheat-stats'] }); }, onError: (e) => flashError(errorMessage(e)) });

  const policy = useQuery({ queryKey: ['cheat-policy'], queryFn: () => get<Policy>('/cheatwatch/policy'), enabled: tab === 'policy' });
  const [pol, setPol] = useState<Policy | null>(null);
  useEffect(() => { if (policy.data) setPol(structuredClone(policy.data)); }, [policy.data]);
  const savePol = useMutation({ mutationFn: () => put('/cheatwatch/policy', pol), onSuccess: () => { flashOk('Politika kaydedildi.'); qc.invalidateQueries({ queryKey: ['cheat-policy'] }); }, onError: (e) => flashError(errorMessage(e)) });

  const devs = useQuery({ queryKey: ['device-bans'], queryFn: () => get<DeviceBan[]>('/cheatwatch/device-bans'), enabled: tab === 'devices' });
  const [nd, setNd] = useState({ deviceId: '', ip: '', reason: '', hours: '' });
  const addDev = useMutation({ mutationFn: () => post('/cheatwatch/device-bans', { deviceId: nd.deviceId || undefined, ip: nd.ip || undefined, reason: nd.reason, hours: Number(nd.hours) || undefined }), onSuccess: () => { flashOk('Engellendi.'); setNd({ deviceId: '', ip: '', reason: '', hours: '' }); qc.invalidateQueries({ queryKey: ['device-bans'] }); }, onError: (e) => flashError(errorMessage(e)) });
  const delDev = useMutation({ mutationFn: (id: string) => del(`/cheatwatch/device-bans/${id}`), onSuccess: () => { flashOk('Engel kaldırıldı.'); qc.invalidateQueries({ queryKey: ['device-bans'] }); }, onError: (e) => flashError(errorMessage(e)) });

  const types = Object.keys(TYPE_HELP);
  const f = detail.data?.flag; const ctx = (f?.data?.ctx ?? {}) as Record<string, string | undefined>;

  return (
    <div className="space-y-5">
      <PageHeader title="Hile Merkezi" subtitle="Sunucunun otomatik hile tespitleri anında burada görünür (sağ üstte uyarı da çıkar). Her bulgunun kanıtı, kaynağı (IP, cihaz, sürüm, maç) ve oyuncunun geçmişi kayıtlıdır. Kesin kanıtlarda motor otomatik yasaklar; şüpheli durumlarda karar size kalır." />
      <div className="grid gap-3 md:grid-cols-4">
        <Stat label="Açık bulgu" value={stats.data?.openFlags ?? '…'} tone={stats.data?.openFlags ? 'red' : 'green'} /><Stat label="Son 24 saat" value={stats.data?.last24h ?? '…'} tone="amber" /><Stat label="Otomatik yaptırım (7 gün)" value={stats.data?.autoActions7d ?? '…'} tone="blue" />
        <Stat label="En sık tür (7 gün)" value={stats.data?.byType7d?.[0]?.type ?? '—'} sub={stats.data?.byType7d?.[0] ? `${stats.data.byType7d[0].count} kez` : ''} tone="gray" />
      </div>
      <Tabs active={tab} onChange={setTab} tabs={[{ id: 'flags', label: 'Bulgular', badge: stats.data?.openFlags }, { id: 'policy', label: 'Otomatik yaptırım politikası' }, { id: 'devices', label: 'Cihaz & IP yasakları' }]} />

      {tab === 'flags' && (
        <div className="grid gap-5 xl:grid-cols-[1fr_28rem]">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Select value={status} onChange={setStatus} options={[{ value: 'open', label: 'açık' }, { value: 'reviewed', label: 'incelenmiş' }, { value: '', label: 'hepsi' }]} />
              <Select value={severity} onChange={setSeverity} options={[{ value: '', label: 'tüm önem' }, { value: 'critical', label: 'kritik' }, { value: 'high', label: 'yüksek' }, { value: 'medium', label: 'orta' }, { value: 'low', label: 'düşük' }]} />
              <Select value={type} onChange={setType} options={[{ value: '', label: 'tüm türler' }, ...types.map((t) => ({ value: t, label: t }))]} />
            </div>
            <Table<Flag> rows={flags.data ?? []} empty={flags.isLoading ? 'Yükleniyor…' : 'Bulgu yok — temiz'} onRow={(r) => setSelected(r.id)} cols={[
              { label: 'Zaman', render: (r) => <div><div className="text-gray-300">{fmtAgo(r.createdAt)}</div><div className="text-xs text-gray-600">{fmtDate(r.createdAt)}</div></div> },
              { label: 'Oyuncu', render: (r) => <div className="flex items-center gap-2">{r.online && <span className="h-2 w-2 rounded-full bg-green-500" />}<span className="font-medium text-white">{r.username ?? r.userId.slice(0, 8)}</span></div> },
              { label: 'Tür', render: (r) => <span className="text-gray-200">{r.flagType}</span> },
              { label: 'Önem', render: (r) => <Pill tone={sevTone(r.severity)}>{r.severity}</Pill> },
              { label: 'Durum', render: (r) => (r.reviewNote?.startsWith('auto:') ? <Pill tone="red">otomatik: {r.reviewNote.slice(5)}</Pill> : r.reviewed ? <Pill tone="green">incelendi</Pill> : <Pill tone="amber">açık</Pill>) },
            ]} />
          </div>

          <div>
            {!selected ? <Card><div className="py-12 text-center text-gray-500">Bir bulgu seçin.</div></Card> : detail.isLoading ? <Card>Yükleniyor…</Card> : f && (
              <Card title={`${f.flagType} — ${detail.data?.profile?.username ?? ''}`} right={<Pill tone={sevTone(f.severity)}>{f.severity}</Pill>}>
                <p className="mb-4 text-xs text-gray-400">{TYPE_HELP[f.flagType] ?? ''}</p>
                <dl className="mb-4 grid grid-cols-[8rem_1fr] gap-y-1.5 text-sm">
                  <dt className="text-gray-500">Oyuncu</dt><dd><Link className="text-amber-400 hover:underline" href={`/dashboard/players/${f.userId}`}>{detail.data?.profile?.username ?? f.userId}</Link> {detail.data?.online && <Pill tone="green">çevrimiçi</Pill>}</dd>
                  <dt className="text-gray-500">Zaman</dt><dd className="text-gray-300">{fmtDate(f.createdAt)}</dd>
                  <dt className="text-gray-500">Maç</dt><dd className="break-all text-gray-300">{f.matchId ?? '—'}</dd>
                  <dt className="text-gray-500">IP</dt><dd className="text-gray-300">{ctx.ip ?? '—'}</dd>
                  <dt className="text-gray-500">Cihaz</dt><dd className="break-all text-gray-300">{ctx.deviceId ?? '—'}</dd>
                  <dt className="text-gray-500">Platform / sürüm</dt><dd className="text-gray-300">{ctx.platform ?? '—'} {ctx.appVersion ?? ''}</dd>
                  <dt className="text-gray-500">Kaynak</dt><dd className="text-gray-300">{ctx.source ?? 'sunucu'}</dd>
                  <dt className="text-gray-500">Maç / MMR</dt><dd className="text-gray-300">{detail.data?.profile ? `${detail.data.profile.totalMatches} maç · ${detail.data.profile.mmr} MMR` : '—'}</dd>
                </dl>
                <div className="mb-1 text-xs font-medium text-gray-400">Kanıt</div>
                <pre className="mb-4 max-h-48 overflow-auto rounded bg-gray-950 p-3 text-xs text-gray-300">{JSON.stringify(Object.fromEntries(Object.entries(f.data ?? {}).filter(([k]) => k !== 'ctx')), null, 2)}</pre>
                {detail.data?.activeBan && <Notice kind="error">Aktif yasak: {detail.data.activeBan.type} — {detail.data.activeBan.reason}</Notice>}
                {f.reviewNote && <div className="my-3 text-xs text-gray-400">Karar: {f.reviewNote} {f.reviewedBy ? `(${f.reviewedBy})` : ''}</div>}
                {detail.data && detail.data.otherFlagsOfPlayer.length > 1 && <div className="my-3 text-xs text-gray-400">Bu oyuncunun toplam {detail.data.otherFlagsOfPlayer.length} bulgusu var: {[...new Set(detail.data.otherFlagsOfPlayer.map((x) => x.flagType))].join(', ')}</div>}
                {writable && (
                  <div className="space-y-3 border-t border-gray-800 pt-4">
                    <Label text="Karar"><Select className="w-full" value={act.action} onChange={(v) => setAct({ ...act, action: v })} options={ACTIONS} /></Label>
                    {['ban_temp', 'ban_device'].includes(act.action) && <Label text={act.action === 'ban_device' ? 'Cihaz/IP engel süresi (saat, boş = kalıcı)' : 'Yasak süresi (saat)'}><TextInput type="number" value={act.hours} onChange={(e) => setAct({ ...act, hours: e.target.value })} /></Label>}
                    <Label text="Not (oyuncuya gösterilebilir)"><TextArea rows={2} value={act.note} onChange={(e) => setAct({ ...act, note: e.target.value })} /></Label>
                    <Btn variant={act.action === 'dismiss' ? 'success' : 'danger'} disabled={!act.note.trim() || resolve.isPending} onClick={() => { if (confirm('Karar uygulansın mı?')) resolve.mutate(); }}>Uygula</Btn>
                  </div>
                )}
              </Card>
            )}
          </div>
        </div>
      )}

      {tab === 'policy' && pol && (
        <Card title="Otomatik yaptırım politikası" right={<Btn disabled={!writable || savePol.isPending} onClick={() => savePol.mutate()}>Kaydet</Btn>}>
          <div className="mb-5"><Toggle checked={pol.autoEnforce} disabled={!writable} onChange={(v) => setPol({ ...pol, autoEnforce: v })} label="Otomatik yaptırım açık" hint="Kapalıysa motor yalnızca bulgu üretir, kimseyi kendiliğinden cezalandırmaz." /></div>
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-left text-xs uppercase text-gray-500"><tr><th className="py-2 pr-3">Tür</th><th className="pr-3">Önem</th><th className="pr-3">Otomatik ceza</th><th className="pr-3">Süre (sa)</th><th className="pr-3">Kaçıncı bulguda</th><th>Zaman penceresi (gün)</th></tr></thead>
            <tbody className="divide-y divide-gray-800">{Object.entries(pol.rules).map(([k, r]) => (
              <tr key={k}><td className="py-2 pr-3"><div className="font-medium text-white">{k}</div><div className="max-w-xs text-xs text-gray-500">{TYPE_HELP[k]}</div></td>
                <td className="pr-3"><Select value={r.severity} onChange={(v) => setPol({ ...pol, rules: { ...pol.rules, [k]: { ...r, severity: v } } })} options={['low', 'medium', 'high', 'critical'].map((x) => ({ value: x, label: x }))} /></td>
                <td className="pr-3"><Select value={r.auto?.type ?? ''} onChange={(v) => setPol({ ...pol, rules: { ...pol.rules, [k]: { ...r, auto: v ? { ...(r.auto ?? {}), type: v } : undefined } } })} options={[{ value: '', label: 'yok (sadece bulgu)' }, { value: 'kick', label: 'at' }, { value: 'ranked_ban', label: 'dereceliden yasakla' }, { value: 'temp_ban', label: 'süreli yasak' }, { value: 'perm_ban', label: 'kalıcı yasak' }]} /></td>
                <td className="pr-3"><TextInput type="number" className="w-20" disabled={r.auto?.type !== 'temp_ban'} value={r.auto?.hours ?? ''} onChange={(e) => setPol({ ...pol, rules: { ...pol.rules, [k]: { ...r, auto: { ...(r.auto as object), hours: Number(e.target.value) } as Rule['auto'] } } })} /></td>
                <td className="pr-3"><TextInput type="number" className="w-20" disabled={!r.auto} value={r.auto?.afterStrikes ?? ''} onChange={(e) => setPol({ ...pol, rules: { ...pol.rules, [k]: { ...r, auto: { ...(r.auto as object), afterStrikes: Number(e.target.value) } as Rule['auto'] } } })} /></td>
                <td><TextInput type="number" className="w-20" disabled={!r.auto} value={r.auto?.windowDays ?? ''} onChange={(e) => setPol({ ...pol, rules: { ...pol.rules, [k]: { ...r, auto: { ...(r.auto as object), windowDays: Number(e.target.value) } as Rule['auto'] } } })} /></td></tr>
            ))}</tbody></table></div>
        </Card>
      )}

      {tab === 'devices' && (
        <div className="space-y-5">
          {writable && <Card title="Cihaz / IP engelle"><div className="grid gap-3 md:grid-cols-5"><Label text="Cihaz kimliği"><TextInput value={nd.deviceId} onChange={(e) => setNd({ ...nd, deviceId: e.target.value })} /></Label><Label text="IP adresi"><TextInput value={nd.ip} onChange={(e) => setNd({ ...nd, ip: e.target.value })} /></Label><Label text="Neden"><TextInput value={nd.reason} onChange={(e) => setNd({ ...nd, reason: e.target.value })} /></Label><Label text="Süre (saat, boş = kalıcı)"><TextInput type="number" value={nd.hours} onChange={(e) => setNd({ ...nd, hours: e.target.value })} /></Label><div className="flex items-end"><Btn disabled={(!nd.deviceId && !nd.ip) || !nd.reason.trim() || addDev.isPending} onClick={() => addDev.mutate()}>Engelle</Btn></div></div><p className="mt-2 text-xs text-gray-500">Engellenen cihazdan hiçbir hesap oyuna giremez; yeni hesap açma (yasak atlatma) engellenir.</p></Card>}
          <Table<DeviceBan> rows={devs.data ?? []} empty="Engelli cihaz yok" cols={[{ label: 'Cihaz', render: (d) => <span className="break-all text-xs">{d.deviceId ?? '—'}</span> }, { label: 'IP', render: (d) => d.ip ?? '—' }, { label: 'Neden', render: (d) => d.reason }, { label: 'Tür', render: (d) => (d.auto ? <Pill tone="red">otomatik</Pill> : <Pill>elle</Pill>) }, { label: 'Bitiş', render: (d) => (d.until ? fmtDate(d.until) : 'kalıcı') }, { label: '', render: (d) => writable && <Btn size="sm" variant="ghost" onClick={() => delDev.mutate(d.id)}>Kaldır</Btn> }]} />
        </div>
      )}
    </div>
  );
}

export default function CheatCenterPage() { return <Suspense fallback={<div className="text-gray-400">Yükleniyor…</div>}><Inner /></Suspense>; }
