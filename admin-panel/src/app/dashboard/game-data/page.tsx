'use client';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { get, post, put, errorMessage } from '@/lib/api';
import { canWrite } from '@/lib/permissions';
import { fmtAgo, fmtDate } from '@/lib/format';
import { Btn, Card, flashError, flashOk, Notice, PageHeader, Pill, Tabs, TextArea, TextInput, useDebounced } from '@/components/kit/kit';

interface FileRow { path: string; category: string; size: number; hash: string; changedFromBuild: boolean; unpublished: boolean; updatedAt: string; updatedBy: string | null }
interface FilesResp { activeVersion: number | null; files: FileRow[] }
interface FileDoc { path: string; content: string; hash: string; baseHash: string; updatedAt: string }
interface Release { id: string; version: number; channel: string; note: string | null; isActive: boolean; createdAt: string; createdBy: string | null; files: number }
interface Change { path: string; from: unknown; to: unknown }

const CATEGORIES: Record<string, string> = { balance: 'Denge (birim, bina, teknoloji, ekonomi, savaş)', civilization: 'Medeniyetler', localization: 'Metinler & diller', ui: 'Arayüz verisi (haberler, haritalar...)', audio: 'Ses', other: 'Diğer' };
const FRIENDLY: Record<string, string> = {
  'unit_balance.json': 'Birim denge tablosu (can, saldırı, zırh, hız, maliyet...)', 'building_balance.json': 'Bina denge tablosu', 'tech_balance.json': 'Teknolojiler / araştırmalar', 'economy_balance.json': 'Ekonomi (toplama hızları, maliyetler)',
  'combat_balance.json': 'Savaş kuralları (karşı birimler, hasar çarpanları)', 'age_rules.json': 'Çağ atlama kuralları', 'victory_conditions.json': 'Zafer koşulları', 'map_rules.json': 'Harita kuralları', 'mercenaries.json': 'Paralı askerler',
  'civ_units.json': 'Medeniyetlere özel birimler', 'civ_landmarks.json': 'Medeniyet dönüm noktası binaları', 'patrol_rules.json': 'Devriye kuralları', 'news.json': 'Ana menü haberleri',
};

// ── generic JSON helpers ──
type J = unknown;
const isObj = (v: J): v is Record<string, J> => !!v && typeof v === 'object' && !Array.isArray(v);
const isScalar = (v: J) => v === null || ['string', 'number', 'boolean'].includes(typeof v);
function setPath(root: J, path: (string | number)[], value: J): J {
  const clone = structuredClone(root) as Record<string, J>; let cur: Record<string, J> = clone;
  for (let i = 0; i < path.length - 1; i++) cur = cur[path[i] as string] as Record<string, J>;
  cur[path[path.length - 1] as string] = value; return clone;
}
function coerce(old: J, text: string): J { if (typeof old === 'number') { const n = Number(text.replace(',', '.')); return Number.isFinite(n) ? n : old; } if (typeof old === 'boolean') return text === 'true'; return text; }

/** Object-of-objects with scalar leaves (units / buildings / techs ...) -> editable grid. */
function findGrid(doc: J): { key: string; rows: Record<string, Record<string, J>>; cols: string[] }[] {
  if (!isObj(doc)) return [];
  const out: { key: string; rows: Record<string, Record<string, J>>; cols: string[] }[] = [];
  for (const [k, v] of Object.entries(doc)) {
    if (!isObj(v)) continue; const entries = Object.entries(v);
    if (entries.length < 2 || !entries.every(([, r]) => isObj(r))) continue;
    const cols = new Set<string>(); for (const [, r] of entries) for (const [c, cv] of Object.entries(r as Record<string, J>)) if (isScalar(cv)) cols.add(c);
    if (cols.size) out.push({ key: k, rows: v as Record<string, Record<string, J>>, cols: [...cols] });
  }
  return out;
}

