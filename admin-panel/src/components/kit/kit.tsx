'use client';
import { useEffect, useState } from 'react';
import { create } from 'zustand';

// ── layout ──
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-sm text-gray-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, right, children, className = '' }: { title?: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-gray-800 bg-gray-900 p-5 ${className}`}>
      {(title || right) && <div className="mb-4 flex items-center justify-between gap-3">{title && <h2 className="text-base font-semibold text-white">{title}</h2>}{right}</div>}
      {children}
    </section>
  );
}

export function Notice({ kind = 'info', children }: { kind?: 'info' | 'warn' | 'error' | 'ok'; children: React.ReactNode }) {
  const c = { info: 'border-blue-800 bg-blue-950/50 text-blue-200', warn: 'border-amber-700 bg-amber-950/50 text-amber-200', error: 'border-red-800 bg-red-950/50 text-red-200', ok: 'border-green-800 bg-green-950/50 text-green-200' }[kind];
  return <div className={`rounded-lg border px-4 py-3 text-sm ${c}`}>{children}</div>;
}

export function Stat({ label, value, sub, tone = 'amber' }: { label: string; value: React.ReactNode; sub?: string; tone?: 'amber' | 'green' | 'red' | 'blue' | 'gray' }) {
  const t = { amber: 'text-amber-400', green: 'text-green-400', red: 'text-red-400', blue: 'text-blue-400', gray: 'text-gray-300' }[tone];
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${t}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, active, onChange }: { tabs: { id: T; label: string; badge?: number }[]; active: T; onChange: (t: T) => void }) {
  return (
    <div className="mb-5 flex flex-wrap gap-1 border-b border-gray-800">
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)} className={`-mb-px border-b-2 px-4 py-2 text-sm ${active === t.id ? 'border-amber-500 text-amber-400' : 'border-transparent text-gray-400 hover:text-white'}`}>
          {t.label}{t.badge ? <span className="ml-1.5 rounded-full bg-red-700 px-1.5 text-[10px] text-white">{t.badge}</span> : null}
        </button>
      ))}
    </div>
  );
}

// ── controls ──
const base = 'rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-amber-500 focus:outline-none disabled:opacity-50';
export const inputCls = base;

export function Btn({ variant = 'primary', size = 'md', className = '', ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'danger' | 'ghost' | 'success' | 'warn'; size?: 'sm' | 'md' }) {
  const v = { primary: 'bg-amber-500 text-gray-950 hover:bg-amber-400', danger: 'bg-red-700 text-white hover:bg-red-600', success: 'bg-green-700 text-white hover:bg-green-600', warn: 'bg-orange-600 text-white hover:bg-orange-500', ghost: 'border border-gray-700 text-gray-200 hover:bg-gray-800' }[variant];
  const s = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-4 py-2 text-sm';
  return <button {...p} className={`rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${v} ${s} ${className}`} />;
}

export function Label({ text, hint, children }: { text: string; hint?: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs font-medium text-gray-400">{text}</span>{children}{hint && <span className="mt-1 block text-xs text-gray-500">{hint}</span>}</label>;
}
export const TextInput = (p: React.InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={`${base} w-full ${p.className ?? ''}`} />;
export const TextArea = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={`${base} w-full ${p.className ?? ''}`} />;
export function Select({ value, onChange, options, className = '' }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; className?: string }) {
  return <select value={value} onChange={(e) => onChange(e.target.value)} className={`${base} ${className}`}>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>;
}
export function Toggle({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; disabled?: boolean }) {
  return (
    <label className={`flex items-start gap-3 ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      <button type="button" disabled={disabled} onClick={() => onChange(!checked)} className={`mt-0.5 h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors ${checked ? 'bg-green-600' : 'bg-gray-700'}`} role="switch" aria-checked={checked}>
        <span className={`block h-5 w-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
      <span><span className="text-sm text-white">{label}</span>{hint && <span className="block text-xs text-gray-500">{hint}</span>}</span>
    </label>
  );
}

export function Pill({ children, tone = 'gray' }: { children: React.ReactNode; tone?: 'gray' | 'green' | 'red' | 'amber' | 'blue' | 'purple' }) {
  const t = { gray: 'bg-gray-800 text-gray-300', green: 'bg-green-900/60 text-green-300', red: 'bg-red-900/60 text-red-300', amber: 'bg-amber-900/60 text-amber-300', blue: 'bg-blue-900/60 text-blue-300', purple: 'bg-purple-900/60 text-purple-300' }[tone];
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${t}`}>{children}</span>;
}
export const sevTone = (s?: string) => (s === 'critical' || s === 'high' ? 'red' : s === 'medium' ? 'amber' : s === 'low' ? 'blue' : 'gray') as 'red' | 'amber' | 'blue' | 'gray';

export function Table<T extends object>({ rows, cols, empty = 'Kayıt yok', onRow }: { rows: T[]; cols: { label: string; render: (r: T) => React.ReactNode; className?: string }[]; empty?: string; onRow?: (r: T) => void }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-800">
      <table className="w-full text-sm">
        <thead className="bg-gray-900 text-left text-xs uppercase tracking-wide text-gray-500">
          <tr>{cols.map((c) => <th key={c.label} className={`px-3 py-2 font-medium ${c.className ?? ''}`}>{c.label}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {rows.length === 0 && <tr><td colSpan={cols.length} className="px-3 py-6 text-center text-gray-500">{empty}</td></tr>}
          {rows.map((r, i) => (
            <tr key={i} onClick={onRow ? () => onRow(r) : undefined} className={onRow ? 'cursor-pointer hover:bg-gray-800/60' : ''}>
              {cols.map((c) => <td key={c.label} className={`px-3 py-2 align-top ${c.className ?? ''}`}>{c.render(r)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── flash messages ("Kaydedildi", errors) ──
interface FlashState { items: { id: number; kind: 'ok' | 'error'; text: string }[]; add: (kind: 'ok' | 'error', text: string) => void; remove: (id: number) => void }
let fid = 0;
export const useFlash = create<FlashState>((set) => ({
  items: [],
  add: (kind, text) => { const id = ++fid; set((s) => ({ items: [...s.items, { id, kind, text }].slice(-4) })); setTimeout(() => set((s) => ({ items: s.items.filter((i) => i.id !== id) })), kind === 'error' ? 9000 : 4000); },
  remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
}));
export const flashOk = (t: string) => useFlash.getState().add('ok', t);
export const flashError = (t: string) => useFlash.getState().add('error', t);

export function FlashHost() {
  const { items, remove } = useFlash();
  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-96 flex-col gap-2">
      {items.map((i) => (
        <div key={i.id} onClick={() => remove(i.id)} className={`cursor-pointer rounded-lg border px-4 py-3 text-sm shadow-xl ${i.kind === 'ok' ? 'border-green-700 bg-green-950 text-green-100' : 'border-red-700 bg-red-950 text-red-100'}`}>{i.text}</div>
      ))}
    </div>
  );
}

/** Debounced value for search boxes. */
export function useDebounced<T>(value: T, ms = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}
