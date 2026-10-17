'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { del, errorMessage, get, post } from '@/lib/api';
import { canWrite } from '@/lib/permissions';
import { fmtAgo, fmtDate, fmtDuration, fmtNumber, fmtUsd } from '@/lib/format';
import { Btn, Card, flashError, flashOk, Label, Notice, PageHeader, Pill, Select, sevTone, Stat, Table, Tabs, TextArea, TextInput } from '@/components/kit/kit';
import { GrantForm, type Rewards } from '@/components/kit/grant-form';

interface Session { id: string; startedAt: string; endedAt: string | null; seconds: number; menuSeconds: number; matchSeconds: number; platform: string | null; appVersion: string | null; ip: string | null; deviceId: string | null }
interface Inv { id: string; itemType: string; itemId: string; quantity: number; expiresAt: string | null; obtainedAt: string; source: string | null }
interface Bonus { id: string; kind: string; payload: unknown; usesLeft: number; expiresAt: string | null; source: string | null }
interface Gift { id: string; status: string; rewards: unknown; createdAt: string; title: Record<string, string> }
interface Ledger { id: string; currency: string; amount: number; balanceAfter: number; reason: string; source: string; createdAt: string }
interface Detail {
  userId: string; email: string | null; isGuest: boolean; isActive: boolean; country: string | null; language: string; registeredAt: string; lastLoginAt: string | null;
  profile: { username: string; displayName: string | null; level: number; xp: number; mmr: number; peakMmr: number; rank: string; clan: { id: string; name: string } | null; favoriteCivId: string | null; riskScore: number; isPremium: boolean } | null;
  online: { state: string; platform?: string; appVersion?: string; ip?: string; onlineSeconds: number; matchId?: string } | null;
  playtime: { totalSeconds: number; hours: number; menuSeconds: number; matchSeconds: number; sessions: number; avgSessionMinutes: number; sessionsLast7Days: number; lastSeenAt: string | null; platform: string | null; appVersion: string | null };
  sessions: Session[];
  matches: { total: number; wins: number; losses: number; winRate: number; avgDurationMinutes: number; byMode: Record<string, { played: number; won: number }>; byCiv: Record<string, { played: number; won: number }>; recent: { matchId: string; mode: string; mapId: string | null; civId: string | null; won: boolean | null; mmrDelta: number | null; surrendered: boolean; disconnected: boolean; at: string }[] };
  economy: { wallet: Record<string, number>; inventory: Inv[]; bonuses: Bonus[]; gifts: Gift[]; ledger: Ledger[]; purchases: { id: string; product: string; amountUsd: number; status: string; platform: string; at: string }[]; spentUsd: number };
  devices: { deviceId: string; platform: string; model: string | null; osVersion: string | null; appVersion: string | null; lastSeenAt: string }[];
  network: { distinctDevices: string[]; distinctIps: string[]; otherAccountsOnSameDeviceOrIp: { userId: string; username: string; sharedDevice: boolean; sharedIp: boolean }[] };
  moderation: { activeBan: { type: string; reason: string; endsAt: string | null } | null; antiCheatFlags: number; fraudFlags: number; reportsAgainst: number };
  social: { friends: number };
}
interface History { bans: { id: string; type: string; reason: string; evidence: string | null; bannedBy: string; startsAt: string; endsAt: string | null; isActive: boolean; liftNote: string | null }[]; antiCheatFlags: { id: string; flagType: string; severity: string; createdAt: string; reviewed: boolean; reviewNote: string | null }[]; reports: { id: string; type: string; reason: string; status: string; createdAt: string }[]; commands: { id: string; type: string; createdAt: string; deliveredAt: string | null; createdBy: string | null }[] }

type Tab = 'summary' | 'play' | 'matches' | 'economy' | 'moderation' | 'network';

