'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { errorMessage, get, post } from '@/lib/api';
import { canWrite } from '@/lib/permissions';
import { Btn, Card, flashError, flashOk, Label, Notice, PageHeader, Pill, Stat, Table, TextInput } from '@/components/kit/kit';

interface Season { id: string; number: number; name: string; bpMaxLevel: number }
interface Stats { players: number; premium: number; premiumRate: number; avgLevel: number; avgXp: number; maxLevel: number; top: { userId: string; level: number; xp: number; isPremium: boolean }[] }

export default function BattlePassPage() {
  const { data: session } = useSession();
  const writable = canWrite((session as { role?: string } | null)?.role, 'liveops');
  const season = useQuery({ queryKey: ['active-season'], queryFn: () => get<Season | ''>('/liveops/season/active') });
  const sid = season.data ? (season.data as Season).id : null;
  const stats = useQuery({ queryKey: ['bp-stats', sid], queryFn: () => get<Stats>(`/liveops/battle-pass/stats/${sid}`), enabled: !!sid });
  const [g, setG] = useState({ userId: '', xp: '500' });
  const grant = useMutation({ mutationFn: () => post(`/liveops/battle-pass/${g.userId.trim()}/${sid}/xp`, { xp: Number(g.xp) }), onSuccess: () => flashOk('Battle Pass XP verildi.'), onError: (e) => flashError(errorMessage(e)) });
  const s = stats.data;
  return (
    <div className="space-y-6">
      <PageHeader title="Battle Pass" subtitle="Aktif sezonun Battle Pass durumu. Bir oyuncuya XP vermek için oyuncunun kimliğini (oyuncu dosyasının adres çubuğundaki kod) yazın; ya da oyuncu dosyasından 'Battle Pass XP' ver." />
      {!sid && <Notice kind="warn">Aktif sezon yok. Önce <Link href="/dashboard/liveops/seasons" className="underline">Sezonlar</Link> sayfasından bir sezon aktif edin.</Notice>}
      {sid && s && (<><div className="grid gap-3 md:grid-cols-5"><Stat label="Sezon" value={(season.data as Season).name} tone="gray" /><Stat label="Katılan oyuncu" value={s.players} tone="blue" /><Stat label="Premium" value={s.premium} sub={`%${s.premiumRate}`} tone="green" /><Stat label="Ortalama seviye" value={s.avgLevel} tone="amber" /><Stat label="En yüksek seviye" value={`${s.maxLevel} / ${(season.data as Season).bpMaxLevel}`} tone="gray" /></div>
        <Card title="En ilerideki 10 oyuncu"><Table rows={s.top} empty="Henüz kimse yok" cols={[{ label: 'Oyuncu', render: (t) => <Link className="text-amber-400 hover:underline" href={`/dashboard/players/${t.userId}`}>{t.userId.slice(0, 8)}…</Link> }, { label: 'Seviye', render: (t) => t.level }, { label: 'XP', render: (t) => t.xp }, { label: 'Premium', render: (t) => (t.isPremium ? <Pill tone="green">evet</Pill> : '—') }]} /></Card></>)}
      {sid && writable && <Card title="Oyuncuya Battle Pass XP ver"><div className="grid gap-3 md:grid-cols-3"><Label text="Oyuncu kimliği"><TextInput value={g.userId} onChange={(e) => setG({ ...g, userId: e.target.value })} /></Label><Label text="XP"><TextInput type="number" value={g.xp} onChange={(e) => setG({ ...g, xp: e.target.value })} /></Label><div className="flex items-end"><Btn disabled={!g.userId.trim() || !Number(g.xp) || grant.isPending} onClick={() => grant.mutate()}>XP ver</Btn></div></div></Card>}
    </div>
  );
}
