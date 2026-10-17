'use client';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { get } from '@/lib/api';
import { Btn, Label, Notice, TextInput } from '@/components/kit/kit';

export interface Rewards {
  wallet?: Record<string, number>;
  items?: { type: string; id: string; qty?: number; days?: number }[];
  packs?: { id: string; days?: number }[];
  bonuses?: { kind: 'starting_resources' | 'starting_units'; payload: unknown; uses?: number; days?: number; appliesTo?: string[] }[];
  xp?: number;
}

/** Content packs of the game (ids = Data/UI product catalog in the game client). */
export const PACKS = [
  { id: 'sultans-ascend', label: 'The Sultans Ascend ($7.49)' },
  { id: 'knights-of-cross-and-rose', label: 'Knights of Cross and Rose ($7.49)' },
  { id: 'dynasties-of-the-east', label: 'Dynasties of the East ($9.99)' },
  { id: 'yue-feis-legacy', label: "Yue Fei's Legacy ($7.50)" },
  { id: 'digital-deluxe', label: 'Digital Deluxe Upgrade ($9.99)' },
  { id: 'raiders-of-the-north', label: 'Raiders of the North ($19.99)' },
];
const CURRENCIES = [
  { key: 'coins', label: 'Altın (coins)' }, { key: 'gems', label: 'Mücevher (gems)' }, { key: 'chestKeys', label: 'Sandık anahtarı' }, { key: 'eventTokens', label: 'Etkinlik jetonu' }, { key: 'bpXp', label: 'Battle Pass XP' },
];
const ITEM_TYPES = ['flag', 'emblem', 'portrait', 'skin', 'monument', 'music', 'team_color', 'chest', 'other'];
const num = (s: string) => { const n = Number(String(s).replace(',', '.')); return Number.isFinite(n) ? n : 0; };

