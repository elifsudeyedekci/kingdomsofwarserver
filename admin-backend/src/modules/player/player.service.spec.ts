import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { PlayerService } from './player.service';
import { PrismaService } from '../../database/prisma.service';
import { AdminGateway } from '../../gateway/admin.gateway';

const mockPrisma: any = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  playerProfile: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  matchPlayer: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

describe('PlayerService', () => {
  let service: PlayerService;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: AdminGateway, useValue: new Proxy({}, { get: (_t, p) => (p === 'then' ? undefined : jest.fn()) }) },
        PlayerService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PlayerService>(PlayerService);
  });

  // -------------------------------------------------------------------------
  // getById()
  // -------------------------------------------------------------------------
  describe('getById()', () => {
    const baseUser = {
      id: 'user-1',
      email: 'test@example.com',
      isActive: true,
      deletedAt: null,
      registeredAt: new Date(),
      lastLoginAt: null,
      profile: {
        id: 'profile-1',
        username: 'testuser',
        displayName: null,
        avatarUrl: null,
        level: 1,
        xp: 0,
        mmr: 1000,
        peakMmr: 1000,
        currentRank: null,
        totalMatches: 0,
        wins: 0,
        losses: 0,
        favoriteCivId: null,
        clanId: null,
        isPremium: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    it('returns merged user+profile when user is found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(baseUser);

      const result = await service.getById('user-1');

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'user-1' } }),
      );
      expect(result).toEqual(baseUser);
    });

    it('throws NotFoundException when user is not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getById('nonexistent')).rejects.toThrow(NotFoundException);
      await expect(service.getById('nonexistent')).rejects.toThrow('Player not found');
    });

    it('throws NotFoundException when user is soft-deleted (deletedAt set)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        deletedAt: new Date(),
      });

      await expect(service.getById('user-1')).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // updateProfile()
  // -------------------------------------------------------------------------
  describe('updateProfile()', () => {
    it('updates displayName, avatarUrl, and favoriteCivId', async () => {
      const existingProfile = { userId: 'user-1', username: 'testuser' };
      const dto = {
        displayName: 'Test Warrior',
        avatarUrl: 'https://example.com/avatar.png',
        favoriteCivId: 'civ-franks',
      };
      const updatedProfile = { ...existingProfile, ...dto };

      mockPrisma.playerProfile.findUnique.mockResolvedValue(existingProfile);
      mockPrisma.playerProfile.update.mockResolvedValue(updatedProfile);

      const result = await service.updateProfile('user-1', dto);

      expect(mockPrisma.playerProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
          data: expect.objectContaining({
            displayName: dto.displayName,
            avatarUrl: dto.avatarUrl,
            favoriteCivId: dto.favoriteCivId,
          }),
        }),
      );
      expect(result).toEqual(updatedProfile);
    });

    it('throws NotFoundException when profile does not exist', async () => {
      mockPrisma.playerProfile.findUnique.mockResolvedValue(null);

      await expect(service.updateProfile('user-1', {})).rejects.toThrow(NotFoundException);
      await expect(service.updateProfile('user-1', {})).rejects.toThrow('Profile not found');
    });
  });

  // -------------------------------------------------------------------------
  // getMatchHistory()
  // -------------------------------------------------------------------------
  describe('getMatchHistory()', () => {
    const mockItems = [
      { slot: 0, teamId: 0, civId: 'civ-1', mmrBefore: 1000, mmrAfter: 1016, mmrDelta: 16, isWinner: true, surrendered: false, match: { id: 'match-1', mode: '1v1', status: 'completed', mapId: 'map-1', startedAt: new Date(), endedAt: new Date(), durationTicks: 5000 } },
    ];

    it('returns paginated results for page 1', async () => {
      mockPrisma.matchPlayer.findMany.mockResolvedValue(mockItems);
      mockPrisma.matchPlayer.count.mockResolvedValue(1);

      const result = await service.getMatchHistory('user-1', 1, 20);

      expect(mockPrisma.matchPlayer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1' }, skip: 0, take: 20 }),
      );
      expect(result).toEqual({ items: mockItems, total: 1, page: 1, limit: 20 });
    });

    it('uses skip=5, take=5 for page 2 with limit 5', async () => {
      mockPrisma.matchPlayer.findMany.mockResolvedValue([]);
      mockPrisma.matchPlayer.count.mockResolvedValue(10);

      const result = await service.getMatchHistory('user-1', 2, 5);

      expect(mockPrisma.matchPlayer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 5, take: 5 }),
      );
      expect(result.page).toBe(2);
      expect(result.limit).toBe(5);
      expect(result.total).toBe(10);
    });
  });

  // -------------------------------------------------------------------------
  // softDelete()
  // -------------------------------------------------------------------------
  describe('softDelete()', () => {
    it('sets deletedAt and isActive=false for the requesting user', async () => {
      const userId = 'user-1';
      mockPrisma.user.update.mockResolvedValue({ id: userId, isActive: false, deletedAt: new Date() });

      await service.softDelete(userId, userId);

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: userId },
          data: expect.objectContaining({ isActive: false }),
        }),
      );

      const updateCall = mockPrisma.user.update.mock.calls[0][0];
      expect(updateCall.data.deletedAt).toBeInstanceOf(Date);
    });

    it('throws ForbiddenException when requesterId does not match userId', async () => {
      await expect(service.softDelete('user-1', 'other-user')).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });
  });
});
