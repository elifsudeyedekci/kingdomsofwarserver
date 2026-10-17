'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { api, errorMessage, get, patch } from '@/lib/api';
import { canWrite } from '@/lib/permissions';
import { fmtDate } from '@/lib/format';
import { Btn, Notice, PageHeader, Pill, Select, Table } from '@/components/kit/kit';

interface Req { id: string; userId: string; type: string; status: string; createdAt: string; completedAt: string | null; resultUrl: string | null }
const tone = (s: string) => (s === 'completed' ? 'green' : s === 'pending' ? 'amber' : 'blue') as 'green' | 'amber' | 'blue';

export default function PrivacyRequestsPage() {
  const { data: session } = useSession();
  const writable = canWrite((session as { role?: string } | null)?.role, 'legal');
  const qc = useQueryClient(); const [status, setStatus] = useState('');
  const list = useQuery({ queryKey: ['privacy-requests', status], queryFn: () => get<{ data: Req[] }>('/legal/privacy-requests', { status: status || undefined, limit: 100 }) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['privacy-requests'] });
  const ok = (m: string) => ({ onSuccess: () => { alert(m); refresh(); }, onError: (e: unknown) => alert(errorMessage(e)) });
  const start = useMutation({ mutationFn: (id: string) => patch(`/legal/privacy-requests/${id}/start`), ...ok('İşleme alındı.') });
  const doExport = useMutation({ mutationFn: async (id: string) => { const data = await api.get(`/legal/privacy-requests/${id}/export`).then((r) => r.data); const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `oyuncu-verisi-${id.slice(0, 8)}.json`; a.click(); await patch(`/legal/privacy-requests/${id}/complete-export`, {}); }, ...ok('Veri dışa aktarıldı ve dosya indirildi; talep tamamlandı.') });
  const doDelete = useMutation({ mutationFn: (id: string) => patch(`/legal/privacy-requests/${id}/complete-delete`), ...ok('Kişisel veriler SİLİNDİ / anonimleştirildi; talep tamamlandı.') });
  return (
    <div className="space-y-5">
      <PageHeader title="Gizlilik Talepleri (KVKK / GDPR)" subtitle="Oyuncuların veri erişim ve silme talepleri. 'Dışa aktar' oyuncunun saklanan tüm verisini JSON olarak indirir. 'Sil' kişisel verileri (e-posta, cihaz, IP, oturum, destek yazışması...) KALICI olarak siler ya da anonimleştirir; maç ve ödeme kayıtları kimlik bağı kopartılarak yasal saklama için kalır." />
      <Notice kind="warn">Silme işlemi <b>geri alınamaz</b>. Oyuncular bu işlemi doğrudan oyundan (Ayarlar → Hesabı sil) kendileri de yapabilir.</Notice>
      <Select value={status} onChange={setStatus} options={[{ value: '', label: 'tüm durumlar' }, { value: 'pending', label: 'bekleyen' }, { value: 'in_progress', label: 'işlemde' }, { value: 'completed', label: 'tamamlanan' }]} />
      <Table<Req> rows={list.data?.data ?? []} empty={list.isLoading ? 'Yükleniyor…' : 'Talep yok'} cols={[{ label: 'Tarih', render: (r) => fmtDate(r.createdAt) }, { label: 'Oyuncu', render: (r) => <Link className="text-amber-400 hover:underline" href={`/dashboard/players/${r.userId}`}>{r.userId.slice(0, 8)}…</Link> }, { label: 'Tür', render: (r) => (r.type === 'delete' ? <Pill tone="red">silme</Pill> : <Pill tone="blue">veri erişimi</Pill>) }, { label: 'Durum', render: (r) => <Pill tone={tone(r.status)}>{r.status}</Pill> }, { label: '', render: (r) => writable && r.status !== 'completed' && <div className="flex gap-1">{r.status === 'pending' && <Btn size="sm" variant="ghost" onClick={() => start.mutate(r.id)}>İşleme al</Btn>}{r.type === 'export' ? <Btn size="sm" onClick={() => doExport.mutate(r.id)}>Dışa aktar & tamamla</Btn> : <Btn size="sm" variant="danger" onClick={() => { if (confirm('Oyuncunun kişisel verileri KALICI olarak silinecek. Emin misiniz?')) doDelete.mutate(r.id); }}>Sil & tamamla</Btn>}</div> }]} />
    </div>
  );
}
