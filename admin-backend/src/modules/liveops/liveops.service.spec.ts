import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { LiveOpsService } from './liveops.service';
import { PrismaService } from '../../database/prisma.service';

const mockPrisma: any = {
  season:       { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  liveOpsEvent: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
  battlePass:   { upsert: jest.fn(), update: jest.fn() },
  quest:        { findMany: jest.fn(), create: jest.fn() },
  chest:        { findUnique: jest.fn(), findMany: jest.fn() },
  $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
};

describe('LiveOpsService', () => {
  let service: LiveOpsService;

  beforeEach(async () => {
    jest.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [LiveOpsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<LiveOpsService>(LiveOpsService);
  });

  describe('getActiveSeason()', () => {
    it('returns the active season when found', async () => {
      const season = { id: 's1', number: 1, name: 'S1', isActive: true, bpMaxLevel: 100 };
      mockPrisma.season.findFirst.mockResolvedValue(season);
      await expect(service.getActiveSeason()).resolves.toEqual(season);
    });

    it('throws NotFoundException when no active season', async () => {
      mockPrisma.season.findFirst.mockResolvedValue(null);
      await expect(service.getActiveSeason()).rejects.toThrow(NotFoundException);
    });
  });

  describe('createEvent()', () => {
    it('creates and returns the event', async () => {
      const dto: any = {
        titleKey: 'k', descKey: 'd', type: 'double_xp',
        startAt: new Date(), endAt: new Date(), config: {},
      };
      const created = { id: 'ev1', ...dto, countries: [], isActive: false };
      mockPrisma.liveOpsEvent.create.mockResolvedValue(created);
      await expect(service.createEvent(dto)).resolves.toEqual(created);
      expect(mockPrisma.liveOpsEvent.create).toHaveBeenCalled();
    });
  });

  describe('getActiveEvents()', () => {
    it('excludes events when countryCode not in countries list', async () => {
      const ev = {
        id: 'ev1', isActive: true,
        startAt: new Date(Date.now() - 1000), endAt: new Date(Date.now() + 1000),
        countries: ['US', 'DE'], minVersion: null,
      };
      mockPrisma.liveOpsEvent.findMany.mockResolvedValue([ev]);
      const result = await service.getActiveEvents('TR');
      expect(result).toHaveLength(0);
    });
  });

  describe('grantBattlePassXp()', () => {
    const season = { id: 's1', bpMaxLevel: 100, isActive: true };
    const baseBp = { userId: 'u1', seasonId: 's1', xp: 500, level: 0, isPremium: false };

    beforeEach(() => {
      mockPrisma.season.findUnique.mockResolvedValue(season);
      mockPrisma.battlePass.upsert.mockResolvedValue(baseBp);
    });

    it('increments xp and calculates level (500+600=1100 → level 1)', async () => {
      const updated = { ...baseBp, xp: 1100, level: 1 };
      mockPrisma.battlePass.update.mockResolvedValue(updated);
      const result = await service.grantBattlePassXp('u1', 's1', 600);
      expect(result.level).toBe(1);
      expect(result.xp).toBe(1100);
    });

    it('caps level at bpMaxLevel', async () => {
      const highBp = { ...baseBp, xp: 99000, level: 99 };
      mockPrisma.battlePass.upsert.mockResolvedValue(highBp);
      mockPrisma.battlePass.update.mockResolvedValue({ ...highBp, xp: 199000, level: 100 });
      const result = await service.grantBattlePassXp('u1', 's1', 100000);
      expect(result.level).toBe(100);
    });

    it('throws BadRequestException for non-positive xp', async () => {
      await expect(service.grantBattlePassXp('u1', 's1', 0)).rejects.toThrow(BadRequestException);
      await expect(service.grantBattlePassXp('u1', 's1', -5)).rejects.toThrow(BadRequestException);
    });
  });

  describe('purchasePremiumPass()', () => {
    const season = { id: 's1', bpMaxLevel: 100 };

    beforeEach(() => {
      mockPrisma.season.findUnique.mockResolvedValue(season);
    });

    it('sets isPremium true when not yet purchased', async () => {
      mockPrisma.battlePass.upsert.mockResolvedValue({ isPremium: false });
      mockPrisma.battlePass.update.mockResolvedValue({ isPremium: true, purchasedAt: new Date() });
      const result = await service.purchasePremiumPass('u1', 's1');
      expect(result.isPremium).toBe(true);
    });

    it('throws BadRequestException when already purchased', async () => {
      mockPrisma.battlePass.upsert.mockResolvedValue({ isPremium: true });
      await expect(service.purchasePremiumPass('u1', 's1')).rejects.toThrow(BadRequestException);
    });
  });
});
