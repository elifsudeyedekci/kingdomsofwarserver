import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccessGuard } from './access.guard';
import { PLAYER_API_KEY } from '../decorators/player-api.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { adminMayAccess } from '../policy/route-policy';

/** AccessGuard with the passport step stubbed: `user` is what the JWT strategy would have attached. */
function run(opts: { user?: unknown; meta?: Record<string, unknown>; method?: string; path?: string }) {
  const meta = opts.meta ?? {};
  const reflector = { getAllAndOverride: (k: string) => meta[k] } as unknown as Reflector;
  const guard = new AccessGuard(reflector);
  // JwtAuthGuard.canActivate -> passport; replace with the already-authenticated outcome
  (Object.getPrototypeOf(AccessGuard.prototype) as { canActivate: unknown }).canActivate = async () => true;
  const req = { user: opts.user, method: opts.method ?? 'GET', path: opts.path ?? '/admin/players', route: { path: opts.path ?? '/admin/players' } };
  const ctx = { getHandler: () => ({}), getClass: () => ({}), switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
  return guard.canActivate(ctx);
}

const player = { kind: 'player', id: 'p1', email: 'a@b.c', username: 'x' };
const admin = (role: string) => ({ kind: 'admin', id: 'a1', email: 'a@b.c', username: 'n', name: 'n', role });

describe('AccessGuard (default deny)', () => {
  it('lets @Public routes through without a user', async () => {
    await expect(run({ meta: { [IS_PUBLIC_KEY]: true } })).resolves.toBe(true);
  });
  it('rejects a PLAYER token on an admin route', async () => {
    await expect(run({ user: player })).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('lets a player use @PlayerApi routes', async () => {
    await expect(run({ user: player, meta: { [PLAYER_API_KEY]: true }, path: '/player/me' })).resolves.toBe(true);
  });
  it('lets an admin use @PlayerApi routes too (support tooling)', async () => {
    await expect(run({ user: admin('support'), meta: { [PLAYER_API_KEY]: true } })).resolves.toBe(true);
  });
  it('owner and super_admin pass everywhere', async () => {
    await expect(run({ user: admin('owner'), method: 'DELETE', path: '/backup/1' })).resolves.toBe(true);
    await expect(run({ user: admin('super_admin'), method: 'POST', path: '/payment/refund' })).resolves.toBe(true);
  });
  it('an explicit @Roles(...) wins over the policy table', async () => {
    await expect(run({ user: admin('marketing'), meta: { [ROLES_KEY]: ['marketing'] }, method: 'POST', path: '/backup' })).resolves.toBe(true);
    await expect(run({ user: admin('support'), meta: { [ROLES_KEY]: ['marketing'] }, method: 'POST', path: '/backup' })).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('applies the central policy for unmarked admin routes', async () => {
    await expect(run({ user: admin('support'), method: 'POST', path: '/admin/players/1/ban' })).resolves.toBe(true);
    await expect(run({ user: admin('analyst'), method: 'POST', path: '/admin/players/1/ban' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(run({ user: admin('analyst'), method: 'GET', path: '/admin/players' })).resolves.toBe(true);
  });
});

describe('route policy table', () => {
  it('finance may write payments, game_designer may not', () => {
    expect(adminMayAccess('finance', 'payment', 'POST')).toBe(true);
    expect(adminMayAccess('game_designer', 'payment', 'POST')).toBe(false);
  });
  it('sensitive areas are read-restricted', () => {
    expect(adminMayAccess('marketing', 'backup', 'GET')).toBe(false);
    expect(adminMayAccess('developer', 'backup', 'GET')).toBe(true);
    expect(adminMayAccess('analyst', 'payment', 'GET')).toBe(false);
  });
  it('unknown areas: only developer may write, every admin may read', () => {
    expect(adminMayAccess('developer', 'brand-new-area', 'POST')).toBe(true);
    expect(adminMayAccess('support', 'brand-new-area', 'POST')).toBe(false);
    expect(adminMayAccess('support', 'brand-new-area', 'GET')).toBe(true);
  });
  it('only content/data roles may edit master data and remote config', () => {
    expect(adminMayAccess('game_designer', 'master-data', 'PATCH')).toBe(true);
    expect(adminMayAccess('support', 'master-data', 'PATCH')).toBe(false);
    expect(adminMayAccess('live_ops', 'remote-config', 'POST')).toBe(true);
    expect(adminMayAccess('moderator', 'remote-config', 'POST')).toBe(false);
  });
});
