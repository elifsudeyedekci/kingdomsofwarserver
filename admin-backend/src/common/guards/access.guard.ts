import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PLAYER_API_KEY } from '../decorators/player-api.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { ALLOW_LIMITED_KEY } from '../decorators/allow-limited.decorator';
import { adminMayAccess } from '../policy/route-policy';
import type { AuthenticatedUser } from '../../modules/auth/strategies/jwt.strategy';

/**
 * Global access control (replaces the plain JwtAuthGuard).
 *  1. @Public()            -> open.
 *  2. valid JWT required (player OR admin token; admin tokens are checked against AdminUser incl. revocation).
 *  3. @PlayerApi()         -> any authenticated principal (handlers scope data to req.user.id).
 *  4. everything else      -> ADMIN only (default deny); an explicit @Roles(...) wins, otherwise the central ROUTE_POLICY table decides.
 */
@Injectable()
export class AccessGuard extends JwtAuthGuard {
  constructor(reflector: Reflector) {
    super(reflector);
    this.rolesReflector = reflector;
  }
  private readonly rolesReflector: Reflector;

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ok = await super.canActivate(context);
    if (!ok) return false;
    const targets = [context.getHandler(), context.getClass()];
    // @Public routes skip authentication entirely (no user on the request)
    const req = context.switchToHttp().getRequest();
    const user = req.user as AuthenticatedUser | undefined;
    if (!user) return true;
    if (user.kind === 'admin' && user.limited && !this.rolesReflector.getAllAndOverride<boolean>(ALLOW_LIMITED_KEY, targets)) throw new ForbiddenException({ message: 'Two-factor setup required', code: 'TWO_FACTOR_SETUP_REQUIRED' });
    if (this.rolesReflector.getAllAndOverride<boolean>(PLAYER_API_KEY, targets)) return true;
    if (user.kind !== 'admin') throw new ForbiddenException('Admin access required');
    const explicit = this.rolesReflector.getAllAndOverride<string[]>(ROLES_KEY, targets);
    if (explicit && explicit.length) {
      if (user.role === 'owner' || user.role === 'super_admin' || explicit.includes(user.role)) return true;
      throw new ForbiddenException('Your role may not use this endpoint');
    }
    const first = String(req.route?.path ?? req.path ?? '').split('?')[0].split('/').filter(Boolean)[0] ?? '';
    if (!adminMayAccess(user.role, first, String(req.method).toUpperCase())) throw new ForbiddenException('Your role may not use this endpoint');
    return true;
  }
}
