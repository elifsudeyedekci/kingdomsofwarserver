import { Injectable, NestMiddleware } from '@nestjs/common';
import { SecurityService } from './security.service';
import { requestStats } from '../system/system.service';

/**
 * First thing every request meets: (1) blocked IP -> 403 immediately, (2) attack signatures in URL / query -> 400 + event + offense counter (too many = automatic IP block),
 * (3) API responses are never cached by browsers or proxies.
 */
/** Routes only the panel uses: an automatic IP block is enforced here and nowhere else. */
const ADMIN_SURFACE = /^\/(admin|admin-auth|admins|security|content|live-admin|master-data|remote-config|backup|payment|cost-control|anticheat|fraud|support|legal|reports|moderation|grants|cheatwatch|insights|system|audit|store|inventory|liveops|localization)(\/|\?|$)/;

@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  constructor(private readonly security: SecurityService) {}

  async use(req: { ip?: string; originalUrl?: string; url?: string; headers: Record<string, string | string[] | undefined> }, res: { status(c: number): { json(b: unknown): void }; setHeader(k: string, v: string): void }, next: () => void) {
    requestStats.total++;
    const ip = req.ip;
    const url0 = String(req.originalUrl ?? req.url ?? '');
    const adminSurface = ADMIN_SURFACE.test(url0);
    if (await this.security.isBlocked(ip, adminSurface)) return res.status(403).json({ statusCode: 403, message: 'Forbidden' });
    const url = String(req.originalUrl ?? req.url ?? '');
    const hit = this.security.scan(url);
    if (hit) {
      void this.security.event('ATTACK_SIGNATURE', 'high', { ip, userAgent: String(req.headers['user-agent'] ?? '') }, { signature: hit, url: url.slice(0, 300) });
      void this.security.offense(ip, hit);
      return res.status(400).json({ statusCode: 400, message: 'Bad request' });
    }
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    next();
  }
}
