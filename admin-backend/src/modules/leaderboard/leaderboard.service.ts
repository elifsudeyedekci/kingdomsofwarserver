/**
 * LeaderboardService
 *
 * Implements leaderboard mechanics as described in the Kingdoms of War
 * systems design: global all-time ranking and per-season ranking backed
 * by the `leaderboard_entries` table (LeaderboardEntry model).
 *
 * Entry `type` values:
 *   "global"  — all-time, seasonId IS NULL
 *   "season"  — per-season, seasonId = the season UUID
 *
 * Score rule: scores are monotonically increasing — an incoming score
 * value is ADDED to the existing score (upsert with increment).  The
 * caller passes a delta, not an absolute value.
 */
import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '@prisma/client';
import {
  AroundPlayerDto,
  LeaderboardEntryDto,
  PagedLeaderboardDto,
  PlayerRankDto,
} from './dto/leaderboard-response.dto';

// ─── internal helpers ────────────────────────────────────────────────────────

/**
 * Prisma's composite unique key requires every field to be non-nullable in the
 * `where` clause for findUnique.  When seasonId is null we fall back to
 * findFirst so that we can filter with { seasonId: null }.
 */
async function findEntryByKey(
  prisma: PrismaService,
  userId: string,
  type: string,
  seasonId: string | null,
) {
  if (seasonId !== null) {
    return prisma.leaderboardEntry.findUnique({
      where: { userId_type_seasonId: { userId, type, seasonId } },
    });
  }
  return prisma.leaderboardEntry.findFirst({
    where: { userId, type, seasonId: null },
  });
}

function toEntryDto(raw: {
  id: string;
  userId: string;
  score: number;
  rank: number | null;
  seasonId: string | null;
  metadata: Prisma.JsonValue | null;
  updatedAt: Date;
}): LeaderboardEntryDto {
  return {
    id: raw.id,
    userId: raw.userId,
    score: raw.score,
    rank: raw.rank,
    seasonId: raw.seasonId,
    metadata: raw.metadata,
    updatedAt: raw.updatedAt,
  };
}

// ─── service ─────────────────────────────────────────────────────────────────

@Injectable()
export class LeaderboardService {
  constructor(private readonly prisma: PrismaService) {}

  // ── 1. Global all-time leaderboard (score DESC, paginated) ──────────────