export default function PlayerFilePage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const role = (session as { role?: string } | null)?.role;
  const mod = canWrite(role, 'moderation'), grant = canWrite(role, 'grants');
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('summary');
  const d = useQuery({ queryKey: ['player', id], queryFn: () => get<Detail>(`/insights/players/${id}`), refetchInterval: 20_000 });
  const h = useQuery({ queryKey: ['player-history', id], queryFn: () => get<History>(`/moderation/history/${id}`), enabled: tab === 'moderation' });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['player', id] }); qc.invalidateQueries({ queryKey: ['player-history', id] }); };
  const run = (label: string) => ({ onSuccess: () => { flashOk(label); refresh(); }, onError: (e: unknown) => flashError(errorMessage(e)) });

  const [kick, setKick] = useState({ reason: '', cooldown: '' });
  const [ban, setBan] = useState({ type: 'temporary', hours: '72', reason: '', evidence: '' });
  const [msg, setMsg] = useState({ title: '', body: '' });
  const [gift, setGift] = useState({ titleTr: '', titleEn: '', bodyTr: '', bodyEn: '', days: '30' });

  const kickM = useMutation({ mutationFn: () => post('/moderation/kick', { userId: id, reason: kick.reason, cooldownMinutes: kick.cooldown ? Number(kick.cooldown) : undefined }), ...run('Oyuncu oyundan atıldı (çevrimiçiyse bir saniye içinde).') });
  const banM = useMutation({ mutationFn: () => post('/moderation/ban', { userId: id, type: ban.type, hours: ban.type === 'temporary' ? Number(ban.hours) : undefined, reason: ban.reason, evidence: ban.evidence || undefined }), ...run('Yasak uygulandı. Oyuncu çevrimiçiyse oyunu anında kapatıldı.') });
  const unbanM = useMutation({ mutationFn: () => post('/moderation/unban', { userId: id, note: 'panelden kaldırıldı' }), ...run('Yasak kaldırıldı.') });
  const msgM = useMutation({ mutationFn: () => post('/moderation/message', { userId: id, title: msg.title, body: msg.body }), ...run('Mesaj oyuncunun oyununa gönderildi.') });
  const outM = useMutation({ mutationFn: () => post('/moderation/force-logout', { userId: id }), ...run('Tüm oturumları sonlandırıldı.') });
  const grantM = useMutation({ mutationFn: (v: { r: Rewards; reason: string }) => post('/grants/apply', { userId: id, rewards: v.r, reason: v.reason }), ...run('Verildi. Oyuncu çevrimiçiyse envanteri anında güncellenir.') });
  const giftM = useMutation({ mutationFn: (v: { r: Rewards; reason: string }) => post('/grants/gifts', { target: { userIds: [id] }, title: { tr: gift.titleTr || 'Hediye', en: gift.titleEn || gift.titleTr || 'Gift' }, body: { tr: gift.bodyTr || v.reason, en: gift.bodyEn || gift.bodyTr || v.reason }, rewards: v.r, expiresInDays: Number(gift.days) || undefined }), ...run('Hediye oyuncunun posta kutusuna bırakıldı.') });
  const revokeM = useMutation({ mutationFn: (inv: Inv) => post('/grants/revoke-item', { userId: id, inventoryId: inv.id, reason: 'panelden geri alındı' }), ...run('Eşya geri alındı.') });
  const bonusM = useMutation({ mutationFn: (b: Bonus) => del(`/grants/bonus/${id}/${b.id}`), ...run('Bonus silindi.') });

  if (d.isLoading) return <div className="text-gray-400">Yükleniyor…</div>;
  if (d.error || !d.data) return <Notice kind="error">Oyuncu açılamadı: {errorMessage(d.error)}</Notice>;
  const p = d.data; const name = p.profile?.username ?? p.userId;

  return (
    <div className="space-y-5">
      <PageHeader
        title={name}
        subtitle={`${p.email ?? 'e-posta yok'} · ${p.isGuest ? 'misafir hesap' : 'kayıtlı hesap'} · ${p.country ?? 'ülke bilinmiyor'} · dil ${p.language} · kayıt ${fmtDate(p.registeredAt)}`}
        actions={<>
          {p.online ? <Pill tone="green">çevrimiçi · {p.online.state === 'match' ? 'maçta' : 'menüde'}</Pill> : <Pill>çevrimdışı · {fmtAgo(p.playtime.lastSeenAt)}</Pill>}
          {p.moderation.activeBan && <Pill tone="red">YASAKLI ({p.moderation.activeBan.type})</Pill>}
          <Link href="/dashboard/players"><Btn variant="ghost" size="sm">← Liste</Btn></Link>
        </>}
      />
      {p.moderation.activeBan && <Notice kind="error">Aktif yasak: <b>{p.moderation.activeBan.type}</b> — {p.moderation.activeBan.reason}{p.moderation.activeBan.endsAt ? ` (bitiş ${fmtDate(p.moderation.activeBan.endsAt)})` : ' (süresiz)'}</Notice>}

      <Tabs<Tab> active={tab} onChange={setTab} tabs={[{ id: 'summary', label: 'Özet' }, { id: 'play', label: 'Oynama & Oturumlar' }, { id: 'matches', label: 'Maçlar' }, { id: 'economy', label: 'Ekonomi & Verme' }, { id: 'moderation', label: 'Moderasyon', badge: p.moderation.antiCheatFlags || undefined }, { id: 'network', label: 'Ağ & Cihaz', badge: p.network.otherAccountsOnSameDeviceOrIp.length || undefined }]} />

      {tab === 'summary' && (
        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-6">
            <Stat label="Toplam oynama" value={`${p.playtime.hours} sa`} sub={`${fmtNumber(p.playtime.sessions)} oturum`} />
            <Stat label="Maç" value={fmtNumber(p.matches.total)} sub={`${p.matches.wins}G / ${p.matches.losses}M · %${p.matches.winRate}`} tone="blue" />
            <Stat label="Derece" value={`${fmtNumber(p.profile?.mmr)} MMR`} sub={`${p.profile?.rank ?? ''} · en yüksek ${fmtNumber(p.profile?.peakMmr)}`} tone="green" />
            <Stat label="Seviye" value={p.profile?.level ?? 1} sub={`${fmtNumber(p.profile?.xp)} XP`} tone="gray" />
            <Stat label="Harcama" value={fmtUsd(p.economy.spentUsd)} sub={`${p.economy.purchases.length} satın alma`} tone="green" />
            <Stat label="Risk skoru" value={(p.profile?.riskScore ?? 0).toFixed(2)} sub={`${p.moderation.antiCheatFlags} hile · ${p.moderation.fraudFlags} fraud · ${p.moderation.reportsAgainst} şikâyet`} tone={p.moderation.antiCheatFlags ? 'red' : 'gray'} />
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Hesap"><dl className="grid grid-cols-2 gap-y-2 text-sm"><dt className="text-gray-500">Kimlik</dt><dd className="break-all text-gray-300">{p.userId}</dd><dt className="text-gray-500">Klan</dt><dd className="text-gray-300">{p.profile?.clan?.name ?? '—'}</dd><dt className="text-gray-500">Favori medeniyet</dt><dd className="text-gray-300">{p.profile?.favoriteCivId ?? '—'}</dd><dt className="text-gray-500">Premium</dt><dd className="text-gray-300">{p.profile?.isPremium ? 'evet' : 'hayır'}</dd><dt className="text-gray-500">Arkadaş</dt><dd className="text-gray-300">{p.social.friends}</dd><dt className="text-gray-500">Son giriş</dt><dd className="text-gray-300">{fmtDate(p.lastLoginAt)}</dd><dt className="text-gray-500">Platform / sürüm</dt><dd className="text-gray-300">{p.playtime.platform ?? '—'} {p.playtime.appVersion ?? ''}</dd></dl></Card>
            <Card title="Şu an">{p.online ? <dl className="grid grid-cols-2 gap-y-2 text-sm"><dt className="text-gray-500">Durum</dt><dd className="text-gray-300">{p.online.state === 'match' ? 'maçta' : 'menüde'}</dd><dt className="text-gray-500">Bağlı kalma</dt><dd className="text-gray-300">{fmtDuration(p.online.onlineSeconds)}</dd><dt className="text-gray-500">IP</dt><dd className="text-gray-300">{p.online.ip ?? '—'}</dd><dt className="text-gray-500">Maç</dt><dd className="break-all text-gray-300">{p.online.matchId ?? '—'}</dd></dl> : <div className="text-sm text-gray-500">Çevrimdışı. Son görülme {fmtAgo(p.playtime.lastSeenAt)}.</div>}</Card>
          </div>
        </div>
      )}

      {tab === 'play' && (
        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-4">
            <Stat label="Toplam" value={fmtDuration(p.playtime.totalSeconds)} /><Stat label="Menüde" value={fmtDuration(p.playtime.menuSeconds)} tone="gray" /><Stat label="Maçta" value={fmtDuration(p.playtime.matchSeconds)} tone="blue" /><Stat label="Ortalama oturum" value={`${p.playtime.avgSessionMinutes} dk`} sub={`son 7 günde ${p.playtime.sessionsLast7Days} oturum`} tone="green" />
          </div>
          <Card title="Son oturumlar (süre sunucu tarafından ölçülür)"><Table<Session> rows={p.sessions} cols={[{ label: 'Başlangıç', render: (s) => fmtDate(s.startedAt) }, { label: 'Süre', render: (s) => fmtDuration(s.seconds) }, { label: 'Menü / Maç', render: (s) => `${fmtDuration(s.menuSeconds)} / ${fmtDuration(s.matchSeconds)}` }, { label: 'Platform', render: (s) => `${s.platform ?? '—'} ${s.appVersion ?? ''}` }, { label: 'IP', render: (s) => s.ip ?? '—' }, { label: 'Cihaz', render: (s) => <span className="text-xs text-gray-500">{s.deviceId?.slice(0, 12) ?? '—'}</span> }, { label: '', render: (s) => (s.endedAt ? '' : <Pill tone="green">açık</Pill>) }]} /></Card>
        </div>
      )}

      {tab === 'matches' && (
        <div className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Mod bazında"><Table rows={Object.entries(p.matches.byMode)} cols={[{ label: 'Mod', render: ([m]) => m }, { label: 'Oynanan', render: ([, v]) => v.played }, { label: 'Kazanılan', render: ([, v]) => `${v.won} (%${Math.round((v.won / v.played) * 100)})` }]} /></Card>
            <Card title="Medeniyet bazında"><Table rows={Object.entries(p.matches.byCiv).sort((a, b) => b[1].played - a[1].played)} cols={[{ label: 'Medeniyet', render: ([c]) => c }, { label: 'Oynanan', render: ([, v]) => v.played }, { label: 'Kazanılan', render: ([, v]) => `${v.won} (%${Math.round((v.won / v.played) * 100)})` }]} /></Card>
          </div>
          <Card title={`Son maçlar (ortalama süre ${p.matches.avgDurationMinutes} dk)`}><Table rows={p.matches.recent} cols={[{ label: 'Tarih', render: (m) => fmtDate(m.at) }, { label: 'Mod', render: (m) => m.mode }, { label: 'Harita', render: (m) => m.mapId ?? '—' }, { label: 'Medeniyet', render: (m) => m.civId ?? '—' }, { label: 'Sonuç', render: (m) => (m.won === null ? '—' : m.won ? <Pill tone="green">galibiyet</Pill> : <Pill tone="red">mağlubiyet</Pill>) }, { label: 'MMR', render: (m) => (m.mmrDelta === null ? '—' : m.mmrDelta > 0 ? `+${m.mmrDelta}` : m.mmrDelta) }, { label: 'Not', render: (m) => [m.surrendered && 'pes etti', m.disconnected && 'koptu'].filter(Boolean).join(', ') }]} /></Card>
        </div>
      )}

      {tab === 'economy' && (
        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-5">{[['coins', 'Altın'], ['gems', 'Mücevher'], ['chestKeys', 'Sandık anahtarı'], ['eventTokens', 'Etkinlik jetonu'], ['bpXp', 'Battle Pass XP']].map(([k, l]) => <Stat key={k} label={l} value={fmtNumber(p.economy.wallet[k])} tone="amber" />)}</div>
          {grant ? (
            <Card title="Oyuncuya ver">
              <GrantForm submitLabel="Şimdi ver (anında)" busy={grantM.isPending} onSubmit={(r, reason) => grantM.mutate({ r, reason })} />
              <details className="mt-5 border-t border-gray-800 pt-4"><summary className="cursor-pointer text-sm text-amber-400">…ya da posta kutusuna hediye olarak bırak</summary>
                <div className="mt-3 grid gap-3 md:grid-cols-2"><Label text="Başlık (TR)"><TextInput value={gift.titleTr} onChange={(e) => setGift({ ...gift, titleTr: e.target.value })} /></Label><Label text="Başlık (EN)"><TextInput value={gift.titleEn} onChange={(e) => setGift({ ...gift, titleEn: e.target.value })} /></Label><Label text="Mesaj (TR)"><TextArea rows={2} value={gift.bodyTr} onChange={(e) => setGift({ ...gift, bodyTr: e.target.value })} /></Label><Label text="Mesaj (EN)"><TextArea rows={2} value={gift.bodyEn} onChange={(e) => setGift({ ...gift, bodyEn: e.target.value })} /></Label><Label text="Kaç gün içinde alınmalı"><TextInput type="number" value={gift.days} onChange={(e) => setGift({ ...gift, days: e.target.value })} /></Label></div>
                <div className="mt-4"><GrantForm submitLabel="Hediye olarak gönder" busy={giftM.isPending} onSubmit={(r, reason) => giftM.mutate({ r, reason })} /></div>
              </details>
            </Card>
          ) : <Notice kind="warn">Rolünüz oyunculara bir şey veremez.</Notice>}
          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Envanter"><Table<Inv> rows={p.economy.inventory} empty="Boş" cols={[{ label: 'Tür', render: (i) => <Pill tone={i.itemType === 'pack' ? 'purple' : 'gray'}>{i.itemType}</Pill> }, { label: 'Kimlik', render: (i) => i.itemId }, { label: 'Adet', render: (i) => i.quantity }, { label: 'Bitiş', render: (i) => (i.expiresAt ? fmtDate(i.expiresAt) : 'kalıcı') }, { label: 'Kaynak', render: (i) => <span className="text-xs text-gray-500">{i.source}</span> }, { label: '', render: (i) => grant && <Btn size="sm" variant="danger" onClick={() => { if (confirm('Eşya geri alınsın mı?')) revokeM.mutate(i); }}>Geri al</Btn> }]} /></Card>
            <Card title="Başlangıç bonusları (kaynak / asker)"><Table<Bonus> rows={p.economy.bonuses} empty="Aktif bonus yok" cols={[{ label: 'Tür', render: (b) => (b.kind === 'starting_units' ? 'başlangıç askeri' : 'başlangıç kaynağı') }, { label: 'İçerik', render: (b) => <span className="text-xs text-gray-300">{JSON.stringify(b.payload)}</span> }, { label: 'Kalan', render: (b) => `${b.usesLeft} maç` }, { label: '', render: (b) => grant && <Btn size="sm" variant="danger" onClick={() => bonusM.mutate(b)}>Sil</Btn> }]} /></Card>
          </div>
          <Card title="Posta kutusu / hediyeler"><Table<Gift> rows={p.economy.gifts} empty="Hediye yok" cols={[{ label: 'Tarih', render: (g) => fmtDate(g.createdAt) }, { label: 'Başlık', render: (g) => g.title.tr ?? g.title.en }, { label: 'İçerik', render: (g) => <span className="text-xs text-gray-400">{JSON.stringify(g.rewards)}</span> }, { label: 'Durum', render: (g) => <Pill tone={g.status === 'claimed' ? 'green' : g.status === 'pending' ? 'amber' : 'gray'}>{g.status}</Pill> }]} /></Card>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Bakiye defteri (son 30)"><Table<Ledger> rows={p.economy.ledger} empty="Hareket yok" cols={[{ label: 'Tarih', render: (l) => fmtDate(l.createdAt) }, { label: 'Birim', render: (l) => l.currency }, { label: 'Değişim', render: (l) => <span className={l.amount >= 0 ? 'text-green-400' : 'text-red-400'}>{l.amount > 0 ? '+' : ''}{l.amount}</span> }, { label: 'Bakiye', render: (l) => l.balanceAfter }, { label: 'Neden', render: (l) => <span className="text-xs text-gray-400">{l.source}: {l.reason}</span> }]} /></Card>
            <Card title="Satın almalar"><Table rows={p.economy.purchases} empty="Satın alma yok" cols={[{ label: 'Tarih', render: (x) => fmtDate(x.at) }, { label: 'Ürün', render: (x) => x.product }, { label: 'Tutar', render: (x) => fmtUsd(x.amountUsd) }, { label: 'Durum', render: (x) => <Pill tone={x.status === 'verified' ? 'green' : 'gray'}>{x.status}</Pill> }]} /></Card>
          </div>
        </div>
      )}

      {tab === 'moderation' && (
        <div className="space-y-5">
          {!mod && <Notice kind="warn">Rolünüz moderasyon işlemi yapamaz; yalnızca geçmişi görebilirsiniz.</Notice>}
          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Oyundan at (kick)">
              <p className="mb-3 text-xs text-gray-500">Oyuncu çevrimiçiyse oyunu bir saniye içinde kapanır ve oturumları sonlanır. İsterseniz kısa bir bekleme süresi (cool-down) verin, o süre yeniden giremesin.</p>
              <div className="space-y-3"><Label text="Neden (oyuncuya gösterilir)"><TextInput value={kick.reason} onChange={(e) => setKick({ ...kick, reason: e.target.value })} /></Label><Label text="Bekleme süresi (dk, isteğe bağlı)"><TextInput type="number" value={kick.cooldown} onChange={(e) => setKick({ ...kick, cooldown: e.target.value })} /></Label><Btn variant="warn" disabled={!mod || !kick.reason.trim() || kickM.isPending} onClick={() => kickM.mutate()}>At</Btn></div>
            </Card>
            <Card title="Yasakla (ban)">
              <p className="mb-3 text-xs text-gray-500">Süreli ya da süresiz yasak oyuncuyu oyundan tamamen engeller: giriş yapamaz, çevrimiçiyse anında atılır. "Yalnızca dereceli" yalnızca dereceli kuyruğu kapatır.</p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3"><Label text="Tür"><Select className="w-full" value={ban.type} onChange={(v) => setBan({ ...ban, type: v })} options={[{ value: 'temporary', label: 'Süreli' }, { value: 'permanent', label: 'Süresiz (kalıcı)' }, { value: 'ranked_only', label: 'Yalnızca dereceli' }]} /></Label>{ban.type === 'temporary' && <Label text="Süre (saat)"><TextInput type="number" value={ban.hours} onChange={(e) => setBan({ ...ban, hours: e.target.value })} /></Label>}</div>
                <Label text="Neden (oyuncuya gösterilir)"><TextInput value={ban.reason} onChange={(e) => setBan({ ...ban, reason: e.target.value })} /></Label>
                <Label text="Kanıt / iç not"><TextArea rows={2} value={ban.evidence} onChange={(e) => setBan({ ...ban, evidence: e.target.value })} /></Label>
                <div className="flex gap-2"><Btn variant="danger" disabled={!mod || !ban.reason.trim() || banM.isPending} onClick={() => { if (confirm(`${name} yasaklansın mı?`)) banM.mutate(); }}>Yasakla</Btn>{p.moderation.activeBan && <Btn variant="success" disabled={!mod || unbanM.isPending} onClick={() => unbanM.mutate()}>Yasağı kaldır</Btn>}</div>
              </div>
            </Card>
            <Card title="Mesaj gönder">
              <div className="space-y-3"><Label text="Başlık"><TextInput value={msg.title} onChange={(e) => setMsg({ ...msg, title: e.target.value })} /></Label><Label text="Mesaj"><TextArea rows={3} value={msg.body} onChange={(e) => setMsg({ ...msg, body: e.target.value })} /></Label><Btn disabled={!mod || !msg.title.trim() || !msg.body.trim() || msgM.isPending} onClick={() => msgM.mutate()}>Oyuncunun ekranına gönder</Btn></div>
            </Card>
            <Card title="Diğer"><Btn variant="ghost" disabled={!mod || outM.isPending} onClick={() => { if (confirm('Tüm oturumları sonlandırılsın mı? (oyuncu yeniden giriş yapmak zorunda kalır)')) outM.mutate(); }}>Tüm oturumlarını sonlandır</Btn></Card>
          </div>
          <Card title="Hile bulguları"><Table rows={h.data?.antiCheatFlags ?? []} empty="Bulgu yok" cols={[{ label: 'Tarih', render: (f) => fmtDate(f.createdAt) }, { label: 'Tür', render: (f) => f.flagType }, { label: 'Önem', render: (f) => <Pill tone={sevTone(f.severity)}>{f.severity}</Pill> }, { label: 'Durum', render: (f) => (f.reviewed ? <Pill tone="green">incelendi</Pill> : <Pill tone="amber">açık</Pill>) }, { label: 'Not', render: (f) => <span className="text-xs text-gray-400">{f.reviewNote}</span> }, { label: '', render: (f) => <Link href={`/dashboard/cheat-center?flag=${f.id}`}><Btn size="sm" variant="ghost">Aç</Btn></Link> }]} /></Card>
          <Card title="Yasak geçmişi"><Table rows={h.data?.bans ?? []} empty="Yasak yok" cols={[{ label: 'Tarih', render: (b) => fmtDate(b.startsAt) }, { label: 'Tür', render: (b) => <Pill tone={b.isActive ? 'red' : 'gray'}>{b.type}</Pill> }, { label: 'Neden', render: (b) => b.reason }, { label: 'Kanıt', render: (b) => <span className="text-xs text-gray-400">{b.evidence}</span> }, { label: 'Yasaklayan', render: (b) => <span className="text-xs">{b.bannedBy}</span> }, { label: 'Bitiş', render: (b) => (b.endsAt ? fmtDate(b.endsAt) : 'süresiz') }, { label: 'Durum', render: (b) => (b.isActive ? 'aktif' : b.liftNote ?? 'bitti') }]} /></Card>
          <Card title="Şikâyetler"><Table rows={h.data?.reports ?? []} empty="Şikâyet yok" cols={[{ label: 'Tarih', render: (r) => fmtDate(r.createdAt) }, { label: 'Tür', render: (r) => r.type }, { label: 'Neden', render: (r) => r.reason }, { label: 'Durum', render: (r) => r.status }]} /></Card>
          <Card title="Oyuna gönderilen komutlar (kick / ban / mesaj)"><Table rows={h.data?.commands ?? []} empty="Komut yok" cols={[{ label: 'Tarih', render: (c) => fmtDate(c.createdAt) }, { label: 'Komut', render: (c) => c.type }, { label: 'Gönderen', render: (c) => c.createdBy ?? '—' }, { label: 'Teslim', render: (c) => (c.deliveredAt ? <Pill tone="green">iletildi</Pill> : <Pill tone="amber">bekliyor</Pill>) }]} /></Card>
        </div>
      )}

      {tab === 'network' && (
        <div className="space-y-5">
          {p.network.otherAccountsOnSameDeviceOrIp.length > 0 && <Notice kind="warn">Bu oyuncu, {p.network.otherAccountsOnSameDeviceOrIp.length} başka hesapla aynı cihazı veya IP adresini paylaşıyor (yan hesap / yasak atlatma / hile ortaklığı belirtisi olabilir).</Notice>}
          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Aynı cihaz / IP'yi kullanan diğer hesaplar"><Table rows={p.network.otherAccountsOnSameDeviceOrIp} empty="Yok" cols={[{ label: 'Oyuncu', render: (o) => <Link className="text-amber-400 hover:underline" href={`/dashboard/players/${o.userId}`}>{o.username}</Link> }, { label: 'Ortak', render: (o) => [o.sharedDevice && 'cihaz', o.sharedIp && 'IP'].filter(Boolean).join(' + ') }]} /></Card>
            <Card title="Kullanılan IP adresleri (son 90 gün)"><ul className="space-y-1 text-sm text-gray-300">{p.network.distinctIps.map((ip) => <li key={ip}>{ip}</li>)}{!p.network.distinctIps.length && <li className="text-gray-500">—</li>}</ul></Card>
          </div>
          <Card title="Cihazlar"><Table rows={p.devices} empty="Kayıtlı cihaz yok" cols={[{ label: 'Cihaz', render: (x) => <span className="text-xs">{x.deviceId}</span> }, { label: 'Platform', render: (x) => x.platform }, { label: 'Model', render: (x) => `${x.model ?? '—'} ${x.osVersion ?? ''}` }, { label: 'Sürüm', render: (x) => x.appVersion ?? '—' }, { label: 'Son görülme', render: (x) => fmtAgo(x.lastSeenAt) }]} /></Card>
          <Card title="Oturumlarda görülen cihaz kimlikleri"><ul className="space-y-1 text-sm text-gray-300">{p.network.distinctDevices.map((x) => <li key={x} className="break-all">{x}</li>)}{!p.network.distinctDevices.length && <li className="text-gray-500">—</li>}</ul></Card>
        </div>
      )}
    </div>
  );
}
