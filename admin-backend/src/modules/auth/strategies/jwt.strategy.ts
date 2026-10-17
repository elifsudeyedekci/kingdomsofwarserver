import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service';
import { AdminSessionService, ADMIN_AUD, JWT_ISS } from '../../admin-auth/admin-session.service';
import { findActiveBan, isBannedCached } from '../../../common/ban.util';

export const PLAYER_AUD = 'kow-player';

export interface JwtPayload {
  sub: string;
  username: string;
  /** 'admin' for panel tokens (issued by /admin-auth), 'player' for game client tokens. */
  typ?: 'player' | 'admin';
  sid?: string;
  aud?: string;
  iss?: string;
}

export type AuthenticatedUser =
  | { kind: 'player'; id: string; email: string | null; username: string }
  | { kind: 'admin'; id: string; email: string; username: string; role: string; name: string; sid: string; limited: boolean };

/** Reads the (unverified) typ claim only to choose WHICH secret verifies the token; the signature is then verified with that secret and HS256 only (alg none / alg confusion impossible). */
function peekTyp(raw: string): string | undefined {
  try { return JSON.parse(Buffer.from(raw.split('.')[1], 'base64url').toString('utf8')).typ; } catch { return undefined; }
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private readonly prisma: PrismaService, private readonly sessions: AdminSessionService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ['HS256'],
      secretOrKeyProvider: (_req: unknown, raw: string, done: (err: Error | null, secret?: string) => void) => {
        done(null, peekTyp(raw) === 'admin' ? sessions.secret() : config.getOrThrow<string>('JWT_SECRET'));
      },
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (payload.typ === 'admin') {
      if (payload.aud !== ADMIN_AUD || payload.iss !== JWT_ISS || !payload.sid) throw new UnauthorizedException();
      const a = await this.sessions.principalFor(payload.sid, payload.sub);
      if (!a) throw new UnauthorizedException();
      return a;
    }
    if (payload.typ !== 'player' || payload.aud !== PLAYER_AUD || payload.iss !== JWT_ISS) throw new UnauthorizedException();
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, isActive: true, deletedAt: true, profile: { select: { username: true, currentRank: true } } },
    });
    if (!user || user.deletedAt) throw new UnauthorizedException();
    if (!user.isActive) {      // a permanently banned account is switched off: tell the client it is a BAN (403) so it shows the ban screen instead of retrying the login
      const ban = await findActiveBan(this.prisma, user.id);
      if (ban) throw new ForbiddenException({ code: 'BANNED', message: ban.reason, type: ban.type, endsAt: ban.endsAt });
      throw new UnauthorizedException();
    }
    if (await isBannedCached(this.prisma, user.id)) {
      const ban = await findActiveBan(this.prisma, user.id);
      throw new ForbiddenException({ code: 'BANNED', message: ban?.reason ?? 'This account is banned', type: ban?.type ?? 'permanent', endsAt: ban?.endsAt ?? null });
    }
    return { kind: 'player', id: user.id, email: user.email, username: user.profile?.username ?? payload.username };
  }
}
