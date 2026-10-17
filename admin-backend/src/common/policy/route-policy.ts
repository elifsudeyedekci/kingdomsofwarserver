/**
 * Central role policy for the ADMIN API (default deny). One table, one place to audit.
 * - `write`: roles allowed to call non-GET routes under the first path segment.
 * - `read`: roles allowed to call GET routes; when omitted every admin role may read.
 * `owner` and `super_admin` always pass. A path segment that is not in the table is writable only by `developer`.
 */
export const ADMIN_ROLES = ['super_admin', 'owner', 'developer', 'game_designer', 'live_ops', 'support', 'moderator', 'finance', 'marketing', 'analyst'] as const;
export type AdminRoleName = (typeof ADMIN_ROLES)[number];

interface Policy { write: readonly string[]; read?: readonly string[] }

export const ROUTE_POLICY: Record<string, Policy> = {
  admin: { write: ['support', 'moderator', 'live_ops', 'developer'] },
  'admin-auth': { write: [] },
  admins: { write: ['developer'], read: ['developer'] },
  player: { write: ['support', 'moderator'] },
  match: { write: ['support', 'moderator', 'developer'] },
  matchmaking: { write: ['developer', 'live_ops'] },
  rewards: { write: ['live_ops', 'game_designer', 'support'] },
  store: { write: ['live_ops', 'finance', 'marketing'] },
  payment: { write: ['finance'], read: ['finance', 'developer', 'support'] },
  inventory: { write: ['support', 'live_ops'] },
  clan: { write: ['support', 'moderator'] },
  clans: { write: ['support', 'moderator'] },
  tournament: { write: ['live_ops'] },
  tournaments: { write: ['live_ops'] },
  leaderboard: { write: ['live_ops', 'support'] },
  notification: { write: ['marketing', 'live_ops', 'support'] },
  legal: { write: ['support', 'finance'], read: ['support', 'finance', 'marketing', 'developer'] },
  support: { write: ['support', 'moderator'] },
  reports: { write: ['analyst', 'finance'] },
  'master-data': { write: ['game_designer', 'developer'] },
  'remote-config': { write: ['developer', 'live_ops', 'game_designer'] },
  anticheat: { write: ['moderator', 'support', 'developer'] },
  fraud: { write: ['moderator', 'support', 'developer', 'finance'] },
  analytics: { write: ['analyst'] },
  backup: { write: ['developer'], read: ['developer'] },
  localization: { write: ['live_ops', 'game_designer', 'marketing'] },
  friendship: { write: ['support', 'moderator'] },
  'cost-control': { write: ['finance', 'developer'], read: ['finance', 'developer'] },
  liveops: { write: ['live_ops', 'game_designer', 'marketing'] },
  achievements: { write: ['game_designer', 'live_ops'] },
  content: { write: ['game_designer', 'developer', 'live_ops'] },
  'live-admin': { write: ['live_ops', 'developer'] },
  moderation: { write: ['support', 'moderator', 'developer'] },
  session: { write: [] },
  insights: { write: [] },
  system: { write: [], read: ['developer', 'moderator', 'support', 'live_ops', 'finance'] },
  privacy: { write: [] },
  audit: { write: [], read: ['developer', 'moderator', 'finance'] },
  cheatwatch: { write: ['moderator', 'support', 'developer'] },
  integrity: { write: [] },
  grants: { write: ['live_ops', 'support', 'developer', 'finance'] },
  me: { write: [] },
  security: { write: ['developer'], read: ['developer', 'moderator'] },
  health: { write: [] },
};

const ALWAYS = new Set(['owner', 'super_admin']);

export function adminMayAccess(role: string, firstSegment: string, method: string): boolean {
  if (ALWAYS.has(role)) return true;
  const policy = ROUTE_POLICY[firstSegment];
  const isRead = method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
  if (!policy) return !isRead ? role === 'developer' : (ADMIN_ROLES as readonly string[]).includes(role);
  if (isRead) return policy.read ? policy.read.includes(role) || policy.write.includes(role) : (ADMIN_ROLES as readonly string[]).includes(role);
  return policy.write.includes(role);
}
