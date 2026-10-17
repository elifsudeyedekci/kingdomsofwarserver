export function fmtDate(v?: string | Date | null): string {
  if (!v) return '—';
  const d = typeof v === 'string' ? new Date(v) : v;
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
}
export function fmtAgo(v?: string | Date | null): string {
  if (!v) return '—';
  const s = Math.max(0, (Date.now() - new Date(v).getTime()) / 1000);
  if (s < 60) return `${Math.floor(s)} sn önce`;
  if (s < 3600) return `${Math.floor(s / 60)} dk önce`;
  if (s < 86400) return `${Math.floor(s / 3600)} sa önce`;
  return `${Math.floor(s / 86400)} gün önce`;
}
export function fmtDuration(seconds?: number | null): string {
  const s = Math.round(seconds ?? 0);
  if (s < 60) return `${s} sn`;
  if (s < 3600) return `${Math.floor(s / 60)} dk`;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return `${h} sa ${m} dk`;
}
export const fmtNumber = (n?: number | null) => (n ?? 0).toLocaleString('tr-TR');
export const fmtUsd = (n?: number | null) => `$${(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
