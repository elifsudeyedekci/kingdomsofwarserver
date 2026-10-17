import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { BanType } from '@prisma/client';
import { AdminService } from './admin.service';
import { PrismaService } from '../../database/prisma.service';
import { FlagDecision } from './dto/review-flag.dto';

const mockPrisma = {
  user: { findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn(), update: jest.fn() },
  playerProfile: { findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), updateMany: jest.fn() },
  playerSession: { findMany: jest.fn(), count: jest.fn() },
  playerPurchase: { aggregate: jest.fn() },
  match: { findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn(), update: jest.fn() },
  matchPlayer: { findMany: jest.fn() },
  ban: { findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  clan: { findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn(), update: jest.fn(), delete: jest.fn() },
  clanMember: { deleteMany: jest.fn() },
  tournament: { findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn() },
  supportTicket: { findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn(), update: jest.fn() },
  antiCheatFlag: { findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  auditLog: { findMany: jest.fn(), count: jest.fn(), create: jest.fn() },
  leaderboardEntry: { findMany: jest.fn(), count: jest.fn(), deleteMany: jest.fn(), upsert: jest.fn() },
  featureFlag: { findMany: jest.fn(), update: jest.fn() },
  $transaction: jest.fn(),
} as unknown as jest.Mocked<PrismaService>;

describe('AdminService', () => {
  let service: AdminService;

  beforeEach(async () => {
    jest.resetAllMocks();
    (mockPrisma.$transaction as jest.Mock).mockImplementation((ops: unknown) =>
      Array.isArray(ops) ? Promise.all(ops) : (ops as (p: unknown) => unknown)(mockPrisma),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  describe('getPlayers()', () => {
    it('returns paginated player list', async () => {
      const users = [{ id: 'u1', email: 'a@a.com' }];
      (mockPrisma.user.findMany as jest.Mock).mockResolvedValue(users);
      (mockPrisma.user.count as jest.Mock).mockResolvedValue(1);

      const result = await service.getPlayers(undefined, 1, 10);

      expect(result).toEqual({ data: users, total: 1, page: 1, limit: 10 });
    });

    it('builds OR search filter when search term is provided', async () => {
      (mockPrisma.user.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.user.count as jest.Mock).mockResolvedValue(0);

      await service.getPlayers('hero', 1, 10);

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ OR: expect.any(Array) }) }),
      );
    });
  });

  describe('getPlayerById()', () => {
    it('returns player merged with recent matches', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'u1', bans: [] });
      (mockPrisma.matchPlayer.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getPlayerById('u1');

      expect(result).toMatchObject({ id: 'u1', recentMatches: [] });
    });

    it('throws NotFoundException when player not found', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getPlayerById('bad')).rejects.toThrow(NotFoundException);
    });
  });

  describe('banPlayer()', () => {
    it('creates temporary ban without deactivating user', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'u1' });
      (mockPrisma.ban.create as jest.Mock).mockResolvedValue({});

      await service.banPlayer('u1', 'cheating', BanType.temporary, 7, 'admin-1');

      expect(mockPrisma.ban.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ type: BanType.temporary }) }),
      );
    });

    it('throws NotFoundException when user not found', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.banPlayer('bad', 'reason', BanType.permanent)).rejects.toThrow(NotFoundException);
    });
  });

  describe('unbanPlayer()', () => {
    it('marks bans inactive and re-activates user', async () => {
      (mockPrisma.ban.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (mockPrisma.user.update as jest.Mock).mockResolvedValue({});

      await service.unbanPlayer('u1');

      expect(mockPrisma.ban.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'u1', isActive: true } }),
      );
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isActive: true } }),
      );
    });
  });

  describe('getMatches()', () => {
    it('returns paginated matches', async () => {
      (mockPrisma.match.findMany as jest.Mock).mockResolvedValue([{ id: 'm1' }]);
      (mockPrisma.match.count as jest.Mock).mockResolvedValue(1);

      const result = await service.getMatches(undefined, undefined, 1, 10);

      expect(result.total).toBe(1);
    });
  });

  describe('getMatchById()', () => {
    it('returns match when found', async () => {
      const match = { id: 'm1', players: [], result: null };
      (mockPrisma.match.findUnique as jest.Mock).mockResolvedValue(match);

      expect(await service.getMatchById('m1')).toEqual(match);
    });

    it('throws NotFoundException when match not found', async () => {
      (mockPrisma.match.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getMatchById('bad')).rejects.toThrow(NotFoundException);
    });
  });

  describe('abandonMatch()', () => {
    it('sets match status to cancelled', async () => {
      (mockPrisma.match.findUnique as jest.Mock).mockResolvedValue({ id: 'm1' });
      (mockPrisma.match.update as jest.Mock).mockResolvedValue({ id: 'm1', status: 'cancelled' });

      const result = await service.abandonMatch('m1');

      expect(result.status).toBe('cancelled');
    });

    it('throws NotFoundException when match not found', async () => {
      (mockPrisma.match.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.abandonMatch('bad')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getDashboardStats()', () => {
    it('returns KPI object with correct shape', async () => {
      (mockPrisma.playerSession.count as jest.Mock).mockResolvedValue(42);
      (mockPrisma.match.count as jest.Mock).mockResolvedValue(5);
      (mockPrisma.playerPurchase.aggregate as jest.Mock).mockResolvedValue({ _sum: { amountUsd: 1500 } });
      (mockPrisma.user.count as jest.Mock).mockResolvedValue(10);

      const result = await service.getDashboardStats();

      expect(result).toEqual({ activePlayers: 42, activeMatches: 5, revenueToday: 1500, newPlayersToday: 10 });
    });
  });

  describe('getLeaderboard()', () => {
    it('returns paginated entries', async () => {
      (mockPrisma.leaderboardEntry.findMany as jest.Mock).mockResolvedValue([{ id: 'e1', score: 2000 }]);
      (mockPrisma.leaderboardEntry.count as jest.Mock).mockResolvedValue(1);

      const result = await service.getLeaderboard('ranked_1v1', 1, 1, 50);

      expect(result.total).toBe(1);
    });

    it('returns empty on DB error', async () => {
      (mockPrisma.leaderboardEntry.findMany as jest.Mock).mockRejectedValue(new Error('DB error'));

      const result = await service.getLeaderboard('ranked_1v1', 1, 1, 50);

      expect(result.data).toEqual([]);
    });
  });

  describe('searchLeaderboard()', () => {
    it('returns entries with profile when player found', async () => {
      const profile = { userId: 'u1', username: 'hero', mmr: 1800, currentRank: 'gold' };
      (mockPrisma.playerProfile.findFirst as jest.Mock).mockResolvedValue(profile);
      (mockPrisma.leaderboardEntry.findMany as jest.Mock).mockResolvedValue([{ id: 'e1', userId: 'u1', score: 1800 }]);

      const result = await service.searchLeaderboard('hero');

      expect(result.data[0]).toMatchObject({ profile });
    });

    it('returns empty data when player not found', async () => {
      (mockPrisma.playerProfile.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.searchLeaderboard('nobody');

      expect(result.data).toEqual([]);
    });
  });

  describe('getClanById()', () => {
    it('returns clan when found', async () => {
      (mockPrisma.clan.findUnique as jest.Mock).mockResolvedValue({ id: 'c1', members: [] });

      expect(await service.getClanById('c1')).toMatchObject({ id: 'c1' });
    });

    it('throws NotFoundException when clan not found', async () => {
      (mockPrisma.clan.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getClanById('bad')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getTournamentById()', () => {
    it('returns tournament when found', async () => {
      (mockPrisma.tournament.findUnique as jest.Mock).mockResolvedValue({ id: 't1', status: 'upcoming' });

      expect(await service.getTournamentById('t1')).toMatchObject({ id: 't1' });
    });

    it('throws NotFoundException when not found', async () => {
      (mockPrisma.tournament.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getTournamentById('bad')).rejects.toThrow(NotFoundException);
    });
  });

  describe('startTournament()', () => {
    it('sets status to in_progress', async () => {
      (mockPrisma.tournament.findUnique as jest.Mock).mockResolvedValue({ id: 't1' });
      (mockPrisma.tournament.update as jest.Mock).mockResolvedValue({ id: 't1', status: 'in_progress' });

      const result = await service.startTournament('t1');

      expect(result.status).toBe('in_progress');
    });
  });

  describe('getSupportTicketById()', () => {
    it('returns ticket when found', async () => {
      (mockPrisma.supportTicket.findUnique as jest.Mock).mockResolvedValue({ id: 'tk1', messages: [] });

      expect(await service.getSupportTicketById('tk1')).toMatchObject({ id: 'tk1' });
    });

    it('throws NotFoundException when not found', async () => {
      (mockPrisma.supportTicket.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getSupportTicketById('bad')).rejects.toThrow(NotFoundException);
    });
  });

  describe('replyToTicket()', () => {
    it('appends admin message and sets status in_progress', async () => {
      (mockPrisma.supportTicket.findUnique as jest.Mock).mockResolvedValue({ id: 'tk1', messages: [] });
      (mockPrisma.supportTicket.update as jest.Mock).mockResolvedValue({ id: 'tk1', status: 'in_progress' });

      await service.replyToTicket('tk1', { message: 'We are looking into it.' });

      expect(mockPrisma.supportTicket.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'in_progress' }) }),
      );
    });

    it('throws NotFoundException when ticket not found', async () => {
      (mockPrisma.supportTicket.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.replyToTicket('bad', { message: 'hi' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('reviewFlag()', () => {
    it('marks flag as reviewed', async () => {
      (mockPrisma.antiCheatFlag.findUnique as jest.Mock).mockResolvedValue({ id: 'f1' });
      (mockPrisma.antiCheatFlag.update as jest.Mock).mockResolvedValue({ id: 'f1', reviewed: true });

      const result = await service.reviewFlag('f1', { decision: FlagDecision.actioned, reviewNote: 'banned' });

      expect(result.reviewed).toBe(true);
    });

    it('throws NotFoundException when flag not found', async () => {
      (mockPrisma.antiCheatFlag.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.reviewFlag('bad', { decision: FlagDecision.false_positive })).rejects.toThrow(NotFoundException);
    });
  });

  describe('bulkReviewFlags()', () => {
    it('returns updated count', async () => {
      (mockPrisma.antiCheatFlag.updateMany as jest.Mock).mockResolvedValue({ count: 3 });

      const result = await service.bulkReviewFlags(['f1', 'f2', 'f3'], 'false_positive');

      expect(result.updated).toBe(3);
    });
  });

  describe('revokeBan()', () => {
    it('revokes permanent ban and reactivates user', async () => {
      const ban = { id: 'b1', userId: 'u1', type: BanType.permanent, isActive: true };
      (mockPrisma.ban.findUnique as jest.Mock).mockResolvedValue(ban);
      (mockPrisma.ban.update as jest.Mock).mockResolvedValue({ ...ban, isActive: false });
      (mockPrisma.user.update as jest.Mock).mockResolvedValue({});

      await service.revokeBan('b1', 'appeal approved');

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isActive: true } }),
      );
    });

    it('throws NotFoundException when ban not found', async () => {
      (mockPrisma.ban.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.revokeBan('bad', 'reason')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getFeatureFlags()', () => {
    it('returns flags ordered by key', async () => {
      (mockPrisma.featureFlag.findMany as jest.Mock).mockResolvedValue([{ key: 'clan_wars', value: 'true' }]);

      const result = await service.getFeatureFlags();

      expect(mockPrisma.featureFlag.findMany).toHaveBeenCalledWith({ orderBy: { key: 'asc' } });
      expect(result).toHaveLength(1);
    });
  });

  describe('updateFeatureFlag()', () => {
    it('updates flag value', async () => {
      (mockPrisma.featureFlag.update as jest.Mock).mockResolvedValue({ key: 'clan_wars', value: 'false' });

      const result = await service.updateFeatureFlag('clan_wars', 'false');

      expect(mockPrisma.featureFlag.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { key: 'clan_wars' }, data: { value: false } }),
      );
      expect(result.key).toBe('clan_wars');
    });
  });
});
