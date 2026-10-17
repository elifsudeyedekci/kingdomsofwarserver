'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useState } from 'react';
import { canRead, ROLE_LABEL, type Section } from '@/lib/permissions';
import { useFeed } from '@/lib/live-feed';

interface NavItem { href: string; label: string; section?: Section; badge?: 'alerts' }
interface NavGroup { key: string; label: string; items: NavItem[]; defaultOpen?: boolean }

const NAV_GROUPS: NavGroup[] = [
  {
    key: 'start', label: '', defaultOpen: true,
    items: [
      { href: '/dashboard', label: 'Ana Sayfa' },
      { href: '/dashboard/guide', label: 'Rehber · Neler Yapabilirim?' },
    ],
  },
  {
    key: 'game', label: 'Oyun Yönetimi', defaultOpen: true,
    items: [
      { href: '/dashboard/live-control', label: 'Canlı Kontrol', section: 'live' },
      { href: '/dashboard/game-data', label: 'Oyun Verisi & Yamalar', section: 'content' },
      { href: '/dashboard/announcements', label: 'Duyurular & Haberler', section: 'live' },
      { href: '/dashboard/config', label: 'Uzak Ayarlar & Bayraklar', section: 'config' },
    ],
  },
  {
    key: 'players', label: 'Oyuncular', defaultOpen: true,
    items: [
      { href: '/dashboard/players', label: 'Tüm Oyuncular', section: 'players' },
      { href: '/dashboard/online', label: 'Şu An Çevrimiçi', section: 'players' },
      { href: '/dashboard/grants', label: 'Verme & Hediyeler', section: 'grants' },
      { href: '/dashboard/matches', label: 'Maç Geçmişi', section: 'players' },
      { href: '/dashboard/leaderboard', label: 'Liderlik Tablosu', section: 'players' },
      { href: '/dashboard/clans', label: 'Klanlar', section: 'players' },
      { href: '/dashboard/friendships', label: 'Arkadaşlıklar', section: 'players' },
    ],
  },
  {
    key: 'safety', label: 'Güvenlik & Moderasyon', defaultOpen: true,
    items: [
      { href: '/dashboard/cheat-center', label: 'Hile Merkezi', section: 'cheat', badge: 'alerts' },
      { href: '/dashboard/bans', label: 'Banlar & Kickler', section: 'moderation' },
      { href: '/dashboard/security', label: 'Güvenlik Merkezi', section: 'security' },
      { href: '/dashboard/fraud', label: 'Dolandırıcılık', section: 'moderation' },
      { href: '/dashboard/audit', label: 'Denetim Kaydı', section: 'security' },
    ],
  },
  {
    key: 'economy', label: 'Mağaza & Ekonomi', defaultOpen: false,
    items: [
      { href: '/dashboard/store', label: 'Mağaza Ürünleri', section: 'store' },
      { href: '/dashboard/payments', label: 'Ödemeler', section: 'payments' },
      { href: '/dashboard/economy', label: 'Ekonomi', section: 'players' },
      { href: '/dashboard/tournaments', label: 'Turnuvalar', section: 'tournaments' },
    ],
  },
  {
    key: 'liveops', label: 'Canlı Etkinlikler', defaultOpen: false,
    items: [
      { href: '/dashboard/liveops', label: 'Genel Bakış', section: 'liveops' },
      { href: '/dashboard/liveops/seasons', label: 'Sezonlar', section: 'liveops' },
      { href: '/dashboard/liveops/events', label: 'Etkinlikler', section: 'liveops' },
      { href: '/dashboard/liveops/battle-pass', label: 'Battle Pass', section: 'liveops' },
      { href: '/dashboard/achievement', label: 'Başarımlar', section: 'liveops' },
    ],
  },
  {
    key: 'comm', label: 'İletişim & Destek', defaultOpen: false,
    items: [
      { href: '/dashboard/notifications', label: 'Bildirimler', section: 'notifications' },
      { href: '/dashboard/notifications/campaigns', label: 'Kampanyalar', section: 'notifications' },
      { href: '/dashboard/support', label: 'Destek Talepleri', section: 'support' },
    ],
  },
  {
    key: 'analytics', label: 'Analitik', defaultOpen: false,
    items: [
      { href: '/dashboard/analytics', label: 'Genel Bakış', section: 'analytics' },
      { href: '/dashboard/analytics/events', label: 'Olaylar', section: 'analytics' },
      { href: '/dashboard/reports', label: 'Raporlar', section: 'analytics' },
    ],
  },
  {
    key: 'ops', label: 'Operasyon', defaultOpen: false,
    items: [
      { href: '/dashboard/control', label: 'Sunucu Kontrolü & Acil Durum', section: 'system' },
      { href: '/dashboard/backup', label: 'Yedekleme', section: 'backup' },
      { href: '/dashboard/legal', label: 'Yasal & Gizlilik', section: 'legal' },
    ],
  },
  {
    key: 'system', label: 'Yönetim', defaultOpen: false,
    items: [
      { href: '/dashboard/admins', label: 'Yönetici Hesapları', section: 'admins' },
      { href: '/dashboard/account', label: 'Hesabım (Parola · 2FA)' },
    ],
  },
];