export function GrantForm({ onSubmit, submitLabel = 'Ver', busy, initial, reasonLabel }: { onSubmit: (r: Rewards, reason: string) => void; submitLabel?: string; busy?: boolean; initial?: Rewards; reasonLabel?: string }) {
  const init = initial ?? {};
  const initSr = (init.bonuses ?? []).find((b) => b.kind === 'starting_resources'); const initSu = (init.bonuses ?? []).find((b) => b.kind === 'starting_units');
  const [wallet, setWallet] = useState<Record<string, string>>(Object.fromEntries(Object.entries(init.wallet ?? {}).map(([k, v]) => [k, String(v)])));
  const [xp, setXp] = useState(init.xp ? String(init.xp) : '');
  const [packs, setPacks] = useState<string[]>((init.packs ?? []).map((p) => p.id)); const [packDays, setPackDays] = useState(init.packs?.[0]?.days ? String(init.packs[0].days) : '');
  const [items, setItems] = useState<{ type: string; id: string; qty: string; days: string }[]>((init.items ?? []).map((i) => ({ type: i.type, id: i.id, qty: String(i.qty ?? 1), days: i.days ? String(i.days) : '' })));
  const [res, setRes] = useState<Record<string, string>>(Object.fromEntries(Object.entries((initSr?.payload ?? {}) as Record<string, number>).map(([k, v]) => [k, String(v)]))); const [resUses, setResUses] = useState(String(initSr?.uses ?? 1)); const [resDays, setResDays] = useState(initSr?.days ? String(initSr.days) : ''); const [resRanked, setResRanked] = useState(!!initSr?.appliesTo?.includes('ranked'));
  const [units, setUnits] = useState<{ type: string; count: string }[]>(((initSu?.payload ?? []) as { type: string; count: number }[]).map((u) => ({ type: u.type, count: String(u.count) }))); const [unitUses, setUnitUses] = useState(String(initSu?.uses ?? 1));
  const [reason, setReason] = useState('');
  const unitKeys = useQuery({ queryKey: ['unit-keys'], queryFn: async () => { try { const d = await get<{ content: string }>('/content/file', { path: 'Data/Balance/unit_balance.json' }); return Object.keys((JSON.parse(d.content).units ?? {}) as object); } catch { return [] as string[]; } }, staleTime: 300_000 });

  const rewards = useMemo<Rewards>(() => {
    const r: Rewards = {};
    const w: Record<string, number> = {}; for (const [k, v] of Object.entries(wallet)) { const n = Math.round(num(v)); if (n) w[k] = n; } if (Object.keys(w).length) r.wallet = w;
    if (num(xp)) r.xp = Math.round(num(xp));
    if (packs.length) r.packs = packs.map((id) => ({ id, ...(num(packDays) ? { days: Math.round(num(packDays)) } : {}) }));
    const its = items.filter((i) => i.id.trim()).map((i) => ({ type: i.type, id: i.id.trim(), qty: Math.max(1, Math.round(num(i.qty) || 1)), ...(num(i.days) ? { days: Math.round(num(i.days)) } : {}) })); if (its.length) r.items = its;
    const bon: NonNullable<Rewards['bonuses']> = [];
    const sr: Record<string, number> = {}; for (const k of ['food', 'wood', 'gold', 'stone']) if (num(res[k] ?? '')) sr[k] = Math.round(num(res[k])); if (Object.keys(sr).length) bon.push({ kind: 'starting_resources', payload: sr, uses: Math.max(1, Math.round(num(resUses) || 1)), ...(num(resDays) ? { days: Math.round(num(resDays)) } : {}), appliesTo: resRanked ? ['ranked'] : [] });
    const su = units.filter((u) => u.type.trim() && num(u.count) > 0).map((u) => ({ type: u.type.trim(), count: Math.round(num(u.count)) })); if (su.length) bon.push({ kind: 'starting_units', payload: su, uses: Math.max(1, Math.round(num(unitUses) || 1)) });
    if (bon.length) r.bonuses = bon;
    return r;
  }, [wallet, xp, packs, packDays, items, res, resUses, resDays, resRanked, units, unitUses]);
  const empty = Object.keys(rewards).length === 0;
  const field = 'w-full';

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 text-sm font-semibold text-white">Para birimleri & XP</div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {CURRENCIES.map((c) => <Label key={c.key} text={c.label}><TextInput type="number" value={wallet[c.key] ?? ''} onChange={(e) => setWallet({ ...wallet, [c.key]: e.target.value })} placeholder="0" className={field} /></Label>)}
          <Label text="Oyuncu XP"><TextInput type="number" value={xp} onChange={(e) => setXp(e.target.value)} placeholder="0" /></Label>
        </div>
        <div className="mt-1 text-xs text-gray-500">Eksi değer yazarak düşebilirsiniz (bakiye yetmiyorsa reddedilir).</div>
      </div>

      <div>
        <div className="mb-2 text-sm font-semibold text-white">İçerik paketleri (ücretli paketi ücretsiz verme)</div>
        <div className="grid gap-1.5 md:grid-cols-2">{PACKS.map((p) => <label key={p.id} className="flex items-center gap-2 text-sm text-gray-300"><input type="checkbox" checked={packs.includes(p.id)} onChange={(e) => setPacks(e.target.checked ? [...packs, p.id] : packs.filter((x) => x !== p.id))} />{p.label}</label>)}</div>
        <div className="mt-2 w-60"><Label text="Süre (gün) — boşsa kalıcı"><TextInput type="number" value={packDays} onChange={(e) => setPackDays(e.target.value)} placeholder="kalıcı" /></Label></div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between"><span className="text-sm font-semibold text-white">Eşyalar (bayrak, amblem, portre, kostüm...)</span><Btn size="sm" variant="ghost" onClick={() => setItems([...items, { type: 'flag', id: '', qty: '1', days: '' }])}>+ eşya ekle</Btn></div>
        {items.map((it, i) => (
          <div key={i} className="mb-2 grid grid-cols-12 gap-2">
            <select value={it.type} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)))} className="col-span-3 rounded-lg border border-gray-700 bg-gray-800 px-2 py-2 text-sm text-white">{ITEM_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
            <TextInput className="col-span-4" placeholder="eşya kimliği (örn. golden-crown)" value={it.id} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, id: e.target.value } : x)))} />
            <TextInput className="col-span-2" type="number" placeholder="adet" value={it.qty} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} />
            <TextInput className="col-span-2" type="number" placeholder="gün" value={it.days} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, days: e.target.value } : x)))} />
            <Btn size="sm" variant="ghost" className="col-span-1" onClick={() => setItems(items.filter((_, j) => j !== i))}>✕</Btn>
          </div>
        ))}
      </div>

      <div>
        <div className="mb-1 text-sm font-semibold text-white">Başlangıç kaynakları (oyuncunun kendi maçlarında)</div>
        <div className="mb-2 text-xs text-gray-500">Maç başlarken ek yiyecek / odun / altın / taş olarak eklenir. Varsayılan olarak yalnızca çevrimdışı ve normal maçlarda geçerlidir.</div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
          {['food', 'wood', 'gold', 'stone'].map((k) => <Label key={k} text={{ food: 'Yiyecek', wood: 'Odun', gold: 'Altın', stone: 'Taş' }[k] as string}><TextInput type="number" value={res[k] ?? ''} onChange={(e) => setRes({ ...res, [k]: e.target.value })} placeholder="0" /></Label>)}
          <Label text="Kaç maçta"><TextInput type="number" value={resUses} onChange={(e) => setResUses(e.target.value)} /></Label>
          <Label text="Süre (gün)"><TextInput type="number" value={resDays} onChange={(e) => setResDays(e.target.value)} placeholder="süresiz" /></Label>
        </div>
        <label className="mt-2 flex items-center gap-2 text-xs text-gray-400"><input type="checkbox" checked={resRanked} onChange={(e) => setResRanked(e.target.checked)} />Dereceli maçlarda da geçerli olsun (adil olmayabilir)</label>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between"><span className="text-sm font-semibold text-white">Başlangıç askerleri</span><Btn size="sm" variant="ghost" onClick={() => setUnits([...units, { type: '', count: '1' }])}>+ asker ekle</Btn></div>
        <datalist id="unit-keys">{(unitKeys.data ?? []).map((k) => <option key={k} value={k} />)}</datalist>
        {units.map((u, i) => (
          <div key={i} className="mb-2 grid grid-cols-12 gap-2">
            <TextInput list="unit-keys" className="col-span-6" placeholder="birim (örn. knight, archer)" value={u.type} onChange={(e) => setUnits(units.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)))} />
            <TextInput className="col-span-4" type="number" placeholder="adet" value={u.count} onChange={(e) => setUnits(units.map((x, j) => (j === i ? { ...x, count: e.target.value } : x)))} />
            <Btn size="sm" variant="ghost" className="col-span-2" onClick={() => setUnits(units.filter((_, j) => j !== i))}>✕</Btn>
          </div>
        ))}
        {units.length > 0 && <div className="w-40"><Label text="Kaç maçta"><TextInput type="number" value={unitUses} onChange={(e) => setUnitUses(e.target.value)} /></Label></div>}
      </div>

      <Label text={reasonLabel ?? 'Gerekçe (zorunlu — kayıt defterine yazılır)'}><TextInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder="örn. Telafi: 12 Ekim kesintisi" maxLength={300} /></Label>
      {empty ? <Notice>Yukarıdan en az bir şey seçin.</Notice> : <details className="text-xs text-gray-500"><summary className="cursor-pointer">Gönderilecek içerik (JSON)</summary><pre className="mt-2 overflow-auto rounded bg-gray-950 p-3 text-gray-300">{JSON.stringify(rewards, null, 2)}</pre></details>}
      <Btn disabled={empty || !reason.trim() || busy} onClick={() => onSubmit(rewards, reason.trim())}>{busy ? 'İşleniyor…' : submitLabel}</Btn>
    </div>
  );
}