function GridEditor({ doc, onChange, writable }: { doc: J; onChange: (d: J) => void; writable: boolean }) {
  const grids = findGrid(doc);
  const [sel, setSel] = useState(0); const [q, setQ] = useState('');
  if (!grids.length) return <Notice>Bu dosyada tablo biçiminde bir bölüm yok; "Ağaç" ya da "Ham JSON" sekmesini kullanın.</Notice>;
  const g = grids[Math.min(sel, grids.length - 1)];
  const rows = Object.entries(g.rows).filter(([name]) => name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        {grids.length > 1 && grids.map((x, i) => <Btn key={x.key} size="sm" variant={i === sel ? 'primary' : 'ghost'} onClick={() => setSel(i)}>{x.key}</Btn>)}
        <TextInput placeholder="ara…" value={q} onChange={(e) => setQ(e.target.value)} className="w-48" />
        <span className="text-xs text-gray-500">{rows.length} satır · hücreyi tıklayıp değiştirin</span>
      </div>
      <div className="max-h-[60vh] overflow-auto rounded-lg border border-gray-800">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-gray-900 text-left text-gray-400"><tr><th className="px-2 py-1.5">ad</th>{g.cols.map((c) => <th key={c} className="px-2 py-1.5 font-medium">{c}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-800">
            {rows.map(([name, row]) => (
              <tr key={name} className="hover:bg-gray-800/40">
                <td className="whitespace-nowrap px-2 py-1 font-medium text-amber-300">{name}</td>
                {g.cols.map((c) => {
                  const v = row[c];
                  return (
                    <td key={c} className="px-1 py-0.5">
                      {v === undefined ? <span className="text-gray-700">—</span> : typeof v === 'boolean'
                        ? <input type="checkbox" disabled={!writable} checked={v} onChange={(e) => onChange(setPath(doc, [g.key, name, c], e.target.checked))} />
                        : <input disabled={!writable} defaultValue={String(v)} key={`${name}.${c}.${String(v)}`} onBlur={(e) => { if (e.target.value !== String(v)) onChange(setPath(doc, [g.key, name, c], coerce(v, e.target.value))); }} className="w-full min-w-[3.5rem] rounded bg-transparent px-1 py-0.5 text-white hover:bg-gray-800 focus:bg-gray-800 focus:outline-none" />}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TreeNode({ value, path, onChange, writable, filter, depth }: { value: J; path: (string | number)[]; onChange: (p: (string | number)[], v: J) => void; writable: boolean; filter: string; depth: number }) {
  const [open, setOpen] = useState(depth < 1);
  const name = String(path[path.length - 1] ?? 'kök');
  if (isScalar(value)) {
    if (filter && !name.toLowerCase().includes(filter) && !String(value).toLowerCase().includes(filter)) return null;
    return (
      <div className="flex items-center gap-2 py-0.5 text-xs">
        <span className="w-56 shrink-0 truncate text-gray-400" title={path.join('.')}>{name}</span>
        {typeof value === 'boolean'
          ? <input type="checkbox" disabled={!writable} checked={value} onChange={(e) => onChange(path, e.target.checked)} />
          : <input disabled={!writable} defaultValue={value === null ? '' : String(value)} key={String(value)} onBlur={(e) => { if (e.target.value !== String(value ?? '')) onChange(path, coerce(value, e.target.value)); }} className="min-w-0 flex-1 rounded border border-transparent bg-gray-800/50 px-2 py-0.5 text-white hover:border-gray-700 focus:border-amber-500 focus:outline-none" />}
      </div>
    );
  }
  const entries: [string | number, J][] = Array.isArray(value) ? value.map((v, i) => [i, v]) : Object.entries(value as Record<string, J>);
  const shown = filter ? entries.filter(([k, v]) => String(k).toLowerCase().includes(filter) || JSON.stringify(v).toLowerCase().includes(filter)) : entries;
  if (filter && !shown.length) return null;
  const expanded = open || !!filter;
  return (
    <div className={depth ? 'ml-4 border-l border-gray-800 pl-3' : ''}>
      {depth > 0 && <button onClick={() => setOpen(!open)} className="py-0.5 text-xs text-amber-300 hover:text-amber-200">{expanded ? '▾' : '▸'} {name} <span className="text-gray-600">({entries.length})</span></button>}
      {(expanded || depth === 0) && shown.slice(0, 300).map(([k, v]) => <TreeNode key={String(k)} value={v} path={[...path, k]} onChange={onChange} writable={writable} filter={filter} depth={depth + 1} />)}
      {shown.length > 300 && <div className="text-xs text-gray-600">… {shown.length - 300} satır daha (aramayı daraltın)</div>}
    </div>
  );
}

export default function GameDataPage() {
  const { data: session } = useSession();
  const writable = canWrite((session as { role?: string } | null)?.role, 'content');
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<'grid' | 'tree' | 'raw' | 'diff' | 'releases'>('grid');
  const [draft, setDraft] = useState<J | null>(null);
  const [raw, setRaw] = useState('');
  const [rawError, setRawError] = useState('');
  const [filter, setFilter] = useState(''); const q = useDebounced(filter.toLowerCase());
  const [note, setNote] = useState(''); const [publishOpen, setPublishOpen] = useState(false);
  const [against, setAgainst] = useState<'active' | 'build'>('build');

  const files = useQuery({ queryKey: ['content-files'], queryFn: () => get<FilesResp>('/content/files') });
  const doc = useQuery({ queryKey: ['content-file', selected], queryFn: () => get<FileDoc>('/content/file', { path: selected }), enabled: !!selected });
  const releases = useQuery({ queryKey: ['content-releases'], queryFn: () => get<Release[]>('/content/releases') });
  const diff = useQuery({ queryKey: ['content-diff', selected, against, doc.data?.hash], queryFn: () => get<{ available: boolean; changes: Change[] }>('/content/diff', { path: selected, against }), enabled: !!selected && tab === 'diff' });

  useEffect(() => { if (doc.data) { try { const p = JSON.parse(doc.data.content); setDraft(p); setRaw(JSON.stringify(p, null, 2)); setRawError(''); } catch { setDraft(null); setRaw(doc.data.content); } } }, [doc.data]);
  const grids = useMemo(() => (draft ? findGrid(draft) : []), [draft]);
  useEffect(() => { if (selected && draft && tab === 'grid' && !grids.length) setTab('tree'); }, [selected, draft, grids.length, tab]);

  const text = draft !== null ? JSON.stringify(draft, null, 2) : raw;
  const dirty = !!doc.data && (() => { try { return JSON.stringify(JSON.parse(doc.data.content)) !== JSON.stringify(draft ?? JSON.parse(raw)); } catch { return true; } })();

  const refresh = () => { qc.invalidateQueries({ queryKey: ['content-files'] }); qc.invalidateQueries({ queryKey: ['content-file', selected] }); qc.invalidateQueries({ queryKey: ['content-diff'] }); qc.invalidateQueries({ queryKey: ['content-releases'] }); };
  const save = useMutation({ mutationFn: () => put('/content/file', { path: selected, content: tab === 'raw' ? raw : text }), onSuccess: () => { flashOk('Taslak kaydedildi (oyunculara henüz yansımadı — "Yayınla" gerekir).'); refresh(); }, onError: (e) => flashError(errorMessage(e)) });
  const revert = useMutation({ mutationFn: (toBuild: boolean) => post('/content/revert', { path: selected, toBuild }), onSuccess: () => { flashOk('Taslak geri alındı.'); refresh(); }, onError: (e) => flashError(errorMessage(e)) });
  const publish = useMutation({ mutationFn: () => post<{ version: number; files: number }>('/content/publish', { note: note || undefined }), onSuccess: (r) => { flashOk(`Yama v${r.version} yayınlandı (${r.files} dosya). Oyuncular bir sonraki açılışta / en geç 5 dk içinde alır.`); setPublishOpen(false); setNote(''); refresh(); }, onError: (e) => flashError(errorMessage(e)) });
  const activate = useMutation({ mutationFn: (v: number) => post(`/content/releases/${v}/activate`), onSuccess: () => { flashOk('Seçilen sürüm yeniden aktif edildi (geri alma).'); refresh(); }, onError: (e) => flashError(errorMessage(e)) });
  const imp = useMutation({ mutationFn: (resetBase: boolean) => post<{ created: number; updated: number; skipped: number }>('/content/import', { resetBase }), onSuccess: (r) => { flashOk(`İçe aktarıldı: ${r.created} yeni, ${r.updated} güncellendi, ${r.skipped} atlandı.`); refresh(); }, onError: (e) => flashError(errorMessage(e)) });

  const grouped = useMemo(() => { const g: Record<string, FileRow[]> = {}; for (const f of files.data?.files ?? []) (g[f.category] ??= []).push(f); return g; }, [files.data]);
  const unpublished = (files.data?.files ?? []).filter((f) => f.unpublished).length;
  const fname = (p: string) => p.split('/').pop() ?? p;

  return (
    <div className="space-y-5">
      <PageHeader title="Oyun Verisi & Yamalar" subtitle="Oyunun tüm veri dosyalarını (birim/bina/teknoloji dengesi, ekonomi, medeniyetler, metinler...) buradan değiştirin. Değişiklikler önce taslak olarak kaydedilir; 'Yayınla' dediğinizde numaralı bir yama olur ve oyuncular uygulama güncellemesi OLMADAN, oyunu açtıklarında indirir (AoE4'ün sunucu taraflı yamaları gibi). Hatalı yama için eski sürüme tek tıkla dönebilirsiniz."
        actions={<><Pill tone="blue">aktif yama: {files.data?.activeVersion ? `v${files.data.activeVersion}` : 'yok (yerleşik veri)'}</Pill>{unpublished > 0 && <Pill tone="amber">{unpublished} dosya yayınlanmamış</Pill>}<Btn disabled={!writable || !unpublished} onClick={() => setPublishOpen(true)}>Yayınla…</Btn></>} />

      {files.data && files.data.files.length === 0 && (
        <Notice kind="warn">Henüz hiç dosya yok. İlk kurulum: oyunun içindeki veri dosyalarını sunucuya aktarın. <Btn size="sm" className="ml-3" disabled={!writable || imp.isPending} onClick={() => imp.mutate(false)}>Oyun verisini içe aktar</Btn></Notice>
      )}

      {publishOpen && (
        <Card title="Yamayı yayınla">
          <p className="mb-3 text-sm text-gray-400">{unpublished} dosyadaki değişiklikler yeni bir yama (v{(files.data?.activeVersion ?? 0) + 1}) olarak tüm oyunculara sunulacak. Çok oyunculu maçlarda herkes aynı veriyle oynamak zorundadır; eski veriyle olan oyuncular kuyruğa girmeden önce yamayı otomatik indirir.</p>
          <TextInput placeholder="Not (örn. 'Mızrakçı canı 55 → 60, okçu menzili düşürüldü')" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
          <div className="mt-3 flex gap-2"><Btn onClick={() => publish.mutate()} disabled={publish.isPending}>{publish.isPending ? 'Yayınlanıyor…' : 'Evet, yayınla'}</Btn><Btn variant="ghost" onClick={() => setPublishOpen(false)}>Vazgeç</Btn></div>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-[22rem_1fr]">
        <div className="space-y-4">
          {Object.entries(grouped).map(([cat, list]) => (
            <Card key={cat} title={CATEGORIES[cat] ?? cat}>
              <ul className="space-y-1">
                {list.map((f) => (
                  <li key={f.path}>
                    <button onClick={() => { setSelected(f.path); setTab('grid'); }} className={`w-full rounded-lg px-3 py-2 text-left text-sm ${selected === f.path ? 'bg-amber-600/20 text-amber-300' : 'text-gray-300 hover:bg-gray-800'}`}>
                      <div className="flex items-center justify-between gap-2"><span className="truncate">{fname(f.path)}</span><span className="flex shrink-0 gap-1">{f.unpublished && <Pill tone="amber">yayınlanmadı</Pill>}{f.changedFromBuild && !f.unpublished && <Pill tone="blue">yamalı</Pill>}</span></div>
                      {FRIENDLY[fname(f.path)] && <div className="text-xs text-gray-500">{FRIENDLY[fname(f.path)]}</div>}
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>

        <div>
          {!selected ? (
            <Card><div className="py-16 text-center text-gray-500">Soldan bir dosya seçin. Denge dosyalarında birimleri bir tabloda düzenleyebilirsiniz.</div></Card>
          ) : (
            <Card title={selected} right={<div className="flex gap-2">{dirty && <Pill tone="amber">kaydedilmemiş</Pill>}<Btn size="sm" disabled={!writable || !dirty || save.isPending || !!rawError} onClick={() => save.mutate()}>{save.isPending ? '…' : 'Taslağı kaydet'}</Btn><Btn size="sm" variant="ghost" disabled={!writable || revert.isPending} onClick={() => { if (confirm('Taslak, yayındaki sürüme geri döndürülsün mü?')) revert.mutate(false); }}>Yayındakine dön</Btn><Btn size="sm" variant="ghost" disabled={!writable || revert.isPending} onClick={() => { if (confirm('Dosya oyunla birlikte gelen orijinal haline dönsün mü?')) revert.mutate(true); }}>Orijinale dön</Btn></div>}>
              <Tabs tabs={[{ id: 'grid', label: 'Tablo' }, { id: 'tree', label: 'Ağaç' }, { id: 'raw', label: 'Ham JSON' }, { id: 'diff', label: 'Değişiklikler' }, { id: 'releases', label: 'Yama geçmişi' }]} active={tab} onChange={(t) => { if (t === 'raw' && draft !== null) setRaw(JSON.stringify(draft, null, 2)); if ((t === 'grid' || t === 'tree') && tab === 'raw') { try { setDraft(JSON.parse(raw)); setRawError(''); } catch (e) { setRawError(String(e)); return; } } setTab(t); }} />
              {doc.isLoading && <div className="text-gray-500">Yükleniyor…</div>}
              {doc.data && tab === 'grid' && draft !== null && <GridEditor doc={draft} onChange={setDraft} writable={writable} />}
              {doc.data && tab === 'tree' && draft !== null && (
                <div>
                  <div className="mb-3"><TextInput placeholder="anahtar ya da değer ara…" value={filter} onChange={(e) => setFilter(e.target.value)} className="w-72" /></div>
                  <div className="max-h-[62vh] overflow-auto rounded-lg border border-gray-800 p-3"><TreeNode value={draft} path={[]} onChange={(p, v) => setDraft(setPath(draft, p, v))} writable={writable} filter={q} depth={0} /></div>
                </div>
              )}
              {doc.data && tab === 'raw' && (
                <div>
                  {rawError && <Notice kind="error">{rawError}</Notice>}
                  <TextArea value={raw} disabled={!writable} onChange={(e) => { setRaw(e.target.value); try { JSON.parse(e.target.value); setRawError(''); } catch (er) { setRawError('Geçersiz JSON: ' + (er as Error).message); } }} className="mt-2 h-[60vh] font-mono text-xs" spellCheck={false} />
                </div>
              )}
              {tab === 'diff' && (
                <div>
                  <div className="mb-3 flex gap-2"><Btn size="sm" variant={against === 'build' ? 'primary' : 'ghost'} onClick={() => setAgainst('build')}>Oyunla gelen orijinale göre</Btn><Btn size="sm" variant={against === 'active' ? 'primary' : 'ghost'} onClick={() => setAgainst('active')}>Yayındaki yamaya göre</Btn></div>
                  {diff.data && !diff.data.available && <Notice>Karşılaştırılacak sürüm yok.</Notice>}
                  {diff.data?.available && diff.data.changes.length === 0 && <Notice kind="ok">Fark yok.</Notice>}
                  {diff.data?.available && diff.data.changes.length > 0 && (
                    <div className="max-h-[55vh] overflow-auto rounded-lg border border-gray-800"><table className="w-full text-xs"><thead className="bg-gray-900 text-left text-gray-500"><tr><th className="px-3 py-1.5">alan</th><th className="px-3 py-1.5">önce</th><th className="px-3 py-1.5">şimdi</th></tr></thead><tbody className="divide-y divide-gray-800">{diff.data.changes.map((c) => <tr key={c.path}><td className="px-3 py-1 text-amber-300">{c.path}</td><td className="px-3 py-1 text-red-300">{JSON.stringify(c.from)}</td><td className="px-3 py-1 text-green-300">{JSON.stringify(c.to)}</td></tr>)}</tbody></table></div>
                  )}
                </div>
              )}
              {tab === 'releases' && (
                <ul className="space-y-2">
                  {(releases.data ?? []).map((r) => (
                    <li key={r.id} className="flex items-center justify-between rounded-lg border border-gray-800 px-4 py-2 text-sm">
                      <div><span className="font-medium text-white">v{r.version}</span> {r.isActive && <Pill tone="green">aktif</Pill>} <span className="ml-2 text-gray-400">{r.note ?? 'not yok'}</span><div className="text-xs text-gray-500">{fmtDate(r.createdAt)} · {fmtAgo(r.createdAt)} · {r.files} dosya</div></div>
                      {!r.isActive && <Btn size="sm" variant="warn" disabled={!writable || activate.isPending} onClick={() => { if (confirm(`v${r.version} yeniden aktif edilsin mi? (Oyuncular bu yamaya döner)`)) activate.mutate(r.version); }}>Bu sürüme dön</Btn>}
                    </li>
                  ))}
                  {!releases.data?.length && <div className="text-gray-500">Henüz yama yayınlanmadı.</div>}
                </ul>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
