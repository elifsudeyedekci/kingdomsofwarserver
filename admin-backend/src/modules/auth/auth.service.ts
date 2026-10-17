import {
  Injectable,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../database/redis.module';
import { AdminGateway } from '../../gateway/admin.gateway';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { RegisterDto } from './dto/register.dto';
import { assertNotBanned } from '../../common/ban.util';
import { JwtPayload, PLAYER_AUD } from './strategies/jwt.strategy';
import { JWT_ISS } from '../admin-auth/admin-session.service';

const REFRESH_EXPIRES_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const REFRESH_EXPIRES_SECONDS = REFRESH_EXPIRES_MS / 1000; // Redis TTL

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly gateway: AdminGateway,
  ) {}

  async register(dto: RegisterDto) {
    const [existingEmail, existingUsername] = await Promise.all([
      this.prisma.user.findUnique({ where: { email: dto.email } }),
      this.prisma.playerProfile.findUnique({ where: { username: dto.username } }),
    ]);
    if (existingEmail) throw new ConflictException('Email already in use');
    if (existingUsername) throw new ConflictException('Username already taken');

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          isGuest: false,
          emailVerified: false,
        },
      });
      await tx.playerProfile.create({
        data: { userId: created.id, username: dto.username },
      });
      return created;
    });

    this.gateway.emitPlayerRegistered({ playerId: user.id, username: dto.username });
    return this.issueTokenPair(user.id, dto.username);
  }

  async validateCredentials(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { profile: { select: { username: true } } },
    });
    if (!user || !user.passwordHash || !user.isActive || user.deletedAt) return null;
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return null;
    return user;
  }

  async login(userId: string, username: string) {
    await assertNotBanned(this.prisma, userId);
    return this.issueTokenPair(userId, username);
  }

  /**
   * Anonymous device account for the game client: the client generates guestId + secret once, keeps them in its save and signs in with them on later starts.
   * The secret is stored only as a bcrypt hash. The first call creates the account, later calls authenticate it.
   */
  async guest(guestId: string, secret: string) {
    if (!/^[A-Za-z0-9-]{16,64}$/.test(guestId ?? '') || !/^[A-Za-z0-9]{24,128}$/.test(secret ?? '')) throw new BadRequestException('guestId / secret have an invalid format');
    let user = await this.prisma.user.findUnique({ where: { guestId }, include: { profile: { select: { username: true } } } });
    if (user) {
      if (!user.passwordHash || !(await bcrypt.compare(secret, user.passwordHash))) throw new UnauthorizedException('Wrong guest credentials');
      if (user.deletedAt) throw new UnauthorizedException();
      if (!user.isActive) { await assertNotBanned(this.prisma, user.id); throw new UnauthorizedException(); }       // the secret is correct: a banned player is told it is a BAN (403 + reason), not a generic 401
    } else {
      const passwordHash = await bcrypt.hash(secret, 10);
      const username = `Player-${crypto.randomBytes(3).toString('hex')}`;
      user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({ data: { guestId, passwordHash, isGuest: true } });
        await tx.playerProfile.create({ data: { userId: created.id, username } });
        return { ...created, profile: { username } };
      });
      this.gateway.emitPlayerRegistered({ playerId: user.id, username: user.profile?.username ?? '' });
    }
    await assertNotBanned(this.prisma, user.id);
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(() => null);
    const username = user.profile?.username ?? '';
    return { ...(await this.issueTokenPair(user.id, username)), userId: user.id, username };
  }

  async refresh(rawToken: string) {
    const tokenHash = hashToken(rawToken);
    const session = await this.prisma.playerSession.findUnique({
      where: { refreshToken: tokenHash },
      include: { user: { include: { profile: { select: { username: true } } } } },
    });

    if (!session || !session.isValid || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    await this.prisma.playerSession.update({
      where: { id: session.id },
      data: { isValid: false, revokedAt: new Date() },
    });

    const username = session.user.profile?.username ?? '';
    await assertNotBanned(this.prisma, session.userId);
    return this.issueTokenPair(session.userId, username);
  }

  async logout(rawToken: string) {
    const tokenHash = hashToken(rawToken);
    await this.prisma.playerSession.updateMany({
      where: { refreshToken: tokenHash, isValid: true },
      data: { isValid: false, revokedAt: new Date() },
    });

    // Blacklist the refresh token in Redis for 7 days as a fast-path guard
    const b64Token = Buffer.from(rawToken).toString('base64');
    await this.redis.setex(`blacklist:${b64Token}`, 7 * 24 * 60 * 60, '1').catch(() => null);
  }

  async issueTokenPair(userId: string, username: string) {
    const payload: JwtPayload = { sub: userId, username, typ: 'player' };
    const accessToken = this.jwt.sign({ ...payload, jti: crypto.randomBytes(12).toString('hex') }, { audience: PLAYER_AUD, issuer: JWT_ISS });

    const rawRefresh = crypto.randomBytes(48).toString('hex');
    const tokenHash = hashToken(rawRefresh);
    const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_MS);

    await this.prisma.playerSession.create({
      data: { userId, refreshToken: tokenHash, expiresAt },
    });

    return { accessToken, refreshToken: rawRefresh, expiresAt };
  }

  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { profile: true },
    });
    if (!user || user.deletedAt) throw new NotFoundException('User not found');
    return user;
  }
}
