'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { errorMessage, get, patch, post } from '@/lib/api';
import { canWrite } from '@/lib/permissions';
import { fmtUsd } from '@/lib/format';
import { Btn, Card, flashError, flashOk, Label, Notice, PageHeader, Pill, Table, TextInput, Toggle } from '@/components/kit/kit';
import { GrantForm, type Rewards } from '@/components/kit/grant-form';

interface Product { id: string; skuAndroid: string | null; skuIos: string | null; nameKey: string; descKey: string | null; priceUsd: number; localPrices: Record<string, number> | null; contents: Rewards; isActive: boolean; isConsumable: boolean; segment: string | null; countries: string[]; minVersion: string | null; sortOrder: number }
interface Resp { items: Product[]; total: number }
const empty = () => ({ nameKey: '', descKey: '', priceUsd: '0.99', skuAndroid: '', skuIos: '', isConsumable: false, isActive: true, sortOrder: '0', segment: '', minVersion: '', countries: '', localPrices: '' });

function summary(c: Rewards): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(c.wallet ?? {})) parts.push(`${v} ${k}`);
  if (c.packs?.length) parts.push(`paket: ${c.packs.map((p) => p.id).join(', ')}`);
  if (c.items?.length) parts.push(`${c.items.length} eşya`);
  if (c.bonuses?.length) parts.push(`${c.bonuses.length} bonus`);
  if (c.xp) parts.push(`${c.xp} XP`);
  return parts.join(' · ') || 'boş';
}

