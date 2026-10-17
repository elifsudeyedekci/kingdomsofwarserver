'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { errorMessage, get, patch, post } from '@/lib/api';
import { canWrite, ROLE_LABEL } from '@/lib/permissions';
import { fmtAgo } from '@/lib/format';
import { Btn, Card, flashError, flashOk, Label, Notice, PageHeader, Pill, Select, Table, TextInput } from '@/components/kit/kit';

interface Admin { id: string; email: string; name: string; role: string; isActive: boolean; twoFactorEnabled: boolean; lastLoginAt: string | null }
const ROLE_HELP: Record<string, string> = {
  owner: 'Her şeyi yapabilir (yalnızca sahip, sahip/süper yönetici oluşturabilir).', super_admin: 'Her şeyi yapabilir.', developer: 'Teknik ayarlar, veri yamaları, güvenlik, yönetici hesapları, yedekleme.',
  game_designer: 'Oyun verisi/denge yamaları, uzak ayarlar, metinler.', live_ops: 'Canlı kontrol, duyurular, etkinlikler, hediyeler, mağaza.', support: 'Oyuncu desteği: dosya, verme, uyarı, ban.', moderator: 'Moderasyon, hile merkezi, güvenlik olayları (okuma).',
  finance: 'Ödemeler, maliyet, iade, mağaza fiyatları.', marketing: 'Bildirimler, duyurular, mağaza metinleri.', analyst: 'Yalnızca okuma ve raporlar.',
};

export default function AdminsPage() {
  const { data: session } = useSession();
  const writable = canWrite((session as { role?: string } | null)?.role, 'admins');
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['admins'], queryFn: () => get<Admin[]>('/admins') });
  const roles = useQuery({ queryKey: ['admin-roles'], queryFn: () => get<{ roles: string[] }>('/admins/roles') });
  const [f, setF] = useState({ email: '', name: '', password: '', role: 'support' });
  const refresh = () => qc.invalidateQueries({ queryKey: ['admins'] });
  const create = useMutation({ mutationFn: () => post('/admins', f), onSuccess: () => { flashOk('Yönetici oluşturuldu. İlk girişte 2FA kurması istenecek.'); setF({ email: '', name: '', password: '', role: 'support' }); refresh(); }, onError: (e) => flashError(errorMessage(e)) });
  const upd = useMutation({ mutationFn: (v: { id: string; body: Record<string, unknown> }) => patch(`/admins/${v.id}`, v.body), onSuccess: () => { flashOk('Güncellendi (hesabın açık oturumları kapatıldı).'); refresh(); }, onError: (e) => flashError(errorMessage(e)) });
  const roleOpts = (roles.data?.roles ?? []).map((r) => ({ value: r, label: ROLE_LABEL[r] ?? r }));

  return (
    <div className="space-y-6">
      <PageHeader title="Yönetici Hesapları" subtitle="Panele girebilen kişiler ve yetkileri. Rol, kişinin neleri görebileceğini ve değiştirebileceğini belirler (yetki sunucuda her istekte denetlenir). Rol/parola değişince ya da hesap kapatılınca kişinin açık oturumları anında sonlanır." />
      {!writable && <Notice kind="warn">Rolünüz yönetici hesaplarını yalnızca görüntüleyebilir.</Notice>}
      {writable && (
        <Card title="Yeni yönetici">
          <div className="grid gap-3 md:grid-cols-4"><Label text="Ad"><TextInput value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Label><Label text="E-posta"><TextInput type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Label><Label text="Geçici parola" hint="≥12 karakter, büyük+küçük harf+rakam"><TextInput type="password" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Label><Label text="Rol"><Select className="w-full" value={f.role} onChange={(v) => setF({ ...f, role: v })} options={roleOpts} /></Label></div>
          <p className="mt-2 text-xs text-gray-500">{ROLE_HELP[f.role]}</p>
          <div className="mt-3"><Btn disabled={!f.name || !f.email || !f.password || create.isPending} onClick={() => create.mutate()}>Oluştur</Btn></div>
        </Card>
      )}
      <Table<Admin> rows={list.data ?? []} empty="Yönetici yok" cols={[
        { label: 'Kişi', render: (a) => <div><div className="font-medium text-white">{a.name}</div><div className="text-xs text-gray-500">{a.email}</div></div> },
        { label: 'Rol', render: (a) => writable ? <Select value={a.role} onChange={(v) => { if (confirm(`${a.name} rolü değişsin mi?`)) upd.mutate({ id: a.id, body: { role: v } }); }} options={roleOpts} /> : <Pill tone="amber">{ROLE_LABEL[a.role] ?? a.role}</Pill> },
        { label: '2FA', render: (a) => (a.twoFactorEnabled ? <Pill tone="green">açık</Pill> : <Pill tone="red">kapalı</Pill>) },
        { label: 'Son giriş', render: (a) => fmtAgo(a.lastLoginAt) },
        { label: 'Durum', render: (a) => (a.isActive ? <Pill tone="green">aktif</Pill> : <Pill>kapalı</Pill>) },
        { label: '', render: (a) => writable && <div className="flex flex-wrap gap-1"><Btn size="sm" variant="ghost" onClick={() => upd.mutate({ id: a.id, body: { isActive: !a.isActive } })}>{a.isActive ? 'Kapat' : 'Aç'}</Btn><Btn size="sm" variant="ghost" onClick={() => { const p = prompt('Yeni parola (≥12, büyük+küçük+rakam):'); if (p) upd.mutate({ id: a.id, body: { password: p } }); }}>Parola sıfırla</Btn>{a.twoFactorEnabled && <Btn size="sm" variant="ghost" onClick={() => { if (confirm('2FA sıfırlansın mı? (kişi yeniden kuracak)')) upd.mutate({ id: a.id, body: { resetTwoFactor: true } }); }}>2FA sıfırla</Btn>}</div> },
      ]} />
      <Card title="Roller ne yapabilir?"><ul className="grid gap-2 text-sm md:grid-cols-2">{Object.entries(ROLE_HELP).map(([r, h]) => <li key={r}><span className="font-medium text-amber-300">{ROLE_LABEL[r]}</span> <span className="text-gray-400">— {h}</span></li>)}</ul></Card>
    </div>
  );
}
