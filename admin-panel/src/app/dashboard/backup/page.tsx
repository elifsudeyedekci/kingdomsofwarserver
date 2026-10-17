'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { errorMessage, get, post } from '@/lib/api';
import { canWrite } from '@/lib/permissions';
import { fmtAgo, fmtDate } from '@/lib/format';
import { Btn, flashError, flashOk, Notice, PageHeader, Pill, Stat, Table } from '@/components/kit/kit';

interface B { id: string; type: string; status: string; startedAt: string; completedAt: string | null; fileSize: number | null; filePath: string | null; createdBy: string | null }
interface Stats { total: number; completed: number; failed: number; pending: number; successRate: number | null; lastBackup: { startedAt: string; status: string } | null }
const tone = (s: string) => (s === 'completed' ? 'green' : s === 'failed' ? 'red' : 'amber') as 'green' | 'red' | 'amber';

export default function BackupPage() {
  const { data: session } = useSession();
  const writable = canWrite((session as { role?: string } | null)?.role, 'backup');
  const qc = useQueryClient();
  const stats = useQuery({ queryKey: ['bk-stats'], queryFn: () => get<Stats>('/backup/stats'), refetchInterval: 30_000 });
  const list = useQuery({ queryKey: ['backups'], queryFn: () => get<{ items: B[] }>('/backup', { limit: 50 }), refetchInterval: 30_000 });
  const trigger = useMutation({ mutationFn: () => post('/backup', { type: 'full' }), onSuccess: () => { flashOk('Yedek isteği kaydedildi. Sunucudaki yedekleme betiği bir sonraki turunda alır.'); qc.invalidateQueries({ queryKey: ['backups'] }); }, onError: (e) => flashError(errorMessage(e)) });
  const s = stats.data;
  return (
    <div className="space-y-6">
      <PageHeader title="Yedekleme" subtitle="Veritabanı yedekleri. Yedeği sunucudaki yedekleme betiği alır (dağıtım paketindeki cron / docker servisi) ve sonucu buraya bildirir; bu sayfa yalnızca durumu gösterir ve yeni yedek ister." actions={<Btn disabled={!writable || trigger.isPending} onClick={() => trigger.mutate()}>Şimdi yedek iste</Btn>} />
      {s && !s.lastBackup && <Notice kind="error"><b>Hiç tamamlanmış yedek yok.</b> Yedekleme betiği kurulu ve çalışıyor mu kontrol edin (dağıtım rehberi). Yedeksiz canlıya çıkmayın.</Notice>}
      <div className="grid gap-3 md:grid-cols-4"><Stat label="Toplam" value={s?.total ?? '…'} tone="gray" /><Stat label="Tamamlanan" value={s?.completed ?? '…'} tone="green" /><Stat label="Başarısız" value={s?.failed ?? '…'} tone={s?.failed ? 'red' : 'gray'} /><Stat label="Son yedek" value={s?.lastBackup ? fmtAgo(s.lastBackup.startedAt) : 'YOK'} tone={s?.lastBackup ? 'green' : 'red'} /></div>
      <Table<B> rows={list.data?.items ?? []} empty={list.isLoading ? 'Yükleniyor…' : 'Kayıt yok'} cols={[{ label: 'Başlangıç', render: (b) => fmtDate(b.startedAt) }, { label: 'Tür', render: (b) => b.type }, { label: 'Durum', render: (b) => <Pill tone={tone(b.status)}>{b.status}</Pill> }, { label: 'Boyut', render: (b) => (b.fileSize ? `${Math.round(b.fileSize / 1048576)} MB` : '—') }, { label: 'Dosya', render: (b) => <span className="break-all text-xs text-gray-500">{b.filePath ?? ''}</span> }, ]} />
    </div>
  );
}
