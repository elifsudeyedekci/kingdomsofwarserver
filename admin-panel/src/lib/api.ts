import axios, { AxiosError } from 'axios';
import { getSession, signOut } from 'next-auth/react';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
});

// The Bearer token lives in the (HttpOnly, rotating) NextAuth session cookie, never in localStorage.
api.interceptors.request.use(async (config) => {
  if (typeof window !== 'undefined') {
    const session = (await getSession()) as { accessToken?: string; error?: string } | null;
    if (session?.error === 'RefreshFailed') { await signOut({ callbackUrl: '/login' }); throw new axios.Cancel('session ended'); }
    if (session?.accessToken) config.headers.Authorization = `Bearer ${session.accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') await signOut({ callbackUrl: '/login' });
    return Promise.reject(err);
  },
);

/** Human readable message of a failed request (backend sends { message: string | { message } | string[] }). */
export function errorMessage(e: unknown): string {
  const err = e as AxiosError<{ message?: unknown }>;
  const m = err.response?.data?.message;
  if (typeof m === 'string') return m;
  if (Array.isArray(m)) return m.join(', ');
  if (m && typeof m === 'object' && 'message' in m) return String((m as { message: unknown }).message);
  if (err.response?.status === 403) return 'Bu işlem için yetkiniz yok.';
  if (err.response?.status === 429) return 'Çok fazla istek. Biraz bekleyin.';
  return err.message ?? 'Bilinmeyen hata';
}

export const get = async <T,>(url: string, params?: Record<string, unknown>) => (await api.get<T>(url, { params })).data;
export const post = async <T,>(url: string, body?: unknown) => (await api.post<T>(url, body ?? {})).data;
export const put = async <T,>(url: string, body?: unknown) => (await api.put<T>(url, body ?? {})).data;
export const patch = async <T,>(url: string, body?: unknown) => (await api.patch<T>(url, body ?? {})).data;
export const del = async <T,>(url: string) => (await api.delete<T>(url)).data;
