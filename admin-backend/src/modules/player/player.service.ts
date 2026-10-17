import { Optional } from '@nestjs/common';
import { PrivacyService } from '../privacy/privacy.service';
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AdminGateway } from '../../gateway/admin.gateway';
import { UpdateProfileDto } from './dto/update-profile.dto';

const PROFILE_SELECT = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  level: true,
  xp: true,
  mmr: true,
  peakMmr: true,
  currentRank: true,
  totalMatches: true,
  wins: true,
  losses: true,
  favoriteCivId: true,
  clanId: true,
  isPremium: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class PlayerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: AdminGateway,
    @Optional() private readonly privacy?: PrivacyService,
  ) {}

  async getMe(userId: string) {
    return this.getById(userId);
  }

  async getById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        isActive: true,
        deletedAt: true,
        registeredAt: true,
        lastLoginAt: true,
        profile: { select: PROFILE_SELECT },
      },
    });
    if (!user || user.deletedAt) throw new NotFoundException('Player not found');
    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const profile = await this.prisma.playerProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Profile not found');

    return this.prisma.playerProfile.update({
      where: { userId },
      data: {
        displayName: dto.displayName,
        avatarUrl: dto.avatarUrl,
        favoriteCivId: dto.favoriteCivId,
      },
      select: PROFILE_SELECT,
    });
  }

  async getStats(userId: string) {
    const profile = await this.prisma.playerProfile.findUnique({
      where: { userId },
      select: {
        mmr: true,
        peakMmr: true,
        currentRank: true,
        totalMatches: true,
        wins: true,
        losses: true,
        level: true,
        xp: true,
      },
    });
    if (!profile) throw new NotFoundException('Profile not found');
    return profile;
  }

  async getMatchHistory(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.matchPlayer.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { match: { createdAt: 'desc' } },
        select: {
          slot: true,
          teamId: true,
          civId: true,
          mmrBefore: true,
          mmrAfter: true,
          mmrDelta: true,
          isWinner: true,
          surrendered: true,
          match: {
            select: {
              id: true,
              mode: true,
              status: true,
              mapId: true,
              startedAt: true,
              endedAt: true,
              durationTicks: true,
            },
          },
        },
      }),
      this.prisma.matchPlayer.count({ where: { userId } }),
    ]);
    return { items, total, page, limit };
  }

  async softDelete(userId: string, requesterId: string) {
    if (userId !== requesterId) throw new ForbiddenException();
    // account deletion = a real erasure of the personal data (not just a flag)
    if (this.privacy) { await this.privacy.erase(userId, 'player'); return; }
    await this.prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  async updateLastLogin(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
    // Fire a lightweight stats nudge so admin dashboard live counters refresh
    const activePlayers = await this.prisma.user.count({
      where: { lastLoginAt: { gte: new Date(Date.now() - 5 * 60 * 1000) } },
    });
    this.gateway.emitStatsUpdate({ activePlayers, activeMatches: 0, onlineAdmins: 0 });
  }
}
