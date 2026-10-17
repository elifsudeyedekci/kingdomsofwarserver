'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { errorMessage, get, post } from '@/lib/api';
import { canWrite } from '@/lib/permissions';
import { fmtDate, fmtUsd } from '@/lib/format';
import { Btn, Card, flashError, flashOk, Notice, PageHeader, Pill, Select, Stat, Table, Tabs } from '@/components/kit/kit';

interface Purchase { id: string; userId: string; storeProductId: string; platform: string; transactionId: string; amountUsd: number; currencyCode: string; status: string; verifiedAt: string | null; fraudScore: number | null; createdAt: string }
interface PurchaseResp { data: Purchase[]; total: number }
interface Chargeback { id: string; userId: string; amountUsd: number; status: string; reason: string | null; createdAt: string }
interface Revenue { totalRevenue: number; transactionCount: number; averageAmount: number }

export default function PaymentsPage() {
  const { data: session } = useSession();
  const writable = canWrite((session as { role?: string } | null)?.role, 'payments');
  const qc = useQueryClient();
  const [tab, setTab] = useState<'purchases' | 'chargebacks'>('purchases'); const [status, setStatus] = useState(''); const [days, setDays] = useState('30');
  const from = new Date(Date.now() - Number(days) * 86_400_000).toISOString(), to = new Date().toISOString();
  const rev = useQuery({ queryKey: ['revenue', days], queryFn: () => get<Revenue>('/payment/report/revenue', { startDate: from, endDate: to }) });
  const list = useQuery({ queryKey: ['purchases', status], queryFn: () => get<PurchaseResp>('/payment', { limit: 50, status: status || undefined }), enabled: tab === 'purchases' });
  const cbs = useQuery({ queryKey: ['chargebacks'], queryFn: () => get<{ items?: Chargeback[]; data?: Chargeback[] }>('/payment/chargebacks'), enabled: tab === 'chargebacks' });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['purchases'] }); qc.invalidateQueries({ queryKey: ['revenue'] }); };
  const verify = useMutation({ mutationFn: (id: string) => post(`/payment/${id}/verify`, { rawReceipt: 'manual-confirmation-by-support', isValid: true }), onSuccess: () => { flashOk('Elle onaylandı ve ürün içeriği oyuncuya verildi.'); refresh(); }, onError: (e) => flashError(errorMessage(e)) });
  const refund = useMutation({ mutationFn: (v: { id: string; reason: string; revoke: boolean }) => post(`/payment/${v.id}/refund`, { reason: v.reason, revokeContents: v.revoke }), onSuccess: () => { flashOk('İade kaydı oluşturuldu.'); refresh(); }, onError: (e) => flashError(errorMessage(e)) });
  const chargebacks = cbs.data?.items ?? cbs.data?.data ?? [];

  return (
    <div className="space-y-5">
      <PageHeader title="Ödemeler" subtitle="Oyuncuların mağaza satın almaları. Satın alma, mağaza tarafından sunucuda doğrulanınca otomatik 'verified' olur ve ürün içeriği oyuncuya verilir. 'Bekliyor' ya da 'başarısız' kayıtlar teslim edilmemiş demektir; destek ekibi bir ödemeyi elle onaylayabilir (içerik bir kez verilir)." />
      {!writable && <Notice kind="warn">Rolünüz ödeme işlemi yapamaz; yalnızca görüntüleyebilir.</Notice>}
      <div className="flex items-center gap-3"><span className="text-sm text-gray-400">Dönem:</span><Select value={days} onChange={setDays} options={[{ value: '7', label: 'son 7 gün' }, { value: '30', label: 'son 30 gün' }, { value: '90', label: 'son 90 gün' }]} /></div>
      <div className="grid gap-3 md:grid-cols-3"><Stat label="Doğrulanmış gelir" value={fmtUsd(rev.data?.totalRevenue)} tone="green" /><Stat label="İşlem sayısı" value={rev.data?.transactionCount ?? '…'} tone="blue" /><Stat label="Ortalama sepet" value={fmtUsd(rev.data?.averageAmount)} tone="gray" /></div>
      <Tabs active={tab} onChange={setTab} tabs={[{ id: 'purchases', label: 'Satın almalar' }, { id: 'chargebacks', label: 'Chargeback' }]} />
      {tab === 'purchases' && (
        <div className="space-y-3">
          <Select value={status} onChange={setStatus} options={[{ value: '', label: 'tüm durumlar' }, { value: 'verified', label: 'doğrulanmış' }, { value: 'pending', label: 'bekleyen' }, { value: 'failed', label: 'başarısız' }, { value: 'refunded', label: 'iade' }]} />
          <Table<Purchase> rows={list.data?.data ?? []} empty={list.isLoading ? 'Yükleniyor…' : 'Satın alma yok'} cols={[
            { label: 'Tarih', render: (p) => fmtDate(p.createdAt) },
            { label: 'Oyuncu', render: (p) => <Link className="text-amber-400 hover:underline" href={`/dashboard/players/${p.userId}`}>{p.userId.slice(0, 8)}…</Link> },
            { label: 'Tutar', render: (p) => fmtUsd(p.amountUsd) }, { label: 'Platform', render: (p) => p.platform },
            { label: 'İşlem no', render: (p) => <span className="break-all text-xs text-gray-500">{p.transactionId.slice(0, 24)}</span> },
            { label: 'Durum', render: (p) => <Pill tone={p.status === 'verified' ? 'green' : p.status === 'failed' ? 'red' : 'amber'}>{p.status}</Pill> },
            { label: '', render: (p) => writable && <div className="flex gap-1">{p.status !== 'verified' && <Btn size="sm" variant="success" onClick={() => { if (confirm('Bu ödeme elle onaylanıp ürün içeriği oyuncuya verilsin mi?')) verify.mutate(p.id); }}>Elle onayla</Btn>}{p.status === 'verified' && <Btn size="sm" variant="danger" onClick={() => { const r = prompt('İade nedeni:'); if (r) refund.mutate({ id: p.id, reason: r, revoke: confirm('Ürün içeriği (paket/eşya) oyuncudan geri alınsın mı?') }); }}>İade</Btn>}</div> },
          ]} />
        </div>
      )}
      {tab === 'chargebacks' && <Card><Table<Chargeback> rows={chargebacks} empty="Chargeback yok" cols={[{ label: 'Tarih', render: (c) => fmtDate(c.createdAt) }, { label: 'Oyuncu', render: (c) => <Link className="text-amber-400 hover:underline" href={`/dashboard/players/${c.userId}`}>{c.userId.slice(0, 8)}…</Link> }, { label: 'Tutar', render: (c) => fmtUsd(c.amountUsd) }, { label: 'Durum', render: (c) => c.status }, { label: 'Neden', render: (c) => c.reason ?? '' }]} /></Card>}
    </div>
  );
}
