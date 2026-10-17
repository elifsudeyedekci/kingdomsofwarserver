'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { del, errorMessage, get, post } from '@/lib/api';
import { canWrite } from '@/lib/permissions';
import { fmtAgo, fmtDate } from '@/lib/format';
import { Btn, Card, flashError, flashOk, Label, PageHeader, Pill, Select, sevTone, Stat, Table, Tabs, TextInput } from '@/components/kit/kit';

interface Ev { id: string; type: string; severity: string; ip: string | null; userAgent: string | null; adminId: string | null; detail: unknown; createdAt: string }
interface Block { id: string; ip: string; reason: string; until: string | null; auto: boolean; createdAt: string }
interface Sess { id: string; adminId: string; ip: string | null; userAgent: string | null; createdAt: string; lastUsedAt: string; expiresAt: string; limited: boolean }
interface Stats { last24h: Record<string, number>; blockedIps: number; activeAdminSessions: number }

const HELP: Record<string, string> = {
  LOGIN_FAILED: 'Yanlış parola / kod ile giriş denemesi', LOGIN_OK: 'Başarılı giriş', LOGIN_LOCKED: 'Hesap geçici kilitlendi (çok fazla hatalı deneme)', LOGIN_CAPTCHA_FAILED: 'Robot doğrulaması başarısız',
  REFRESH_TOKEN_REUSE: 'KRİTİK: çalınmış / eski oturum belirteci kullanıldı, oturum sonlandırıldı', ATTACK_SIGNATURE: 'İstekte saldırı imzası (yol gezme, SQL, script...) yakalandı', IP_AUTOBLOCK: 'IP otomatik engellendi',
  IP_BLOCK: 'IP elle engellendi', SESSION_IP_CHANGED: 'Oturum başka bir IP\'den yenilendi', PASSWORD_CHANGED: 'Parola değişti', TWO_FACTOR_ENABLED: '2FA açıldı', TWO_FACTOR_DISABLED: '2FA kapatıldı', RECOVERY_CODE_USED: 'Yedek kod kullanıldı',
};

