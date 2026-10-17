'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { canRead, canWrite } from '@/lib/permissions';
import { GUIDE, ROADMAP, type GuideItem } from '@/lib/guide-data';
import { Card, Notice, PageHeader, Pill, TextInput, Toggle } from '@/components/kit/kit';

function Item({ it, role }: { it: GuideItem; role?: string }) {
  const [open, setOpen] = useState(false);
  const allowed = !it.section || canRead(role, it.section);
  const writable = !it.section || canWrite(role, it.section);
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/60">
      <div className="flex flex-wrap items-start justify-between gap-3 p-4">
        <button onClick={() => setOpen(!open)} className="min-w-0 flex-1 text-left">
          <div className="flex flex-wrap items-center gap-2"><span className="text-xs text-gray-600">{open ? '▾' : '▸'}</span><span className="font-medium text-white">{it.title}</span>{it.status === 'beta' && <Pill tone="amber">deneme</Pill>}{!allowed && <Pill tone="red">rolünüz göremez</Pill>}{allowed && !writable && <Pill tone="blue">yalnızca okuma</Pill>}</div>
          <p className="mt-1 text-sm text-gray-400">{it.what}</p>
        </button>
        {allowed ? <Link href={it.href} className="shrink-0 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-gray-950 hover:bg-amber-400">{it.button} →</Link> : <span className="shrink-0 rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-600">Erişim yok</span>}
      </div>
      {open && (
        <div className="space-y-3 border-t border-gray-800 p-4 text-sm">
          <div><div className="mb-0.5 text-xs font-semibold uppercase text-amber-400">Neyi değiştirir / ne görürsünüz</div><p className="text-gray-300">{it.changes}</p></div>
          <div><div className="mb-0.5 text-xs font-semibold uppercase text-amber-400">Nasıl yapılır</div><ol className="list-decimal space-y-0.5 pl-5 text-gray-300">{it.how.map((h, i) => <li key={i}>{h}</li>)}</ol></div>
          <div><div className="mb-0.5 text-xs font-semibold uppercase text-amber-400">Oyunculara ne zaman yansır</div><p className="text-gray-300">{it.when}</p></div>
        </div>
      )}
    </div>
  );
}

export default function GuidePage() {
  const { data: session } = useSession();
  const role = (session as { role?: string } | null)?.role;
  const [q, setQ] = useState(''); const [mine, setMine] = useState(false);
  const ql = q.trim().toLowerCase();
  const sections = useMemo(() => GUIDE.map((s) => ({ ...s, items: s.items.filter((i) => (!mine || !i.section || canRead(role, i.section)) && (!ql || `${i.title} ${i.what} ${i.changes} ${i.how.join(' ')} ${i.when}`.toLowerCase().includes(ql))) })).filter((s) => s.items.length), [ql, mine, role]);
  const total = GUIDE.reduce((n, s) => n + s.items.length, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Rehber · Panelden neler yapabilirim?" subtitle={`Bu panelle oyunu baştan sona yönetebilirsiniz. Aşağıda ${total} yeteneğin her biri için: ne işe yaradığı, neyi değiştirdiği, nasıl yapıldığı ve oyunculara ne zaman yansıdığı yazıyor; yanındaki düğme sizi doğrudan o ayara götürür. Bir maddeye tıklayarak ayrıntısını açın.`} />
      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <TextInput placeholder="ara: ban, denge, paket, bakım, kaynak…" value={q} onChange={(e) => setQ(e.target.value)} className="w-80" />
          <Toggle checked={mine} onChange={setMine} label="Yalnızca rolümün yapabildikleri" />
        </div>
      </Card>
      {sections.length === 0 && <Notice>Aramanızla eşleşen bir şey yok.</Notice>}
      {sections.map((s) => (
        <section key={s.id} id={s.id} className="space-y-3">
          <div><h2 className="text-lg font-semibold text-white">{s.title}</h2><p className="max-w-4xl text-sm text-gray-400">{s.intro}</p></div>
          <div className="space-y-2">{s.items.map((i) => <Item key={i.id} it={i} role={role} />)}</div>
        </section>
      ))}
      <Card title="Yol haritası — henüz yapılmamış, isteyebileceğiniz şeyler">
        <p className="mb-2 text-sm text-gray-400">Canlı hizmet veren strateji oyunlarında yöneticilerin genelde istediği, ama bu panelde şu an olmayan özellikler (dürüst liste):</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-gray-300">{ROADMAP.map((r) => <li key={r}>{r}</li>)}</ul>
      </Card>
    </div>
  );
}
