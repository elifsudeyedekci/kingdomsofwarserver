'use client';
import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { io, type Socket } from 'socket.io-client';
import { create } from 'zustand';
import { API_URL } from '@/lib/api';

export interface FeedItem {
  id: string;
  kind: 'cheat' | 'security' | 'moderation' | 'presence' | 'fraud' | 'register' | 'match';
  severity?: string;
  title: string;
  detail?: string;
  href?: string;
  at: number;
}

interface FeedState {
  connected: boolean;
  items: FeedItem[];
  unseenAlerts: number;
  toasts: FeedItem[];
  setConnected: (c: boolean) => void;
  push: (i: Omit<FeedItem, 'id' | 'at'>) => void;
  dismissToast: (id: string) => void;
  markSeen: () => void;
}

let seq = 0;
export const useFeed = create<FeedState>((set) => ({
  connected: false, items: [], unseenAlerts: 0, toasts: [],
  setConnected: (connected) => set({ connected }),
  push: (i) => set((s) => {
    const item: FeedItem = { ...i, id: `f${++seq}-${Date.now()}`, at: Date.now() };
    const alert = i.kind === 'cheat' || i.kind === 'security';
    return { items: [item, ...s.items].slice(0, 200), unseenAlerts: s.unseenAlerts + (alert ? 1 : 0), toasts: alert ? [item, ...s.toasts].slice(0, 4) : s.toasts };
  }),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  markSeen: () => set({ unseenAlerts: 0 }),
}));

/** Mount once in the dashboard layout: opens the authenticated live feed (/admin socket) and reconnects when the access token rotates. */
export function LiveFeedConnector() {
  const { data } = useSession();
  const token = (data as { accessToken?: string } | null)?.accessToken;
  const { setConnected, push } = useFeed();

  useEffect(() => {
    if (!token) return;
    const socket: Socket = io(`${API_URL}/admin`, { auth: { token }, transports: ['websocket'], reconnection: true, reconnectionDelay: 3000, reconnectionDelayMax: 15000 });
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('cheat:alert', (d) => push({ kind: 'cheat', severity: d.severity, title: `Hile şüphesi: ${d.type}`, detail: `${d.username ?? d.userId} · ${d.summary ?? ''}`, href: `/dashboard/cheat-center?flag=${d.flagId}` }));
    socket.on('security:alert', (d) => push({ kind: 'security', severity: d.severity, title: `Güvenlik: ${d.type}`, detail: d.ip ?? '', href: '/dashboard/security' }));
    socket.on('moderation:action', (d) => push({ kind: 'moderation', title: `Moderasyon: ${d.action}`, detail: d.reason ?? d.userId, href: `/dashboard/players/${d.userId}` }));
    socket.on('player:presence', (d) => push({ kind: 'presence', title: `${d.username ?? d.userId} ${d.online ? 'çevrimiçi oldu' : 'ayrıldı'}`, href: `/dashboard/players/${d.userId}` }));
    socket.on('fraud:alert', (d) => push({ kind: 'fraud', severity: String(d.severity).toLowerCase(), title: `Dolandırıcılık: ${d.reason}`, href: '/dashboard/fraud' }));
    socket.on('player:registered', (d) => push({ kind: 'register', title: `Yeni oyuncu: ${d.username}`, href: `/dashboard/players/${d.playerId}` }));
    socket.on('match:started', (d) => push({ kind: 'match', title: `Maç başladı (${d.gameMode})`, detail: `${d.playerCount} oyuncu` }));
    socket.on('match:ended', (d) => push({ kind: 'match', title: 'Maç bitti', detail: `${d.duration} sn` }));
    return () => { socket.disconnect(); setConnected(false); };
  }, [token, push, setConnected]);

  return null;
}
