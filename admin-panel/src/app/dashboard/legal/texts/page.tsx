'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { errorMessage, get, patch, post } from '@/lib/api';
import { canWrite } from '@/lib/permissions';
import { fmtDate } from '@/lib/format';
import { Btn, Card, flashError, flashOk, Label, Notice, PageHeader, Pill, Select, Table, TextArea, TextInput } from '@/components/kit/kit';

interface Text { id: string; type: string; version: string; language: string; content: string; isActive: boolean; publishedAt: string | null; createdAt: string }
const TYPES = [{ value: 'privacy_policy', label: 'Gizlilik politikası' }, { value: 'terms_of_service', label: 'Kullanım şartları' }, { value: 'kvkk_notice', label: 'KVKK aydınlatma metni' }, { value: 'eula', label: 'Lisans sözleşmesi (EULA)' }];
const LANGS = ['tr', 'en', 'de', 'fr', 'es', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar', 'id'].map((l) => ({ value: l, label: l }));

export default function LegalTextsPage() {
  const { data: session } = useSession();
  const writable = canWrite((session as { role?: string } | null)?.role, 'legal');
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['legal-texts'], queryFn: () => get<Text[]>('/legal/texts') });
  const [f, setF] = useState({ type: 'privacy_policy', language: 'tr', version: '1.0', content: '' }); const [view, setView] = useState<Text | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['legal-texts'] });
  const create = useMutation({ mutationFn: () => post('/legal/texts', f), onSuccess: () => { flashOk('Taslak kaydedildi. Yayınlayana kadar oyuncular görmez.'); setF({ ...f, content: '' }); refresh(); }, onError: (e) => flashError(errorMessage(e)) });
  const publish = useMutation({ mutationFn: (id: string) => patch(`/legal/texts/${id}/publish`), onSuccess: () => { flashOk('Yayınlandı: oyun açılışta bu metni gösterir.'); refresh(); }, onError: (e) => flashError(errorMessage(e)) });
  return (
    <div className="space-y-6">
      <PageHeader title="Yasal Metinler" subtitle="Gizlilik politikası, kullanım şartları, KVKK metni. Yayınladığınız sürüm oyunda ilk açılışta gösterilir; oyuncunun hangi sürümü kabul ettiği kayıt altına alınır. Yeni sürüm yayınlayınca eskisi pasifleşir." />
      <Notice kind="warn">Hukuki metinlerin içeriği için avukat desteği alın; mağazalar (App Store / Google Play) yayın için gizlilik politikası bağlantısı ve hesap silme yöntemi ister.</Notice>
      {writable && <Card title="Yeni sürüm yaz"><div className="grid gap-3 md:grid-cols-4"><Label text="Tür"><Select className="w-full" value={f.type} onChange={(v) => setF({ ...f, type: v })} options={TYPES} /></Label><Label text="Dil"><Select className="w-full" value={f.language} onChange={(v) => setF({ ...f, language: v })} options={LANGS} /></Label><Label text="Sürüm"><TextInput value={f.version} onChange={(e) => setF({ ...f, version: e.target.value })} /></Label></div><div className="mt-3"><Label text="Metin"><TextArea rows={10} value={f.content} onChange={(e) => setF({ ...f, content: e.target.value })} /></Label></div><div className="mt-3"><Btn disabled={!f.content.trim() || create.isPending} onClick={() => create.mutate()}>Taslak olarak kaydet</Btn></div></Card>}
      <Table<Text> rows={list.data ?? []} empty={list.isLoading ? 'Yükleniyor…' : 'Henüz metin yok'} cols={[{ label: 'Tür', render: (t) => TYPES.find((x) => x.value === t.type)?.label ?? t.type }, { label: 'Dil', render: (t) => t.language }, { label: 'Sürüm', render: (t) => t.version }, { label: 'Durum', render: (t) => (t.isActive ? <Pill tone="green">yayında</Pill> : <Pill>pasif / taslak</Pill>) }, { label: 'Yayın', render: (t) => fmtDate(t.publishedAt) }, { label: '', render: (t) => <div className="flex gap-1"><Btn size="sm" variant="ghost" onClick={() => setView(view?.id === t.id ? null : t)}>Oku</Btn>{writable && !t.isActive && <Btn size="sm" variant="success" onClick={() => { if (confirm('Bu sürüm yayınlansın mı? Aynı türün önceki sürümü pasifleşir.')) publish.mutate(t.id); }}>Yayınla</Btn>}</div> }]} />
      {view && <Card title={`${view.type} · ${view.language} · v${view.version}`}><pre className="max-h-96 overflow-auto whitespace-pre-wrap text-sm text-gray-300">{view.content}</pre></Card>}
    </div>
  );
}
