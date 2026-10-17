import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/** Season reward tiers: the reward is earned once the player's PEAK rating of the season reaches the tier's rating. Server-authoritative; the client only lists and claims. */
export const SEASON_TIERS: { tier: string; minMmr: number }[] = [
  { tier: 'bronze', minMmr: 0 }, { tier: 'silver', minMmr: 1100 }, { tier: 'gold', minMmr: 1300 },
  { tier: 'platinum', minMmr: 1500 }, { tier: 'diamond', minMmr: 1700 }, { tier: 'master', minMmr: 1900 },
];
export const REWARD_ITEM_TYPE = 'season_reward';
export const rewardId = (seasonNumber: number, tier: string) => `season${seasonNumber}_${tier}`;

@Injectable()
export class RewardsService {
  constructor(private readonly prisma: PrismaService) {}

  private async activeSeason() {
    const s = await this.prisma.season.findFirst({ where: { isActive: true }, orderBy: { number: 'desc' } });
    if (!s) throw new NotFoundException('no active season');
    return s;
  }

  /** Rewards of the active season with their state for one player: earned (peak rating high enough) and claimed (inventory row exists). */
  async list(userId: string) {
    const season = await this.activeSeason();
    const profile = await this.prisma.playerProfile.findUnique({ where: { userId } });
    const peak = profile?.peakMmr ?? 1000;
    const owned = await this.prisma.playerInventory.findMany({ where: { userId, itemType: REWARD_ITEM_TYPE } });
    const have = new Set(owned.map((o: any) => o.itemId));
    return SEASON_TIERS.map((t) => ({ rewardId: rewardId(season.number, t.tier), seasonId: season.id, tier: t.tier, requiredRating: t.minMmr, earned: peak >= t.minMmr, claimed: have.has(rewardId(season.number, t.tier)) }));
  }

  /** Claims one reward: only when earned, only once (idempotent: a second claim changes nothing). */
  async claim(userId: string, id: string) {
    const all = await this.list(userId); const r = all.find((x) => x.rewardId === id);
    if (!r) throw new NotFoundException('unknown reward');
    if (!r.earned) throw new BadRequestException('reward not earned yet');
    if (r.claimed) return { claimed: true, granted: false };
    await this.prisma.playerInventory.create({ data: { userId, itemType: REWARD_ITEM_TYPE, itemId: id, quantity: 1, source: 'season_reward' } });
    return { claimed: true, granted: true };
  }
}