export default function SecurityPage() {
  const { data: session } = useSession();
  const writable = canWrite((session as { role?: string } | null)?.role, 'security');
  const qc = useQueryClient();
  const [tab, setTab] = useState<'events' | 'blocks' | 'sessions'>('events');
  const [sev, setSev] = useState(''); const [type, setType] = useState(''); const [ip, setIp] = useState('');
  const stats = useQuery({ queryKey: ['sec-stats'], queryFn: () => get<Stats>('/security/stats'), refetchInterval: 30_000 });
  const events = useQuery({ queryKey: ['sec-events', sev, type, ip], queryFn: () => get<Ev[]>('/security/events', { severity: sev || undefined, type: type || undefined, ip: ip || undefined, take: 200 }), refetchInterval: 15_000, enabled: tab === 'events' });
  const blocks = useQuery({ queryKey: ['sec-blocks'], queryFn: () => get<Block[]>('/security/blocks'), enabled: tab === 'blocks' });
  const sess = useQuery({ queryKey: ['sec-sessions'], queryFn: () => get<Sess[]>('/security/sessions'), enabled: tab === 'sessions' });
  const [nb, setNb] = useState({ ip: '', reason: '', hours: '24', permanent: false });
  const add = useMutation({ mutationFn: () => post('/security/blocks', { ip: nb.ip, reason: nb.reason, hours: Number(nb.hours) || 24, permanent: nb.permanent }), onSuccess: () => { flashOk('IP engellendi.'); setNb({ ip: '', reason: '', hours: '24', permanent: false }); qc.invalidateQueries({ queryKey: ['sec-blocks'] }); }, onError: (e) => flashError(errorMessage(e)) });
  const unblock = useMutation({ mutationFn: (id: string) => del(`/security/blocks/${id}`), onSuccess: () => { flashOk('Engel kaldırıldı.'); qc.invalidateQueries({ queryKey: ['sec-blocks'] }); }, onError: (e) => flashError(errorMessage(e)) });
  const revoke = useMutation({ mutationFn: (sid: string) => del(`/security/sessions/${sid}`), onSuccess: () => { flashOk('Oturum sonlandırıldı.'); qc.invalidateQueries({ queryKey: ['sec-sessions'] }); }, onError: (e) => flashError(errorMessage(e)) });
  const s24 = stats.data?.last24h ?? {};
  const count = (k: string) => s24[k] ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader title="Güvenlik Merkezi" subtitle="Yönetim sisteminin güvenlik olayları: girişler, hatalı denemeler, çalıntı oturum alarmları, saldırı imzaları ve IP güvenlik duvarı. Otomatik koruma: çok sayıda şüpheli istek gönderen IP geçici olarak engellenir; oyuncu trafiği bundan etkilenmez." />
      <div className="grid gap-3 md:grid-cols-5">
        <Stat label="Hatalı giriş (24 sa)" value={count('LOGIN_FAILED')} tone={count('LOGIN_FAILED') > 10 ? 'red' : 'gray'} /><Stat label="Saldırı imzası (24 sa)" value={count('ATTACK_SIGNATURE')} tone={count('ATTACK_SIGNATURE') ? 'red' : 'gray'} />
        <Stat label="Çalıntı oturum alarmı" value={count('REFRESH_TOKEN_REUSE')} tone={count('REFRESH_TOKEN_REUSE') ? 'red' : 'green'} /><Stat label="Engelli IP" value={stats.data?.blockedIps ?? '…'} tone="amber" /><Stat label="Açık yönetici oturumu" value={stats.data?.activeAdminSessions ?? '…'} tone="blue" />
      </div>
      <Tabs active={tab} onChange={setTab} tabs={[{ id: 'events', label: 'Olaylar' }, { id: 'blocks', label: 'IP güvenlik duvarı' }, { id: 'sessions', label: 'Açık oturumlar' }]} />

      {tab === 'events' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Select value={sev} onChange={setSev} options={[{ value: '', label: 'tüm önem' }, { value: 'critical', label: 'kritik' }, { value: 'high', label: 'yüksek' }, { value: 'warn', label: 'uyarı' }, { value: 'info', label: 'bilgi' }]} />
            <Select value={type} onChange={setType} options={[{ value: '', label: 'tüm olaylar' }, ...Object.keys(HELP).map((t) => ({ value: t, label: t }))]} />
            <TextInput placeholder="IP filtre" className="w-44" value={ip} onChange={(e) => setIp(e.target.value)} />
          </div>
          <Table<Ev> rows={events.data ?? []} empty="Olay yok" cols={[
            { label: 'Zaman', render: (e) => <div><div className="text-gray-300">{fmtAgo(e.createdAt)}</div><div className="text-xs text-gray-600">{fmtDate(e.createdAt)}</div></div> },
            { label: 'Olay', render: (e) => <div><div className="text-white">{e.type}</div><div className="text-xs text-gray-500">{HELP[e.type]}</div></div> },
            { label: 'Önem', render: (e) => <Pill tone={sevTone(e.severity === 'warn' ? 'medium' : e.severity)}>{e.severity}</Pill> },
            { label: 'IP', render: (e) => <button className="text-xs text-amber-400 hover:underline" onClick={() => setIp(e.ip ?? '')}>{e.ip ?? '—'}</button> },
            { label: 'Ayrıntı', render: (e) => <span className="break-all text-xs text-gray-400">{e.detail ? JSON.stringify(e.detail).slice(0, 160) : ''}</span> },
          ]} />
        </div>
      )}

      {tab === 'blocks' && (
        <div className="space-y-5">
          {writable && <Card title="IP engelle"><div className="grid gap-3 md:grid-cols-5"><Label text="IP adresi"><TextInput value={nb.ip} onChange={(e) => setNb({ ...nb, ip: e.target.value })} placeholder="203.0.113.7" /></Label><Label text="Neden"><TextInput value={nb.reason} onChange={(e) => setNb({ ...nb, reason: e.target.value })} /></Label><Label text="Süre (saat)"><TextInput type="number" value={nb.hours} disabled={nb.permanent} onChange={(e) => setNb({ ...nb, hours: e.target.value })} /></Label><label className="flex items-end gap-2 pb-2 text-sm text-gray-300"><input type="checkbox" checked={nb.permanent} onChange={(e) => setNb({ ...nb, permanent: e.target.checked })} />kalıcı</label><div className="flex items-end"><Btn disabled={!nb.ip || !nb.reason.trim() || add.isPending} onClick={() => add.mutate()}>Engelle</Btn></div></div><p className="mt-2 text-xs text-gray-500">Elle yapılan engel hem yönetim sistemine hem oyun sunucusuna uygulanır. Otomatik engeller yalnızca yönetim yüzeyine uygulanır (ortak operatör IP'si kullanan oyuncular etkilenmesin diye).</p></Card>}
          <Table<Block> rows={blocks.data ?? []} empty="Engelli IP yok" cols={[{ label: 'IP', render: (b) => b.ip }, { label: 'Neden', render: (b) => b.reason }, { label: 'Tür', render: (b) => (b.auto ? <Pill tone="red">otomatik</Pill> : <Pill>elle</Pill>) }, { label: 'Bitiş', render: (b) => (b.until ? fmtDate(b.until) : 'kalıcı') }, { label: '', render: (b) => writable && <Btn size="sm" variant="ghost" onClick={() => unblock.mutate(b.id)}>Kaldır</Btn> }]} />
        </div>
      )}

      {tab === 'sessions' && (
        <Table<Sess> rows={sess.data ?? []} empty="Açık oturum yok" cols={[{ label: 'Yönetici', render: (s) => <span className="text-xs text-gray-400">{s.adminId.slice(0, 8)}…</span> }, { label: 'IP', render: (s) => s.ip ?? '—' }, { label: 'Tarayıcı', render: (s) => <span className="text-xs text-gray-500">{(s.userAgent ?? '').slice(0, 60)}</span> }, { label: 'Giriş', render: (s) => fmtDate(s.createdAt) }, { label: 'Son işlem', render: (s) => fmtAgo(s.lastUsedAt) }, { label: 'Biter', render: (s) => fmtDate(s.expiresAt) }, { label: '', render: (s) => (s.limited ? <Pill tone="amber">2FA bekliyor</Pill> : writable && <Btn size="sm" variant="danger" onClick={() => { if (confirm('Oturum sonlandırılsın mı?')) revoke.mutate(s.id); }}>Sonlandır</Btn>) }]} />
      )}
    </div>
  );
}
