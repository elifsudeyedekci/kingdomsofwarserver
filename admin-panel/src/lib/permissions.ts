/**
 * What each role may do in the panel. MIRRORS admin-backend/src/common/policy/route-policy.ts (the server is the authority and enforces it on every request;
 * this table only hides buttons / menu entries a role could not use anyway).
 */
export type Section =
  | 'players' | 'moderation' | 'grants' | 'cheat' | 'security' | 'content' | 'live' | 'store' | 'liveops' | 'localization' | 'config' | 'notifications' | 'support'
  | 'payments' | 'system' | 'analytics' | 'backup' | 'cost' | 'admins' | 'legal' | 'ai' | 'tournaments';

const ALL = ['super_admin', 'owner', 'developer', 'game_designer', 'live_ops', 'support', 'moderator', 'finance', 'marketing', 'analyst'];

/** write = may change things; read = may open the page (omitted = every admin). owner and super_admin may always do everything. */
const TABLE: Record<Section, { write: string[]; read?: string[] }> = {
  players: { write: ['support', 'moderator'] },
  moderation: { write: ['support', 'moderator', 'developer'] },
  grants: { write: ['live_ops', 'support', 'developer', 'finance'] },
  cheat: { write: ['moderator', 'support', 'developer'] },
  security: { write: ['developer'], read: ['developer', 'moderator'] },
  content: { write: ['game_designer', 'developer', 'live_ops'] },
  live: { write: ['live_ops', 'developer'] },
  store: { write: ['live_ops', 'finance', 'marketing'] },
  liveops: { write: ['live_ops', 'game_designer', 'marketing'] },
  localization: { write: ['live_ops', 'game_designer', 'marketing'] },
  config: { write: ['developer', 'live_ops', 'game_designer'] },
  notifications: { write: ['marketing', 'live_ops', 'support'] },
  support: { write: ['support', 'moderator'] },
  system: { write: [], read: ['developer', 'moderator', 'support', 'live_ops', 'finance'] },
  payments: { write: ['finance'], read: ['finance', 'developer', 'support'] },
  analytics: { write: ['analyst'] },
  backup: { write: ['developer'], read: ['developer'] },
  cost: { write: ['finance', 'developer'], read: ['finance', 'developer'] },
  admins: { write: ['developer'], read: ['developer'] },
  legal: { write: ['support', 'finance'], read: ['support', 'finance', 'marketing', 'developer'] },
  ai: { write: ['developer'] },
  tournaments: { write: ['live_ops'] },
};

const TOP = new Set(['owner', 'super_admin']);
export const canRead = (role: string | undefined, s: Section) => !!role && (TOP.has(role) || (TABLE[s].read ? TABLE[s].read!.includes(role) || TABLE[s].write.includes(role) : ALL.includes(role)));
export const canWrite = (role: string | undefined, s: Section) => !!role && (TOP.has(role) || TABLE[s].write.includes(role));

export const ROLE_LABEL: Record<string, string> = {
  owner: 'Sahip', super_admin: 'Süper Yönetici', developer: 'Geliştirici', game_designer: 'Oyun Tasarımcısı', live_ops: 'Canlı Operasyon',
  support: 'Destek', moderator: 'Moderatör', finance: 'Finans', marketing: 'Pazarlama', analyst: 'Analist',
};
