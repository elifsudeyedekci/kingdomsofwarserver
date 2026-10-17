export class AchievementDTO {
  id: string;
  name: string;
  description: string;
  category: string;
  xpReward: number;
  criteria: { type: string; threshold: number };
}

export class PlayerAchievementDTO {
  achievementId: string;
  playerId: string;
  unlockedAt?: Date;
  progress: number;
  threshold: number;
  isUnlocked: boolean;
}

export class UnlockedAchievementDTO {
  achievement: AchievementDTO;
  unlockedAt: Date;
  xpAwarded: number;
}

export class AchievementEventDTO {
  eventType: string;
  value: number;
  metadata?: Record<string, string>;
}

export class RarestAchievementDTO {
  id: string;
  name: string;
  unlockRate: number;
}

export class AchievementStatsDTO {
  totalDefinitions: number;
  totalUnlocks: number;
  /** a named class: swagger could not resolve the inline Array<{...}> type (circular dependency at startup) */
  rarestAchievements: RarestAchievementDTO[];
}
