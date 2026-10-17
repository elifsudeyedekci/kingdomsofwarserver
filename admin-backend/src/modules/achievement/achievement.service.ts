import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  AchievementDTO, AchievementEventDTO, AchievementStatsDTO,
  PlayerAchievementDTO, UnlockedAchievementDTO,
} from './dto/achievement.dto';

const DEFINITIONS: AchievementDTO[] = [
  { id: 'first_win', name: 'First Blood', description: 'Win your first match', category: 'combat', xpReward: 100, criteria: { type: 'matchWon', threshold: 1 } },
  { id: 'veteran', name: 'Veteran', description: 'Win 100 matches', category: 'combat', xpReward: 500, criteria: { type: 'matchWon', threshold: 100 } },
  { id: 'economy_lord', name: 'Economy Lord', description: 'Gather 100,000 resources', category: 'economy', xpReward: 300, criteria: { type: 'resourceGathered', threshold: 100000 } },
  { id: 'clan_member', name: 'Band of Brothers', description: 'Join a clan', category: 'social', xpReward: 50, criteria: { type: 'joinedClan', threshold: 1 } },
  { id: 'tournament_winner', name: 'Champion', description: 'Win a tournament', category: 'tournament', xpReward: 1000, criteria: { type: 'tournamentWon', threshold: 1 } },
  { id: 'kill_streak', name: 'Annihilator', description: 'Destroy 1,000 units', category: 'combat', xpReward: 750, criteria: { type: 'unitKilled', threshold: 1000 } },
];

@Injectable()
export class AchievementService {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns the static list of all achievement definitions. */
  getAllAchievements(): AchievementDTO[] {
    return DEFINITIONS;
  }

  /**
   * Returns the current progress state for every achievement definition
   * for the given player. Rows missing from DB are returned with zero progress.
   */
  async getPlayerAchievements(playerId: string): Promise<PlayerAchievementDTO[]> {
    const rows = await this.prisma.achievementProgress.findMany({
      where: { userId: playerId },
    });

    const rowMap = new Map(rows.map((r) => [r.achievementId, r]));

    return DEFINITIONS.map((def) => {
      const row = rowMap.get(def.id);
      return {
        achievementId: def.id,
        playerId,
        unlockedAt:   row?.unlockedAt ?? undefined,
        progress:     row?.progress ?? 0,
        threshold:    def.criteria.threshold,
        isUnlocked:   row?.isUnlocked ?? false,
      };
    });
  }

  /**
   * Applies an in-game event to matching achievement criteria for the player.
   * Progress is persisted via upsert; newly unlocked achievements are returned.
   */
  async trackProgress(
    playerId: string,
    event: AchievementEventDTO,
  ): Promise<UnlockedAchievementDTO[]> {
    const newlyUnlocked: UnlockedAchievementDTO[] = [];

    for (const def of DEFINITIONS) {
      if (def.criteria.type !== event.eventType) continue;

      // Fetch current row (if any) to check already-unlocked and add delta.
      const existing = await this.prisma.achievementProgress.findUnique({
        where: { userId_achievementId: { userId: playerId, achievementId: def.id } },
      });

      if (existing?.isUnlocked) continue;

      const newProgress = (existing?.progress ?? 0) + event.value;
      const nowUnlocked = newProgress >= def.criteria.threshold;
      const unlockedAt  = nowUnlocked ? new Date() : null;

      await this.prisma.achievementProgress.upsert({
        where: { userId_achievementId: { userId: playerId, achievementId: def.id } },
        create: {
          userId:        playerId,
          achievementId: def.id,
          progress:      newProgress,
          isUnlocked:    nowUnlocked,
          unlockedAt,
        },
        update: {
          progress:   newProgress,
          isUnlocked: nowUnlocked,
          ...(nowUnlocked && { unlockedAt }),
        },
      });

      if (nowUnlocked) {
        newlyUnlocked.push({
          achievement: def,
          unlockedAt:  unlockedAt as Date,
          xpAwarded:   def.xpReward,
        });

        // Non-blocking analytics event for auditability.
        this.prisma.analyticsEvent.create({
          data: {
            userId:     playerId,
            eventType:  'achievement_unlocked',
            properties: { achievementId: def.id, xpReward: def.xpReward },
          },
        }).catch(() => { /* non-blocking */ });
      }
    }

    return newlyUnlocked;
  }

  /**
   * Admin operation: immediately grants an achievement to a player,
   * setting progress to the threshold and marking it unlocked.
   * @throws NotFoundException when the achievementId is not in DEFINITIONS.
   */
  async adminGrantAchievement(
    playerId: string,
    achievementId: string,
  ): Promise<PlayerAchievementDTO> {
    const def = DEFINITIONS.find((d) => d.id === achievementId);
    if (!def) throw new NotFoundException(`Achievement '${achievementId}' not found`);

    const now = new Date();

    await this.prisma.achievementProgress.upsert({
      where: { userId_achievementId: { userId: playerId, achievementId } },
      create: {
        userId:        playerId,
        achievementId,
        progress:      def.criteria.threshold,
        isUnlocked:    true,
        unlockedAt:    now,
      },
      update: {
        progress:   def.criteria.threshold,
        isUnlocked: true,
        unlockedAt: now,
      },
    });

    return {
      achievementId,
      playerId,
      unlockedAt: now,
      progress:   def.criteria.threshold,
      threshold:  def.criteria.threshold,
      isUnlocked: true,
    };
  }

  /**
   * Admin operation: revokes an achievement from a player by clearing
   * the unlock flag and unlockedAt timestamp. Progress is preserved.
   */
  async adminRevokeAchievement(playerId: string, achievementId: string): Promise<void> {
    await this.prisma.achievementProgress.updateMany({
      where: { userId: playerId, achievementId },
      data:  { isUnlocked: false, unlockedAt: null },
    });
  }

  /**
   * Returns aggregate statistics across all players:
   * total unlock count, total definitions, and the three rarest achievements
   * ordered by ascending unlock rate.
   */
  async getAchievementStats(): Promise<AchievementStatsDTO> {
    const [totalUnlocks, distinctPlayers] = await Promise.all([
      this.prisma.achievementProgress.count({ where: { isUnlocked: true } }),
      this.prisma.achievementProgress.findMany({
        select: { userId: true },
        distinct: ['userId'],
      }),
    ]);

    const playerCount = distinctPlayers.length || 1;

    const rates = await Promise.all(
      DEFINITIONS.map(async (def) => {
        const count = await this.prisma.achievementProgress.count({
          where: { achievementId: def.id, isUnlocked: true },
        });
        return { id: def.id, name: def.name, unlockRate: count / playerCount };
      }),
    );

    const sorted = rates.sort((a, b) => a.unlockRate - b.unlockRate);

    return {
      totalDefinitions:   DEFINITIONS.length,
      totalUnlocks,
      rarestAchievements: sorted.slice(0, 3),
    };
  }
}
