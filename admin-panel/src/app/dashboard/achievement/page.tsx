'use client';
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { errorMessage, get, post } from '@/lib/api';
import { canWrite } from '@/lib/permissions';
import { fmtNumber } from '@/lib/format';
import { Btn, Card, flashError, flashOk, Label, PageHeader, Pill, Select, Stat, Table, TextInput } from '@/components/kit/kit';

interface Def { id: string; name: string; description: string; category: string; xpReward: number; criteria: unknown }
interface Stats { totalDefinitions: number; totalUnlocks: number; rarestAchievements: { id: string; name: string; unlockRate: number }[] }

export default function AchievementsPage() {
  const { data: session } = useSession();
  const writable = canWrite((session as { role?: string } | null)?.role, 'liveops');
  const defs = useQuery({ queryKey: ['ach-defs'], queryFn: () => get<Def[]>('/achievements') });
  const stats = useQuery({ queryKey: ['ach-stats'], queryFn: () => get<Stats>('/achievements/stats') });
  const [g, setG] = useState({ userId: '', achievementId: '' });
  const grant = useMutation({ mutationFn: () => post(`/achievements/player/${g.userId.trim()}/grant`, { achievementId: g.achievementId }), onSuccess: () => flashOk('Başarım verildi.'), onError: (e) => flashError(errorMessage(e)) });
  return (
    <div className="space-y-6">
      <PageHeader title="Başarımlar" subtitle="Oyundaki başarım tanımları ve açılma oranları. Bir oyuncuya elle başarım verebilirsiniz (örn. etkinlik ödülü)." />
      <div className="grid gap-3 md:grid-cols-3"><Stat label="Tanım" value={stats.data?.totalDefinitions ?? '…'} tone="gray" /><Stat label="Toplam açılma" value={fmtNumber(stats.data?.totalUnlocks)} tone="green" /><Stat label="En nadir" value={stats.data?.rarestAchievements?.[0]?.name ?? '—'} sub={stats.data?.rarestAchievements?.[0] ? `%${Math.round(stats.data.rarestAchievements[0].unlockRate * 100)}` : ''} tone="amber" /></div>
      <Table<Def> rows={defs.data ?? []} empty={defs.isLoading ? 'Yükleniyor…' : 'Tanım yok'} cols={[{ label: 'Başarım', render: (d) => <div><div className="font-medium text-white">{d.name}</div><div className="text-xs text-gray-500">{d.description}</div></div> }, { label: 'Kategori', render: (d) => <Pill>{d.category}</Pill> }, { label: 'XP', render: (d) => d.xpReward }, { label: 'Kimlik', render: (d) => <span className="text-xs text-gray-500">{d.id}</span> }]} />
      {writable && <Card title="Oyuncuya başarım ver"><div className="grid gap-3 md:grid-cols-3"><Label text="Oyuncu kimliği"><TextInput value={g.userId} onChange={(e) => setG({ ...g, userId: e.target.value })} /></Label><Label text="Başarım"><Select className="w-full" value={g.achievementId} onChange={(v) => setG({ ...g, achievementId: v })} options={[{ value: '', label: 'seçin…' }, ...(defs.data ?? []).map((d) => ({ value: d.id, label: d.name }))]} /></Label><div className="flex items-end"><Btn disabled={!g.userId.trim() || !g.achievementId || grant.isPending} onClick={() => grant.mutate()}>Ver</Btn></div></div></Card>}
    </div>
  );
}
