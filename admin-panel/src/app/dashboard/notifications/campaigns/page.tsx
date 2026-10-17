'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Section } from '@/components/ui/section';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';

// ─── Types ────────────────────────────────────────────────────────────────────

type CampaignStatus = 'draft' | 'sending' | 'sent' | 'failed';

interface MailCampaign {
  id: string;
  name: string;
  subject: string;
  status: CampaignStatus;
  sentCount: number;
  openCount: number;
  sentAt: string | null;
  templateId?: string;
  scheduledAt?: string | null;
}

interface SmsCampaign {
  id: string;
  name: string;
  status: CampaignStatus;
  sentCount: number;
  sentAt: string | null;
  message?: string;
}

interface CreateMailPayload {
  name: string;
  subject: string;
  templateId: string;
  scheduledAt?: string;
}

interface CreateSmsPayload {
  name: string;
  message: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function pct(num: number, den: number) {
  if (!den) return '—';
  return `${((num / den) * 100).toFixed(1)}%`;
}

function statusVariant(s: CampaignStatus): 'green' | 'amber' | 'blue' | 'red' {
  if (s === 'sent')    return 'green';
  if (s === 'draft')   return 'amber';
  if (s === 'sending') return 'blue';
  return 'red';
}

// ─── Shared input styles ──────────────────────────────────────────────────────

const inputCls =
  'w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-amber-500 transition-colors';
const labelCls = 'block text-xs text-gray-400 mb-1.5 font-medium uppercase tracking-wider';

// ─── Modal base ───────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-base font-bold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ─── Create Mail Modal ────────────────────────────────────────────────────────

function CreateMailModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<CreateMailPayload>({ name: '', subject: '', templateId: '', scheduledAt: '' });

  const mutation = useMutation({
    mutationFn: (p: CreateMailPayload) =>
      api.post('/notification/campaigns/mail', {
        ...p,
        scheduledAt: p.scheduledAt || undefined,
      }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns-mail'] });
      onClose();
    },
  });

  const canSubmit = form.name.trim() && form.subject.trim() && form.templateId.trim();

  return (
    <Modal title="Yeni Mail Kampanyasi" onClose={onClose}>
      <form
        onSubmit={(e) => { e.preventDefault(); if (canSubmit) mutation.mutate(form); }}
        className="space-y-4"
      >
        <div>
          <label className={labelCls}>Kampanya Adi</label>
          <input
            type="text" placeholder="Ornek: Season 4 Launch"
            value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputCls} required
          />
        </div>
        <div>
          <label className={labelCls}>Konu (Subject)</label>
          <input
            type="text" placeholder="E-posta konu satiri"
            value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}
            className={inputCls} required
          />
        </div>
        <div>
          <label className={labelCls}>Template ID</label>
          <input
            type="text" placeholder="sendgrid-template-id veya benzeri"
            value={form.templateId} onChange={(e) => setForm({ ...form, templateId: e.target.value })}
            className={`${inputCls} font-mono`} required
          />
        </div>
        <div>
          <label className={labelCls}>Zamanlanmis Gonderim <span className="text-gray-600 normal-case">(opsiyonel)</span></label>
          <input
            type="datetime-local"
            value={form.scheduledAt ?? ''}
            onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
            min={new Date().toISOString().slice(0, 16)}
            className={`${inputCls} [color-scheme:dark]`}
          />
        </div>
        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            disabled={!canSubmit || mutation.isPending}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {mutation.isPending ? <Spinner size="sm" /> : null}
            Olustur
          </button>
          <button type="button" onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-medium transition-colors"
          >
            Iptal
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Create SMS Modal ─────────────────────────────────────────────────────────

function CreateSmsModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<CreateSmsPayload>({ name: '', message: '' });

  const mutation = useMutation({
    mutationFn: (p: CreateSmsPayload) =>
      api.post('/notification/campaigns/sms', p).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns-sms'] });
      onClose();
    },
  });

  const canSubmit = form.name.trim() && form.message.trim();
  const SMS_MAX   = 160;

  return (
    <Modal title="Yeni SMS Kampanyasi" onClose={onClose}>
      <form
        onSubmit={(e) => { e.preventDefault(); if (canSubmit) mutation.mutate(form); }}
        className="space-y-4"
      >
        <div>
          <label className={labelCls}>Kampanya Adi</label>
          <input
            type="text" placeholder="Ornek: Flash Sale Alert"
            value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputCls} required
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs text-gray-400 font-medium uppercase tracking-wider">Mesaj</label>
            <span className={`text-xs tabular-nums ${form.message.length > SMS_MAX ? 'text-red-400' : 'text-gray-500'}`}>
              {form.message.length} / {SMS_MAX}
            </span>
          </div>
          <textarea
            rows={4} maxLength={SMS_MAX}
            placeholder="SMS mesajinizi girin..."
            value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
            className={`${inputCls} resize-none`} required
          />
        </div>
        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            disabled={!canSubmit || mutation.isPending}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {mutation.isPending ? <Spinner size="sm" /> : null}
            Olustur
          </button>
          <button type="button" onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-medium transition-colors"
          >
            Iptal
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Mail Campaigns Tab ───────────────────────────────────────────────────────

