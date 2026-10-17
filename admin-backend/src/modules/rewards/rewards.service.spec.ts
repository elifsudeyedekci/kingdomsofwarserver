jest.mock('../../database/prisma.service', () => ({ PrismaService: class {} }));
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RewardsService, rewardId, SEASON_TIERS } from './rewards.service';

function make(peak: number, owned: string[] = [], season: any = { id: 's-id', number: 3 }) {
  const inv: any[] = owned.map((itemId) => ({ itemId }));
  const prisma: any = {
    season: { findFirst: jest.fn().mockResolvedValue(season) },
    playerProfile: { findUnique: jest.fn().mockResolvedValue({ peakMmr: peak }) },
    playerInventory: { findMany: jest.fn(() => Promise.resolve(inv)), create: jest.fn(({ data }: any) => { inv.push(data); return Promise.resolve(data); }) },
  };
  return { svc: new RewardsService(prisma), prisma };
}

describe('RewardsService', () => {
  it('lists every tier of the active season with earned/claimed state from the peak rating', async () => {
    const { svc } = make(1350, [rewardId(3, 'bronze')]); const l = await svc.list('u');
    expect(l.map((r) => r.tier)).toEqual(SEASON_TIERS.map((t) => t.tier));
    expect(l.filter((r) => r.earned).map((r) => r.tier)).toEqual(['bronze', 'silver', 'gold']);
    expect(l.find((r) => r.tier === 'bronze')!.claimed).toBe(true); expect(l.find((r) => r.tier === 'gold')!.claimed).toBe(false);
  });
  it('claims an earned reward once and is idempotent', async () => {
    const { svc, prisma } = make(1200);
    expect(await svc.claim('u', rewardId(3, 'silver'))).toEqual({ claimed: true, granted: true });
    expect(await svc.claim('u', rewardId(3, 'silver'))).toEqual({ claimed: true, granted: false }); expect(prisma.playerInventory.create).toHaveBeenCalledTimes(1);
  });
  it('refuses unearned and unknown rewards, and needs an active season', async () => {
    const { svc } = make(1000);
    await expect(svc.claim('u', rewardId(3, 'master'))).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.claim('u', 'nope')).rejects.toBeInstanceOf(NotFoundException);
    const none = make(1000, [], null); await expect(none.svc.list('u')).rejects.toBeInstanceOf(NotFoundException);
  });
});
