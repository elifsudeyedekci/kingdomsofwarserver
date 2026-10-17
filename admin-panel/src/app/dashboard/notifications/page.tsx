'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Section } from '@/components/ui/section';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';

// ─── Types ────────────────────────────────────────────────────────────────────

type NotifType = 'system' | 'promo' | 'event' | 'warning';

interface SendSinglePayload {
  userId: string;
  type: NotifType;
  title: string;
  body: string;
}

interface SendBulkPayload {
  userIds: string[];
  type: NotifType;
  title: string;
  body: string;
}

interface UnreadCountResult {
  userId: string;
  unreadCount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const NOTIF_TYPES: { value: NotifType; label: string }[] = [
  { value: 'system',  label: 'System' },
  { value: 'promo',   label: 'Promo' },
  { value: 'event',   label: 'Event' },
  { value: 'warning', label: 'Warning' },
];

function typeVariant(t: NotifType): 'blue' | 'amber' | 'green' | 'red' {
  if (t === 'system')  return 'blue';
  if (t === 'promo')   return 'amber';
  if (t === 'event')   return 'green';
  return 'red';
}

function SuccessBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-green-900/40 border border-green-700 text-green-400 text-sm">
      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
      {message}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-900/40 border border-red-700 text-red-400 text-sm">
      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
      {message}
    </div>
  );
}

// ─── Input helpers ────────────────────────────────────────────────────────────

const inputCls =
  'w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-amber-500 transition-colors';

const labelCls = 'block text-xs text-gray-400 mb-1.5 font-medium uppercase tracking-wider';

