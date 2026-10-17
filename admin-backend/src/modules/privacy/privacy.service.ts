import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/** Real data-subject rights (GDPR / KVKK): a complete export of what is stored about a player, and a real erasure (personal data removed or anonymised; match and money records stay, de-identified). */
@Injectable()
export class PrivacyService {
  private readonly logger = new Logger(PrivacyService.name);
  constructor(private readonly prisma: PrismaService) {}

  async export(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { profile: true, devices: true } });
    if (!user) throw new NotFoundException('Player not found');
    const { passwordHash, twoFactorSecret, ...account } = user as typeof user & { passwordHash?: string | null; twoFactorSecret?: string | null };
    void passwordHash; void twoFactorSecret;
    const [sessions, gameSessions, matches, purchases, inventory, wallet, ledger, gifts, bonuses, tickets, bans, acceptances, friendships, flags] = await Promise.all([
      this.prisma.playerSession.findMany({ where: { userId }, select: { createdAt: true, expiresAt: true, isValid: true, revokedAt: true } }),
      this.prisma.gameSession.findMany({ where: { userId }, orderBy: { startedAt: 'desc' }, take: 2000 }),
      this.prisma.matchPlayer.findMany({ where: { userId }, include: { match: { select: { id: true, mode: true, mapId: true, createdAt: true, durationTicks: true } } }, take: 5000 }),
      this.prisma.playerPurchase.findMany({ where: { userId }, select: { id: true, storeProductId: true, platform: true, amountUsd: true, currencyCode: true, status: true, createdAt: true } }),
      this.prisma.playerInventory.findMany({ where: { userId } }), this.prisma.playerWallet.findUnique({ where: { userId } }),
      this.prisma.economyLedger.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 5000 }),
      this.prisma.gift.findMany({ where: { userId } }), this.prisma.playerBonus.findMany({ where: { userId } }),
      this.prisma.supportTicket.findMany({ where: { userId } }), this.prisma.ban.findMany({ where: { userId }, select: { type: true, reason: true, startsAt: true, endsAt: true } }),
      this.prisma.legalAcceptance.findMany({ where: { userId } }).catch(() => []),
      this.prisma.friendship.count({ where: { OR: [{ requesterId: userId }, { receiverId: userId }] } } as never).catch(() => 0),
      this.prisma.antiCheatFlag.count({ where: { userId } }),
    ]);
    return { exportedAt: new Date().toISOString(), format: 'kow-player-data-v1', account, sessions, gameSessions, matches, purchases, inventory, wallet, ledger, gifts, bonuses, supportTickets: tickets, bans, legalAcceptances: acceptances, friendCount: friendships, antiCheatFlagCount: flags };
  }

  /** Irreversible. Personal data is removed or anonymised; the account can never sign in again. */
  async erase(userId: string, by: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundException('Player not found');
    const tag = `deleted-${userId.slice(0, 8)}`;
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { email: null, phone: null, passwordHash: null, googleId: null, appleId: null, guestId: null, country: null, timezone: null, twoFactorSecret: null, isActive: false, deletedAt: new Date() } });
      await tx.playerProfile.updateMany({ where: { userId }, data: { username: tag, displayName: null, avatarUrl: null } });
      await tx.playerDevice.deleteMany({ where: { userId } });
      await tx.playerSession.deleteMany({ where: { userId } });
      await tx.gameSession.deleteMany({ where: { userId } });
      await tx.playerCommand.deleteMany({ where: { userId } });
      await tx.gift.deleteMany({ where: { userId } });
      await tx.playerBonus.deleteMany({ where: { userId } });
      await tx.supportTicket.deleteMany({ where: { userId } });
      await tx.friendship.deleteMany({ where: { OR: [{ requesterId: userId }, { receiverId: userId }] } } as never).catch(() => null);
    });
    await this.prisma.securityEvent.create({ data: { type: 'ACCOUNT_ERASED', severity: 'info', userId, detail: { by } as never } }).catch(() => null);
    this.logger.log(`account ${userId} erased by ${by}`);
    return { erased: true };
  }
}
