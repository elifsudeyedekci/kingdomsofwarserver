/**
 * TournamentService
 *
 * Implements tournament lifecycle, leaderboard management, and promotion series
 * tracking for the Kingdoms of War admin backend.
 *
 * Prisma models used:
 *   - Tournament          (tournaments table)
 *   - LeaderboardEntry    (leaderboard_entries table)
 *   - RankHistory         (rank_history table)
 *   - PromotionSeries     (promotion_series table)
 */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, PromotionSeriesStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpsertLeaderboardEntryDto } from './dto/upsert-leaderboard-entry.dto';
import { RecordPromotionResultDto } from './dto/record-promotion-result.dto';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Number of wins required to complete a promotion series successfully.
 * Must remain data-driven if design ever changes this threshold.
 */
const PROMO_WINS_REQUIRED = 3;

/**
 * Number of losses that causes a promotion series to be marked as lost.
 */
const PROMO_LOSSES_MAX = 2;

/**
 * Terminal tournament statuses — no further transitions are allowed from these.
 */
const TERMINAL_TOURNAMENT_STATUSES = new Set(['cancelled', 'completed']);

// ---------------------------------------------------------------------------
// Query parameter shapes
// ---------------------------------------------------------------------------

interface GetTournamentsParams {
  page: number;
  limit: number;
  status?: string;
}

interface GetLeaderboardParams {
  type: string;
  seasonId?: string;
  page: number;
  limit: number;
}

interface UpsertLeaderboardParams {
  userId: string;
  type: string;
  seasonId?: string;
  score: number;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class TournamentService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Tournaments
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Returns a paginated list of tournaments, ordered by startAt ascending.
   * Optionally filtered by status (e.g. 'upcoming', 'active', 'completed').
   */
  async getTournaments(params: GetTournamentsParams) {
    const { page, limit, status } = params;
    const skip = (page - 1) * limit;
    const where = status ? { status } : {};

    const [items, total] = await Promise.all([
      this.prisma.tournament.findMany({
        where,
        orderBy: { startAt: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.tournament.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  /**
   * Returns a single tournament by ID.
   * Throws NotFoundException if not found.
   */
  async getTournamentById(id: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id },
    });
    if (!tournament) {
      throw new NotFoundException(`Tournament '${id}' not found`);
    }
    return tournament;
  }

  /**
   * Creates a new tournament with status 'upcoming'.
   *
   * Validation:
   *   - startAt must be in the future
   *   - endAt must be strictly after startAt
   */
  async createTournament(dto: CreateTournamentDto) {
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);
    const now = new Date();

    if (startAt <= now) {
      throw new BadRequestException('startAt must be a future date');
    }
    if (endAt <= startAt) {
      throw new BadRequestException('endAt must be strictly after startAt');
    }

    return this.prisma.tournament.create({
      data: {
        name: dto.name,
        description: dto.description,
        startAt,
        endAt,
        maxPlayers: dto.maxPlayers,
        prizePool: (dto.prizePool as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        status: 'upcoming',
        createdBy: dto.createdBy,
      },
    });
  }

  /**
   * Transitions a tournament to a new status.
   *
   * Rules:
   *   - Tournament must exist
   *   - Transitions out of 'cancelled' or 'completed' are forbidden
   */
  async updateTournamentStatus(id: string, status: string) {
    const tournament = await this.prisma.tournament.findUnique({ where: { id } });
    if (!tournament) {
      throw new NotFoundException(`Tournament '${id}' not found`);
    }
    if (TERMINAL_TOURNAMENT_STATUSES.has(tournament.status)) {
      throw new BadRequestException(
        `Cannot transition tournament from terminal status '${tournament.status}'`,
      );
    }

    return this.prisma.tournament.update({
      where: { id },
      data: { status },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Leaderboard
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Returns a paginated leaderboard for a given type and optional season,
   * ordered by score descending.
   */
  async getLeaderboard(params: GetLeaderboardParams) {
    const { type, seasonId, page, limit } = params;
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = { type };
    if (seasonId !== undefined) {
      where.seasonId = seasonId;
    }

    const [items, total] = await Promise.all([
      this.prisma.leaderboardEntry.findMany({
        where,
        orderBy: { score: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.leaderboardEntry.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  /**
   * Creates or updates a leaderboard entry for the given user/type/season
   * combination. Uses Prisma's upsert with the composite unique key
   * userId_type_seasonId.
   */
  async upsertLeaderboardEntry(params: UpsertLeaderboardParams) {
    const { userId, type, seasonId, score, metadata } = params;

    return this.prisma.leaderboardEntry.upsert({
      where: {
        userId_type_seasonId: { userId, type, seasonId: (seasonId ?? null) as string },
      },
      update: { score, ...(metadata !== undefined ? { metadata: metadata as Prisma.InputJsonValue } : {}) },
      create: {
        userId,
        type,
        seasonId: seasonId ?? null,
        score,
        metadata: metadata !== undefined ? (metadata as Prisma.InputJsonValue) : undefined,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Promotion Series
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Returns the currently active promotion series for a user, or null if none.
   */
  async getPromotionSeries(userId: string) {
    return this.prisma.promotionSeries.findFirst({
      where: { userId, status: 'active' },
    });
  }

  /**
   * Records the result of a promotion match for the user's active series.
   *
   * Business rules:
   *   - PROMO_WINS_REQUIRED (3) wins  → status becomes 'won'  + completedAt set
   *   - PROMO_LOSSES_MAX    (2) losses → status becomes 'lost' + completedAt set
   *   - Otherwise the series remains 'active' with incremented counters
   *
   * Throws NotFoundException if the user has no active promotion series.
   */
  async recordPromotionResult(userId: string, dto: RecordPromotionResultDto) {
    const series = await this.prisma.promotionSeries.findFirst({
      where: { userId, status: 'active' },
    });
    if (!series) {
      throw new NotFoundException(`No active promotion series found for user '${userId}'`);
    }

    const newWins = series.wins + (dto.isWin ? 1 : 0);
    const newLosses = series.losses + (dto.isWin ? 0 : 1);
    const newTotal = series.totalMatches + 1;

    let newStatus: PromotionSeriesStatus = PromotionSeriesStatus.active;
    let completedAt: Date | null = null;

    if (newWins >= PROMO_WINS_REQUIRED) {
      newStatus = PromotionSeriesStatus.won;
      completedAt = new Date();
    } else if (newLosses >= PROMO_LOSSES_MAX) {
      newStatus = PromotionSeriesStatus.lost;
      completedAt = new Date();
    }

    return this.prisma.promotionSeries.update({
      where: { id: series.id },
      data: {
        wins: newWins,
        losses: newLosses,
        totalMatches: newTotal,
        status: newStatus,
        ...(completedAt ? { completedAt } : {}),
      },
    });
  }
}
