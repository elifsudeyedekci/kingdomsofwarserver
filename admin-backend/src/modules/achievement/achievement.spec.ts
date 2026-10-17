import { AchievementService } from './achievement.service';
import { PrismaService } from '../../database/prisma.service';

// ─── Prisma mock ──────────────────────────────────────────────────────────────

const mockPrisma = {
  analyticsEvent: {
    create: jest.fn().mockResolvedValue({}),
  },
  achievementProgress: {
    findMany:   jest.fn(),
    findUnique: jest.fn(),
    upsert:     jest.fn(),
    updateMany: jest.fn(),
    count:      jest.fn(),
  },
};

// ─── Existing tests (synchronous, exercise getAllAchievements + sync helpers) ─

describe('AchievementService', () => {
  let service: AchievementService;

  beforeEach(() => {
    jest.resetAllMocks();
    mockPrisma.analyticsEvent.create.mockResolvedValue({});
    service = new AchievementService(mockPrisma as unknown as PrismaService);
  });

  it('getAllAchievements returns 6 definitions', () => {
    expect(service.getAllAchievements()).toHaveLength(6);
  });

  it('trackProgress increments counter for matching eventType', async () => {
    // Arrange — no existing row, so progress starts at 0
    mockPrisma.achievementProgress.findUnique.mockResolvedValue(null);
    mockPrisma.achievementProgress.upsert.mockResolvedValue({});

    // Act
    await service.trackProgress('p1', { eventType: 'matchWon', value: 1 });

    // Assert — upsert called with newProgress=1 for first_win
    expect(mockPrisma.achievementProgress.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ userId: 'p1', achievementId: 'first_win', progress: 1 }),
      }),
    );
  });

  it('trackProgress unlocks achievement when threshold met', async () => {
    // Arrange — no existing row; value=1 meets first_win threshold of 1
    mockPrisma.achievementProgress.findUnique.mockResolvedValue(null);
    mockPrisma.achievementProgress.upsert.mockResolvedValue({});

    // Act
    const unlocked = await service.trackProgress('p2', { eventType: 'matchWon', value: 1 });

    // Assert
    expect(unlocked.some((u) => u.achievement.id === 'first_win')).toBe(true);
  });

  it('adminGrantAchievement marks achievement as unlocked', async () => {
    // Arrange
    mockPrisma.achievementProgress.upsert.mockResolvedValue({});

    // Act
    const result = await service.adminGrantAchievement('p3', 'veteran');

    // Assert
    expect(result.isUnlocked).toBe(true);
    expect(result.achievementId).toBe('veteran');
    expect(mockPrisma.achievementProgress.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ isUnlocked: true }),
      }),
    );
  });

  it('adminRevokeAchievement removes unlock', async () => {
    // Arrange
    mockPrisma.achievementProgress.updateMany.mockResolvedValue({ count: 1 });

    // Act — revoke clan_member from p4
    await service.adminRevokeAchievement('p4', 'clan_member');

    // Assert — updateMany called with isUnlocked=false and unlockedAt=null
    expect(mockPrisma.achievementProgress.updateMany).toHaveBeenCalledWith({
      where:  { userId: 'p4', achievementId: 'clan_member' },
      data:   { isUnlocked: false, unlockedAt: null },
    });
  });

  // ─── adminRevokeAchievement — extended scenarios ─────────────────────────

  describe('adminRevokeAchievement()', () => {
    it('adminRevokeAchievement_Revokes_ClearsUnlock — sets isUnlocked=false and unlockedAt=null', async () => {
      // Arrange
      mockPrisma.achievementProgress.updateMany.mockResolvedValue({ count: 1 });

      // Act
      await service.adminRevokeAchievement('player-revoke', 'tournament_winner');

      // Assert
      expect(mockPrisma.achievementProgress.updateMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.achievementProgress.updateMany).toHaveBeenCalledWith({
        where: { userId: 'player-revoke', achievementId: 'tournament_winner' },
        data:  { isUnlocked: false, unlockedAt: null },
      });
    });

    it('adminRevokeAchievement returns void without throwing when no matching row exists', async () => {
      // Arrange — updateMany returns count=0 (player never had this achievement)
      mockPrisma.achievementProgress.updateMany.mockResolvedValue({ count: 0 });

      // Act / Assert — should not throw
      await expect(
        service.adminRevokeAchievement('unknown-player', 'first_win'),
      ).resolves.not.toThrow();
    });
  });

  // ─── trackProgress — already-unlocked guard ───────────────────────────────

  describe('trackProgress() — already-unlocked guard', () => {
    it('trackProgress_WhenAlreadyUnlocked_DoesNotDuplicate — skips upsert when achievement is already unlocked', async () => {
      // Arrange — findUnique returns a row with isUnlocked=true
      mockPrisma.achievementProgress.findUnique.mockResolvedValue({
        userId:        'p-already',
        achievementId: 'first_win',
        progress:      1,
        isUnlocked:    true,
        unlockedAt:    new Date('2026-01-01'),
      });
      mockPrisma.achievementProgress.upsert.mockResolvedValue({});

      // Act
      const unlocked = await service.trackProgress('p-already', { eventType: 'matchWon', value: 1 });

      // Assert — unlock is not recorded again; returned array is empty
      expect(unlocked).toHaveLength(0);
      expect(mockPrisma.achievementProgress.upsert).not.toHaveBeenCalled();
    });

    it('trackProgress_PartialProgress_DoesNotUnlock — does not unlock when cumulative progress is below threshold', async () => {
      // Arrange — veteran threshold is 100; player has 50 wins; event adds 1 → 51, not enough
      mockPrisma.achievementProgress.findUnique.mockResolvedValue({
        userId:        'p-partial',
        achievementId: 'veteran',
        progress:      50,
        isUnlocked:    false,
        unlockedAt:    null,
      });
      mockPrisma.achievementProgress.upsert.mockResolvedValue({});

      // Act
      const unlocked = await service.trackProgress('p-partial', { eventType: 'matchWon', value: 1 });

      // Assert — veteran should NOT appear in unlocked list
      expect(unlocked.every((u) => u.achievement.id !== 'veteran')).toBe(true);
      // But upsert is still called to save the progress increment
      expect(mockPrisma.achievementProgress.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ progress: 51, isUnlocked: false }),
        }),
      );
    });
  });

  // ─── getAchievementStats ──────────────────────────────────────────────────

  describe('getAchievementStats()', () => {
    it('getAchievementStats_Returns_Counts — returns totalDefinitions=6 and correct totalUnlocks', async () => {
      // Arrange
      // count(isUnlocked=true) → 12 total unlocks
      mockPrisma.achievementProgress.count.mockResolvedValue(12);
      // findMany(distinct userId) → 3 distinct players
      mockPrisma.achievementProgress.findMany.mockResolvedValue([
        { userId: 'u1' }, { userId: 'u2' }, { userId: 'u3' },
      ]);

      // Act
      const stats = await service.getAchievementStats();

      // Assert
      expect(stats.totalDefinitions).toBe(6);
      expect(stats.totalUnlocks).toBe(12);
      expect(stats.rarestAchievements).toHaveLength(3);
    });

    it('getAchievementStats_NoPLayers_UnlockRateIsZero — unlockRate defaults gracefully when no players exist', async () => {
      // Arrange — no players; service guards with playerCount = distinctPlayers.length || 1
      mockPrisma.achievementProgress.count.mockResolvedValue(0);
      mockPrisma.achievementProgress.findMany.mockResolvedValue([]);

      // Act
      const stats = await service.getAchievementStats();

      // Assert — should not throw; rates should all be 0 / 1 = 0
      expect(stats.totalDefinitions).toBe(6);
      expect(stats.totalUnlocks).toBe(0);
      expect(stats.rarestAchievements.every((a) => a.unlockRate === 0)).toBe(true);
    });
  });
});