  async getGlobalLeaderboard(
    page: number,
    limit: number,
  ): Promise<PagedLeaderboardDto> {
    const where: Prisma.LeaderboardEntryWhereInput = {
      type: 'global',
      seasonId: null,
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.leaderboardEntry.count({ where }),
      this.prisma.leaderboardEntry.findMany({
        where,
        orderBy: { score: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: rows.map(toEntryDto),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ── 2. Per-season leaderboard (score DESC, paginated) ───────────────────

  async getSeasonLeaderboard(
    seasonId: string,
    page: number,
    limit: number,
  ): Promise<PagedLeaderboardDto> {
    await this._assertSeasonExists(seasonId);

    const where: Prisma.LeaderboardEntryWhereInput = {
      type: 'season',
      seasonId,
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.leaderboardEntry.count({ where }),
      this.prisma.leaderboardEntry.findMany({
        where,
        orderBy: { score: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: rows.map(toEntryDto),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ── 3. Player rank position ──────────────────────────────────────────────
  // Rank = number of players with a strictly higher score + 1.

  async getPlayerRank(
    userId: string,
    seasonId?: string,
  ): Promise<PlayerRankDto> {
    const type = seasonId ? 'season' : 'global';

    const entry = await findEntryByKey(this.prisma, userId, type, seasonId ?? null);

    if (!entry) {
      throw new NotFoundException(
        `No leaderboard entry found for user ${userId}${seasonId ? ` in season ${seasonId}` : ''}`,
      );
    }

    const playersAbove = await this.prisma.leaderboardEntry.count({
      where: {
        type,
        seasonId: seasonId ?? null,
        score: { gt: entry.score },
      },
    });

    return {
      userId,
      score: entry.score,
      rank: playersAbove + 1,
      seasonId: seasonId ?? null,
    };
  }

  // ── 4. Upsert player score (score only increases — never decreases) ──────

  async updatePlayerScore(
    userId: string,
    seasonId: string | null,
    scoreDelta: number,
    metadata?: Record<string, unknown>,
  ): Promise<LeaderboardEntryDto> {
    const type = seasonId ? 'season' : 'global';

    // Use a raw upsert so the score increment is atomic.
    // On conflict we add the delta; we never overwrite with a lower value.
    // When seasonId is null the composite key requires a non-null string for
    // findUnique, so we upsert only when seasonId is present; otherwise we
    // manually find-or-create inside a transaction.
    let entry: Awaited<ReturnType<typeof this.prisma.leaderboardEntry.upsert>>;

    if (seasonId !== null) {
      entry = await this.prisma.leaderboardEntry.upsert({
        where: { userId_type_seasonId: { userId, type, seasonId } },
        create: {
          userId,
          type,
          seasonId,
          score: scoreDelta,
          metadata: (metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        },
        update: {
          score: { increment: scoreDelta },
          ...(metadata !== undefined
            ? { metadata: metadata as Prisma.InputJsonValue }
            : {}),
        },
      });
    } else {
      // Global entry (seasonId IS NULL) — upsert via transaction.
      entry = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.leaderboardEntry.findFirst({
          where: { userId, type, seasonId: null },
        });
        if (existing) {
          return tx.leaderboardEntry.update({
            where: { id: existing.id },
            data: {
              score: { increment: scoreDelta },
              ...(metadata !== undefined
                ? { metadata: metadata as Prisma.InputJsonValue }
                : {}),
            },
          });
        }
        return tx.leaderboardEntry.create({
          data: {
            userId,
            type,
            seasonId: null,
            score: scoreDelta,
            metadata: (metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull,
          },
        });
      });
    }

    return toEntryDto(entry);
  }

  // ── 5. Admin: reset all entries for a season ────────────────────────────

  async resetSeasonLeaderboard(seasonId: string): Promise<{ deleted: number }> {
    await this._assertSeasonExists(seasonId);

    const result = await this.prisma.leaderboardEntry.deleteMany({
      where: { type: 'season', seasonId },
    });

    return { deleted: result.count };
  }

  // ── 6. Top-N players (fixed snapshot, not paginated) ────────────────────

  async getTopN(
    n: number,
    seasonId?: string,
  ): Promise<LeaderboardEntryDto[]> {
    const type = seasonId ? 'season' : 'global';

    const rows = await this.prisma.leaderboardEntry.findMany({
      where: {
        type,
        seasonId: seasonId ?? null,
      },
      orderBy: { score: 'desc' },
      take: n,
    });

    return rows.map(toEntryDto);
  }

  // ── 7. Players around a given player ────────────────────────────────────
  // Returns floor(n/2) players above + the player + floor(n/2) below.
  // At the edges the window is clamped (no wrapping).

  async getAroundPlayer(
    userId: string,
    n: number,
    seasonId?: string,
  ): Promise<AroundPlayerDto> {
    const type = seasonId ? 'season' : 'global';
    const half = Math.floor(n / 2);

    const entry = seasonId !== undefined
      ? await this.prisma.leaderboardEntry.findUnique({
          where: {
            userId_type_seasonId: {
              userId,
              type,
              seasonId,
            },
          },
        })
      : await this.prisma.leaderboardEntry.findFirst({
          where: { userId, type, seasonId: null },
        });

    if (!entry) {
      throw new NotFoundException(
        `No leaderboard entry found for user ${userId}${seasonId ? ` in season ${seasonId}` : ''}`,
      );
    }

    // Number of players strictly above (determines the player's 1-based rank).
    const playersAboveCount = await this.prisma.leaderboardEntry.count({
      where: {
        type,
        seasonId: seasonId ?? null,
        score: { gt: entry.score },
      },
    });

    // Players ranked above the target (up to `half` rows).
    const aboveRows = await this.prisma.leaderboardEntry.findMany({
      where: {
        type,
        seasonId: seasonId ?? null,
        score: { gt: entry.score },
      },
      orderBy: { score: 'asc' }, // ascending so the closest are first when we reverse
      take: half,
    });
    // Reverse so the list reads rank-ascending (best first).
    aboveRows.reverse();

    // Players ranked below the target (up to `half` rows).
    const belowRows = await this.prisma.leaderboardEntry.findMany({
      where: {
        type,
        seasonId: seasonId ?? null,
        score: { lt: entry.score },
        userId: { not: userId },
      },
      orderBy: { score: 'desc' },
      take: half,
    });

    return {
      above: aboveRows.map(toEntryDto),
      player: toEntryDto(entry),
      below: belowRows.map(toEntryDto),
    };
  }

  // ── private helpers ──────────────────────────────────────────────────────

  private async _assertSeasonExists(seasonId: string): Promise<void> {
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
      select: { id: true },
    });
    if (!season) {
      throw new NotFoundException(`Season ${seasonId} not found`);
    }
  }
}