function MailTab() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const query = useQuery<MailCampaign[]>({
    queryKey: ['campaigns-mail'],
    queryFn: () =>
      api.get('/notification/campaigns/mail').then((r) => r.data?.data ?? r.data ?? []).catch(() => []),
  });

  const sendMutation = useMutation({
    mutationFn: (id: string) =>
      api.post(`/notification/campaigns/mail/${id}/send`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns-mail'] }),
  });

  const campaigns = query.data ?? [];

  return (
    <>
      <Section
        title="Mail Kampanyalari"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => qc.invalidateQueries({ queryKey: ['campaigns-mail'] })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs border border-gray-700 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Yenile
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Yeni Kampanya
            </button>
          </div>
        }
      >
        {query.isLoading ? (
          <div className="flex justify-center py-8"><Spinner size="md" /></div>
        ) : (
          <div className="overflow-x-auto -mx-5 -mb-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 uppercase border-b border-gray-800">
                  <th className="text-left px-5 py-2.5">Kampanya</th>
                  <th className="text-left px-3 py-2.5 hidden md:table-cell">Konu</th>
                  <th className="text-center px-3 py-2.5">Durum</th>
                  <th className="text-right px-3 py-2.5 hidden lg:table-cell">Gonderilen</th>
                  <th className="text-right px-3 py-2.5 hidden lg:table-cell">Acilma %</th>
                  <th className="text-right px-3 py-2.5 hidden md:table-cell">Gonderim Tarihi</th>
                  <th className="text-center px-5 py-2.5">Islem</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="px-5 py-3 text-white font-medium">{c.name}</td>
                    <td className="px-3 py-3 text-gray-400 text-xs hidden md:table-cell truncate max-w-48">{c.subject}</td>
                    <td className="px-3 py-3 text-center">
                      <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
                    </td>
                    <td className="px-3 py-3 text-right text-gray-400 font-mono text-xs hidden lg:table-cell">
                      {c.sentCount > 0 ? c.sentCount.toLocaleString() : '—'}
                    </td>
                    <td className="px-3 py-3 text-right text-xs font-mono hidden lg:table-cell">
                      {c.status === 'sent' ? (
                        <span className="text-amber-400">{pct(c.openCount, c.sentCount)}</span>
                      ) : <span className="text-gray-600">—</span>}
                    </td>
                    <td className="px-3 py-3 text-right text-gray-500 text-xs hidden md:table-cell whitespace-nowrap">
                      {c.sentAt ? fmtDateTime(c.sentAt) : '—'}
                    </td>
                    <td className="px-5 py-3 text-center">
                      {c.status === 'draft' ? (
                        <button
                          onClick={() => sendMutation.mutate(c.id)}
                          disabled={sendMutation.isPending && sendMutation.variables === c.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-700/60 hover:bg-green-700 text-green-300 text-xs font-medium border border-green-700 transition-colors disabled:opacity-40 mx-auto"
                        >
                          {sendMutation.isPending && sendMutation.variables === c.id
                            ? <Spinner size="sm" />
                            : (
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                              </svg>
                            )
                          }
                          Gonder
                        </button>
                      ) : (
                        <span className="text-gray-600 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-5 py-3 border-t border-gray-800 text-xs text-gray-600">
              {campaigns.length} kampanya
            </div>
          </div>
        )}
      </Section>

      {showCreate && <CreateMailModal onClose={() => setShowCreate(false)} />}
    </>
  );
}

// ─── SMS Campaigns Tab ────────────────────────────────────────────────────────

function SmsTab() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const query = useQuery<SmsCampaign[]>({
    queryKey: ['campaigns-sms'],
    queryFn: () =>
      api.get('/notification/campaigns/sms').then((r) => r.data?.data ?? r.data ?? []).catch(() => []),
  });

  const sendMutation = useMutation({
    mutationFn: (id: string) =>
      api.post(`/notification/campaigns/sms/${id}/send`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns-sms'] }),
  });

  const campaigns = query.data ?? [];

  return (
    <>
      <Section
        title="SMS Kampanyalari"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => qc.invalidateQueries({ queryKey: ['campaigns-sms'] })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs border border-gray-700 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Yenile
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Yeni SMS
            </button>
          </div>
        }
      >
        {query.isLoading ? (
          <div className="flex justify-center py-8"><Spinner size="md" /></div>
        ) : (
          <div className="overflow-x-auto -mx-5 -mb-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 uppercase border-b border-gray-800">
                  <th className="text-left px-5 py-2.5">Kampanya</th>
                  <th className="text-center px-3 py-2.5">Durum</th>
                  <th className="text-right px-3 py-2.5 hidden lg:table-cell">Gonderilen</th>
                  <th className="text-right px-3 py-2.5 hidden md:table-cell">Gonderim Tarihi</th>
                  <th className="text-center px-5 py-2.5">Islem</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="px-5 py-3 text-white font-medium">{c.name}</td>
                    <td className="px-3 py-3 text-center">
                      <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
                    </td>
                    <td className="px-3 py-3 text-right text-gray-400 font-mono text-xs hidden lg:table-cell">
                      {c.sentCount > 0 ? c.sentCount.toLocaleString() : '—'}
                    </td>
                    <td className="px-3 py-3 text-right text-gray-500 text-xs hidden md:table-cell whitespace-nowrap">
                      {c.sentAt ? fmtDateTime(c.sentAt) : '—'}
                    </td>
                    <td className="px-5 py-3 text-center">
                      {c.status === 'draft' ? (
                        <button
                          onClick={() => sendMutation.mutate(c.id)}
                          disabled={sendMutation.isPending && sendMutation.variables === c.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-700/60 hover:bg-green-700 text-green-300 text-xs font-medium border border-green-700 transition-colors disabled:opacity-40 mx-auto"
                        >
                          {sendMutation.isPending && sendMutation.variables === c.id
                            ? <Spinner size="sm" />
                            : (
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                              </svg>
                            )
                          }
                          Gonder
                        </button>
                      ) : (
                        <span className="text-gray-600 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-5 py-3 border-t border-gray-800 text-xs text-gray-600">
              {campaigns.length} kampanya
            </div>
          </div>
        )}
      </Section>

      {showCreate && <CreateSmsModal onClose={() => setShowCreate(false)} />}
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type TabId = 'mail' | 'sms';

export default function CampaignsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('mail');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Notifications — Campaigns</h1>
      </div>

      {/* Tab switcher */}
      <div className="flex rounded-xl overflow-hidden border border-gray-700 w-fit">
        {([
          { id: 'mail', label: 'Mail' },
          { id: 'sms',  label: 'SMS'  },
        ] as { id: TabId; label: string }[]).map((t, i) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-6 py-2.5 text-sm font-medium transition-colors ${
              activeTab === t.id
                ? 'bg-amber-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
            } ${i > 0 ? 'border-l border-gray-700' : ''}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'mail' && <MailTab />}
      {activeTab === 'sms'  && <SmsTab />}
    </div>
  );
}