export default function StorePage() {
  const { data: session } = useSession();
  const writable = canWrite((session as { role?: string } | null)?.role, 'store');
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['store-products'], queryFn: () => get<Resp>('/store/products', { includeInactive: true, limit: 100 }) });
  const [f, setF] = useState(empty()); const [editing, setEditing] = useState<Product | null>(null); const [open, setOpen] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ['store-products'] });

  const body = (contents: Rewards) => {
    let localPrices: Record<string, number> | undefined; if (f.localPrices.trim()) { try { localPrices = JSON.parse(f.localPrices); } catch { throw new Error('Yerel fiyatlar geçerli JSON olmalı: {"TR": 149.99}'); } }
    return { nameKey: f.nameKey, descKey: f.descKey || undefined, priceUsd: Number(f.priceUsd), skuAndroid: f.skuAndroid || undefined, skuIos: f.skuIos || undefined, contents, isActive: f.isActive, isConsumable: f.isConsumable, sortOrder: Number(f.sortOrder) || 0, segment: f.segment || undefined, minVersion: f.minVersion || undefined, countries: f.countries.split(/[\s,]+/).filter(Boolean), localPrices };
  };
  const save = useMutation({
    mutationFn: async (contents: Rewards) => (editing ? patch(`/store/products/${editing.id}`, body(contents)) : post('/store/products', body(contents))),
    onSuccess: () => { flashOk(editing ? 'Ürün güncellendi. Oyuncular mağazayı açtığında görür.' : 'Ürün eklendi.'); setOpen(false); setEditing(null); setF(empty()); refresh(); },
    onError: (e) => flashError(e instanceof Error && !('response' in e) ? e.message : errorMessage(e)),
  });
  const toggle = useMutation({ mutationFn: (id: string) => post(`/store/products/${id}/toggle`), onSuccess: refresh, onError: (e) => flashError(errorMessage(e)) });
  const startEdit = (p: Product) => { setEditing(p); setF({ nameKey: p.nameKey, descKey: p.descKey ?? '', priceUsd: String(p.priceUsd), skuAndroid: p.skuAndroid ?? '', skuIos: p.skuIos ?? '', isConsumable: p.isConsumable, isActive: p.isActive, sortOrder: String(p.sortOrder), segment: p.segment ?? '', minVersion: p.minVersion ?? '', countries: p.countries.join(', '), localPrices: p.localPrices ? JSON.stringify(p.localPrices) : '' }); setOpen(true); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  return (
    <div className="space-y-6">
      <PageHeader title="Mağaza Ürünleri" subtitle="Satışa çıkan paketler, fiyatları ve satın alındığında oyuncuya VERİLEN içerik (para, içerik paketi, eşya, başlangıç bonusu). Satın alma, mağaza (Google Play / App Store) tarafından sunucuda doğrulanınca içerik otomatik verilir. Ürünü kapatırsanız oyuncular artık göremez ve satın alamaz."
        actions={<Btn disabled={!writable} onClick={() => { setEditing(null); setF(empty()); setOpen(true); }}>+ Yeni ürün</Btn>} />
      {!writable && <Notice kind="warn">Rolünüz ürünleri yalnızca görüntüleyebilir.</Notice>}
      <Notice>Gerçek para ile satın alma için sunucuda Google Play / Apple kimlik bilgileri tanımlı olmalı (dağıtım rehberi). Tanımlı değilse gerçek satın almalar güvenlik gereği <b>reddedilir</b>; yalnızca yerel geliştirme modunda test satın alması verilebilir.</Notice>

      {open && writable && (
        <Card title={editing ? `Ürünü düzenle: ${editing.nameKey}` : 'Yeni ürün'} right={<Btn size="sm" variant="ghost" onClick={() => { setOpen(false); setEditing(null); }}>Kapat</Btn>}>
          <div className="mb-5 grid gap-3 md:grid-cols-4">
            <Label text="Ad (yerelleştirme anahtarı ya da metin)" hint="Oyundaki metin tablosunda karşılığı olmalı"><TextInput value={f.nameKey} onChange={(e) => setF({ ...f, nameKey: e.target.value })} placeholder="store.pack.sultans.name" /></Label>
            <Label text="Açıklama anahtarı"><TextInput value={f.descKey} onChange={(e) => setF({ ...f, descKey: e.target.value })} /></Label>
            <Label text="Fiyat (USD)"><TextInput type="number" step="0.01" value={f.priceUsd} onChange={(e) => setF({ ...f, priceUsd: e.target.value })} /></Label>
            <Label text="Sıra"><TextInput type="number" value={f.sortOrder} onChange={(e) => setF({ ...f, sortOrder: e.target.value })} /></Label>
            <Label text="Google Play ürün kimliği (SKU)"><TextInput value={f.skuAndroid} onChange={(e) => setF({ ...f, skuAndroid: e.target.value })} placeholder="com.firma.oyun.pack1" /></Label>
            <Label text="App Store ürün kimliği (SKU)"><TextInput value={f.skuIos} onChange={(e) => setF({ ...f, skuIos: e.target.value })} /></Label>
            <Label text="Ülkeler (boş = hepsi)"><TextInput value={f.countries} onChange={(e) => setF({ ...f, countries: e.target.value })} placeholder="TR, DE" /></Label>
            <Label text="En düşük sürüm"><TextInput value={f.minVersion} onChange={(e) => setF({ ...f, minVersion: e.target.value })} /></Label>
            <Label text="Segment"><TextInput value={f.segment} onChange={(e) => setF({ ...f, segment: e.target.value })} /></Label>
            <div className="md:col-span-3"><Label text="Yerel fiyatlar (JSON)"><TextInput value={f.localPrices} onChange={(e) => setF({ ...f, localPrices: e.target.value })} placeholder='{"TR": 149.99}' /></Label></div>
            <Toggle checked={f.isActive} onChange={(v) => setF({ ...f, isActive: v })} label="Satışta" />
            <Toggle checked={f.isConsumable} onChange={(v) => setF({ ...f, isConsumable: v })} label="Tüketilebilir" hint="Para paketi gibi tekrar satın alınabilir" />
          </div>
          <div className="mb-2 text-sm font-semibold text-white">Satın alınca oyuncuya verilecek içerik</div>
          <GrantForm initial={editing?.contents} reasonLabel="Değişiklik notu (kayda yazılır)" submitLabel={editing ? 'Ürünü kaydet' : 'Ürünü ekle'} busy={save.isPending} onSubmit={(r) => save.mutate(r)} />
        </Card>
      )}

      <Table<Product> rows={list.data?.items ?? []} empty={list.isLoading ? 'Yükleniyor…' : 'Henüz ürün yok'} cols={[
        { label: 'Ürün', render: (p) => <div><div className="font-medium text-white">{p.nameKey}</div><div className="text-xs text-gray-500">{p.skuAndroid ?? '—'} · {p.skuIos ?? '—'}</div></div> },
        { label: 'Fiyat', render: (p) => <span className="text-green-400">{fmtUsd(p.priceUsd)}</span> },
        { label: 'Verdiği içerik', render: (p) => <span className="text-xs text-gray-300">{summary(p.contents)}</span> },
        { label: 'Durum', render: (p) => (p.isActive ? <Pill tone="green">satışta</Pill> : <Pill>kapalı</Pill>) },
        { label: '', render: (p) => writable && <div className="flex gap-1"><Btn size="sm" variant="ghost" onClick={() => startEdit(p)}>Düzenle</Btn><Btn size="sm" variant="ghost" onClick={() => toggle.mutate(p.id)}>{p.isActive ? 'Kapat' : 'Aç'}</Btn></div> },
      ]} />
    </div>
  );
}