function TypeSelect({ value, onChange }: { value: NotifType; onChange: (v: NotifType) => void }) {
  return (
    <div className="flex rounded-xl overflow-hidden border border-gray-700">
      {NOTIF_TYPES.map((t, i) => (
        <button
          key={t.value}
          type="button"
          onClick={() => onChange(t.value)}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${
            value === t.value
              ? 'bg-amber-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
          } ${i > 0 ? 'border-l border-gray-700' : ''}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── Section A: Send Single ───────────────────────────────────────────────────

function SendSingleSection() {
  const [userId, setUserId] = useState('');
  const [type, setType]     = useState<NotifType>('system');
  const [title, setTitle]   = useState('');
  const [body, setBody]     = useState('');
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  const mutation = useMutation({
    mutationFn: (payload: SendSinglePayload) =>
      api.post('/notification/send', payload).then((r) => r.data),
    onSuccess: () => {
      setBanner({ kind: 'ok', msg: 'Bildirim gönderildi.' });
      setUserId(''); setTitle(''); setBody(''); setType('system');
      setTimeout(() => setBanner(null), 4000);
    },
    onError: () => {
      setBanner({ kind: 'err', msg: 'Gönderim başarısız. API bağlantısını kontrol edin.' });
      setTimeout(() => setBanner(null), 5000);
    },
  });

  const canSend = userId.trim() && title.trim() && body.trim();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSend) return;
    mutation.mutate({ userId: userId.trim(), type, title: title.trim(), body: body.trim() });
  }

  return (
    <Section title="Tekil Bildirim Gonder">
      <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
        {banner?.kind === 'ok'  && <SuccessBanner message={banner.msg} />}
        {banner?.kind === 'err' && <ErrorBanner   message={banner.msg} />}

        <div>
          <label className={labelCls}>User ID</label>
          <input
            type="text"
            placeholder="Oyuncu UUID'si"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className={inputCls}
            required
          />
        </div>

        <div>
          <label className={labelCls}>Bildirim Tipi</label>
          <TypeSelect value={type} onChange={setType} />
        </div>

        <div>
          <label className={labelCls}>Baslik</label>
          <input
            type="text"
            placeholder="Bildirim basligini girin"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            className={inputCls}
            required
          />
        </div>

        <div>
          <label className={labelCls}>Mesaj</label>
          <textarea
            rows={3}
            placeholder="Bildirim metnini girin..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={500}
            className={`${inputCls} resize-none`}
            required
          />
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={!canSend || mutation.isPending}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {mutation.isPending ? <Spinner size="sm" /> : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
            Gonder
          </button>
          <button
            type="button"
            onClick={() => { setUserId(''); setTitle(''); setBody(''); setType('system'); }}
            className="px-4 py-2.5 rounded-xl bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-medium transition-colors"
          >
            Sifirla
          </button>
          <span className="text-xs text-gray-500 ml-auto">
            <Badge variant={typeVariant(type)}>{type}</Badge>
          </span>
        </div>
      </form>
    </Section>
  );
}

// ─── Section B: Send Bulk ─────────────────────────────────────────────────────

function SendBulkSection() {
  const [userIds, setUserIds] = useState('');
  const [type, setType]       = useState<NotifType>('system');
  const [title, setTitle]     = useState('');
  const [body, setBody]       = useState('');
  const [banner, setBanner]   = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  const mutation = useMutation({
    mutationFn: (payload: SendBulkPayload) =>
      api.post('/notification/send-bulk', payload).then((r) => r.data),
    onSuccess: () => {
      setBanner({ kind: 'ok', msg: 'Toplu bildirim gonderildi.' });
      setUserIds(''); setTitle(''); setBody(''); setType('system');
      setTimeout(() => setBanner(null), 4000);
    },
    onError: () => {
      setBanner({ kind: 'err', msg: 'Toplu gonderim basarisiz. Lutfen tekrar deneyin.' });
      setTimeout(() => setBanner(null), 5000);
    },
  });

  const parsedIds = userIds.split(',').map((s) => s.trim()).filter(Boolean);
  const canSend   = parsedIds.length > 0 && title.trim() && body.trim();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSend) return;
    mutation.mutate({ userIds: parsedIds, type, title: title.trim(), body: body.trim() });
  }

  return (
    <Section title="Toplu Bildirim Gonder">
      <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
        {banner?.kind === 'ok'  && <SuccessBanner message={banner.msg} />}
        {banner?.kind === 'err' && <ErrorBanner   message={banner.msg} />}

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className={labelCls.replace('mb-1.5', '')}>User ID Listesi</label>
            {parsedIds.length > 0 && (
              <span className="text-xs text-amber-400 font-mono">{parsedIds.length} kullanici</span>
            )}
          </div>
          <textarea
            rows={3}
            placeholder="uuid-1, uuid-2, uuid-3 (virgülle ayirin)"
            value={userIds}
            onChange={(e) => setUserIds(e.target.value)}
            className={`${inputCls} resize-none`}
            required
          />
          <p className="mt-1 text-xs text-gray-600">Her UUID'yi virgülle ayirin. Maksimum 1000 kullanici.</p>
        </div>

        <div>
          <label className={labelCls}>Bildirim Tipi</label>
          <TypeSelect value={type} onChange={setType} />
        </div>

        <div>
          <label className={labelCls}>Baslik</label>
          <input
            type="text"
            placeholder="Bildirim basligini girin"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            className={inputCls}
            required
          />
        </div>

        <div>
          <label className={labelCls}>Mesaj</label>
          <textarea
            rows={3}
            placeholder="Bildirim metnini girin..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={500}
            className={`${inputCls} resize-none`}
            required
          />
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={!canSend || mutation.isPending}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {mutation.isPending ? <Spinner size="sm" /> : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            )}
            Toplu Gonder
          </button>
          <button
            type="button"
            onClick={() => { setUserIds(''); setTitle(''); setBody(''); setType('system'); }}
            className="px-4 py-2.5 rounded-xl bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-medium transition-colors"
          >
            Sifirla
          </button>
        </div>
      </form>
    </Section>
  );
}

// ─── Section C: Unread Count ──────────────────────────────────────────────────

function UnreadCountSection() {
  const [userId, setUserId]     = useState('');
  const [queried, setQueried]   = useState('');

  const query = useQuery<UnreadCountResult>({
    queryKey: ['notif-unread', queried],
    queryFn: () =>
      api.get(`/notification/user/${queried}/unread-count`).then((r) => r.data),
    enabled: queried !== '',
    retry: false,
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (userId.trim()) setQueried(userId.trim());
  }

  return (
    <Section title="Okunmamis Bildirim Sayisi">
      <div className="space-y-4 max-w-xl">
        <form onSubmit={handleSearch} className="flex gap-3">
          <input
            type="text"
            placeholder="User ID girin"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className={`${inputCls} flex-1`}
            required
          />
          <button
            type="submit"
            disabled={!userId.trim()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-600 text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
            </svg>
            Sorgula
          </button>
        </form>

        {query.isFetching && (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Spinner size="sm" /> Yukleniyor...
          </div>
        )}

        {query.isError && !query.isFetching && (
          <ErrorBanner message={`Kullanici bulunamadi veya API hatasi. (ID: ${queried})`} />
        )}

        {query.isSuccess && !query.isFetching && (
          <div className="flex items-center gap-6 p-4 bg-gray-800/50 border border-gray-700 rounded-xl">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">User ID</p>
              <p className="text-sm text-gray-300 font-mono truncate max-w-48">{query.data.userId}</p>
            </div>
            <div className="border-l border-gray-700 h-10" />
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Okunmamis</p>
              <p className={`text-3xl font-bold font-mono ${query.data.unreadCount > 0 ? 'text-amber-400' : 'text-green-400'}`}>
                {query.data.unreadCount}
              </p>
            </div>
            {query.data.unreadCount === 0 && (
              <Badge variant="green">Temiz</Badge>
            )}
            {query.data.unreadCount > 0 && (
              <Badge variant="amber">{query.data.unreadCount} bekliyor</Badge>
            )}
          </div>
        )}
      </div>
    </Section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NotificationsOverviewPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Notifications — Overview</h1>
      </div>

      <SendSingleSection />
      <SendBulkSection />
      <UnreadCountSection />
    </div>
  );
}
