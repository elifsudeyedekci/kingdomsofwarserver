'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { get } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { ROLE_LABEL } from '@/lib/permissions';
import { Card, PageHeader, Pill, Select, Table, TextInput, useDebounced } from '@/components/kit/kit';

interface Row { id: string; action: string; targetType: string | null; targetId: string | null; ipAddress: string | null; userAgent: string | null; newValue: unknown; createdAt: string; adminId: string | null; userId: string | null; admin: { name: string; email: string; role: string } | null }

export default function AuditPage() {
  const [q, setQ] = useState(''); const dq = useDebounced(q); const [area, setArea] = useState(''); const [open, setOpen] = useState<string | null>(null);
  const areas = useQuery({ queryKey: ['audit-areas'], queryFn: () => get<{ area: string; count: number }[]>('/audit/areas') });
  const rows = useQuery({ queryKey: ['audit', dq, area], queryFn: () => get<Row[]>('/audit', { q: dq || undefined, area: area || undefined, take: 200 }), refetchInterval: 20_000 });

  return (
    <div className="space-y-5">
      <PageHeader title="Denetim Kaydı" subtitle="Panelden yapılan her değişiklik burada: kim, ne zaman, hangi IP'den, hangi alanı, hangi içerikle değiştirdi. Parola ve belirteçler kayda yazılmadan önce gizlenir. Kayıtlar silinemez." />
      <Card>
        <div className="flex flex-wrap gap-3">
          <TextInput placeholder="işlemde ara (örn. ban, content, grants)…" className="w-72" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={area} onChange={setArea} options={[{ value: '', label: 'tüm alanlar' }, ...(areas.data ?? []).map((a) => ({ value: a.area, label: `${a.area} (${a.count})` }))]} />
        </div>
      </Card>
      <Table<Row> rows={rows.data ?? []} empty={rows.isLoading ? 'Yükleniyor…' : 'Kayıt yok'} onRow={(r) => setOpen(open === r.id ? null : r.id)} cols={[
        { label: 'Zaman', render: (r) => fmtDate(r.createdAt) },
        { label: 'Kim', render: (r) => (r.admin ? <div><div className="text-white">{r.admin.name}</div><div className="text-xs text-gray-500">{ROLE_LABEL[r.admin.role] ?? r.admin.role}</div></div> : r.userId ? <Pill>oyuncu</Pill> : <span className="text-gray-600">—</span>) },
        { label: 'İşlem', render: (r) => <div><div className="font-mono text-xs text-amber-300">{r.action}</div>{open === r.id && r.newValue != null && <pre className="mt-2 max-h-60 max-w-2xl overflow-auto rounded bg-gray-950 p-2 text-xs text-gray-300">{JSON.stringify(r.newValue, null, 2)}</pre>}</div> },
        { label: 'Alan', render: (r) => <span className="text-xs text-gray-400">{r.targetType ?? ''}{r.targetId ? ` · ${r.targetId.slice(0, 10)}` : ''}</span> },
        { label: 'IP', render: (r) => <span className="text-xs text-gray-500">{r.ipAddress ?? ''}</span> },
      ]} />
    </div>
  );
}