function NavLink({ item, pathname, indent }: { item: NavItem; pathname: string; indent?: boolean }) {
  const unseen = useFeed((s) => s.unseenAlerts);
  const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'));
  return (
    <Link
      href={item.href}
      className={`flex items-center justify-between rounded-lg text-sm transition-colors ${indent ? 'pl-5 pr-3 py-1.5' : 'px-3 py-2'} ${isActive ? 'bg-amber-600 text-white font-medium' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
    >
      <span>{indent && <span className={`inline-block mr-1.5 text-xs ${isActive ? 'text-amber-200' : 'text-gray-600'}`}>›</span>}{item.label}</span>
      {item.badge === 'alerts' && unseen > 0 && <span className="ml-2 rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">{unseen > 99 ? '99+' : unseen}</span>}
    </Link>
  );
}

function NavGroupSection({ group, pathname, role }: { group: NavGroup; pathname: string; role?: string }) {
  const items = group.items.filter((i) => !i.section || canRead(role, i.section));
  const isGroupActive = items.some((item) => pathname === item.href || pathname.startsWith(item.href + '/'));
  const [open, setOpen] = useState(group.defaultOpen ?? isGroupActive);
  if (!items.length) return null;
  if (!group.label) return <div className="mb-1 space-y-0.5">{items.map((i) => <NavLink key={i.href} item={i} pathname={pathname} />)}</div>;
  return (
    <div className="mb-1">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-gray-500 uppercase tracking-wider hover:text-gray-300 transition-colors">
        <span>{group.label}</span>
        <span className={`transition-transform duration-200 text-gray-600 ${open || isGroupActive ? 'rotate-90' : ''}`} aria-hidden>›</span>
      </button>
      {(open || isGroupActive) && <div className="space-y-0.5 mt-0.5">{items.map((i) => <NavLink key={i.href} item={i} pathname={pathname} indent />)}</div>}
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { data } = useSession();
  const role = (data as { role?: string } | null)?.role;
  const name = data?.user?.name ?? '';

  return (
    <aside className="w-64 shrink-0 flex flex-col bg-gray-900 border-r border-gray-800 min-h-screen">
      <div className="px-6 py-5 border-b border-gray-800 flex items-center gap-2">
        <span className="text-amber-500 font-bold text-lg tracking-tight">KoW Yönetim</span>
        <span className="text-xs text-gray-600 font-normal mt-0.5">v3</span>
      </div>
      <nav className="flex-1 py-3 px-2 overflow-y-auto space-y-1">
        {NAV_GROUPS.map((g) => <NavGroupSection key={g.key} group={g} pathname={pathname} role={role} />)}
      </nav>
      <div className="p-4 border-t border-gray-800">
        <div className="mb-2 text-xs text-gray-500">{name} <span className="text-gray-600">· {ROLE_LABEL[role ?? ''] ?? role}</span></div>
        <button onClick={() => signOut({ callbackUrl: '/login' })} className="w-full rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white">Çıkış Yap</button>
      </div>
    </aside>
  );
}
