import { Optional } from '@nestjs/common';
import { ModerationService } from '../moderation/moderation.service';
import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { BanType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { FlagPlayerDto } from './dto/flag-player.dto';
import { ReviewFlagDto, ReviewDecision } from './dto/review-flag.dto';
import { BanPlayerDto } from './dto/ban-player.dto';
import { MatchDataDto } from './dto/auto-flag-check.dto';

// Win-rate and commands-per-second thresholds for automatic flag heuristics.
// These are intentionally extracted as constants so a designer can adjust them
// without touching business logic.
const AUTO_FLAG_WIN_RATE_THRESHOLD = 0.95;
const AUTO_FLAG_CPS_THRESHOLD = 20;

@Injectable()
export class AnticheatService {
  constructor(private readonly prisma: PrismaService, @Optional() private readonly moderation?: ModerationService) {}

  // ─── FLAGS ──────────────────────────────────────────────────────────────────

  /**
   * Returns a paginated, optionally-filtered list of AntiCheatFlags.
   * `status` maps to the `reviewed` boolean: "pending" → false, "reviewed" → true.
   * `severity` maps directly to AntiCheatFlag.severity string column.
   */
  async getFlags(
    page = 1,
    limit = 20,
    status?: 'pending' | 'reviewed',
    severity?: string,
  ) {
    const where: Record<string, unknown> = {};

    if (status === 'pending') where.reviewed = false;
    if (status === 'reviewed') where.reviewed = true;
    if (severity) where.severity = severity;

    const [data, total] = await Promise.all([
      this.prisma.antiCheatFlag.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              profile: { select: { username: true, currentRank: true, mmr: true } },
            },
          },
        },
      }),
      this.prisma.antiCheatFlag.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Returns a single AntiCheatFlag by id, throws NotFoundException if missing.
   */
  async getFlagById(id: string) {
    const flag = await this.prisma.antiCheatFlag.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            profile: { select: { username: true, currentRank: true, mmr: true, riskScore: true } },
            bans: { where: { isActive: true }, select: { id: true, type: true, endsAt: true }, take: 1 },
          },
        },
      },
    });
    if (!flag) throw new NotFoundException(`AntiCheatFlag with id "${id}" not found`);
    return flag;
  }

  /**
   * Creates a new AntiCheatFlag for a player.
   * `reason` is stored as `flagType`; `evidence` is stored in the `data` Json column.
   */
  async flagPlayer(dto: FlagPlayerDto) {
    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!user) throw new NotFoundException(`User with id "${dto.userId}" not found`);

    return this.prisma.antiCheatFlag.create({
      data: {
        userId: dto.userId,
        matchId: dto.matchId ?? null,
        flagType: dto.reason,
        severity: dto.severity,
        // Prisma Json fields require an explicit cast from Record<string,unknown>
        data: (dto.evidence ?? {}) as object,
        reviewed: false,
      },
    });
  }

  /**
   * Reviews a flag: sets reviewed=true, stores reviewer id and optional note.
   * Decision "dismissed" is recorded via reviewNote prefix so the history is auditable.
   */
  async reviewFlag(id: string, dto: ReviewFlagDto) {
    const existing = await this.getFlagById(id); // throws if not found
    if (existing.reviewed) throw new ConflictException(`Flag "${id}" has already been reviewed`);   // never overwrite the first decision

    const notePrefix =
      dto.decision === ReviewDecision.dismissed ? '[DISMISSED] ' : '[REVIEWED] ';
    const reviewNote = dto.reviewNote
      ? `${notePrefix}${dto.reviewNote}`
      : notePrefix.trimEnd();

    return this.prisma.antiCheatFlag.update({
      where: { id },
      data: {
        reviewed: true,
        reviewedBy: dto.reviewedBy,
        reviewNote,
      },
    });
  }

  /**
   * Returns all flags belonging to a specific user, newest first.
   */
  async getPlayerFlags(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User with id "${userId}" not found`);

    return this.prisma.antiCheatFlag.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── BANS ───────────────────────────────────────────────────────────────────

  /**
   * Creates a Ban record for a player.
   * For BanType.temporary, durationDays is required.
   * For BanType.permanent, the user account is also deactivated.
   */
  async banPlayer(dto: BanPlayerDto) {
    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!user) throw new NotFoundException(`User with id "${dto.userId}" not found`);

    if (dto.banType === BanType.temporary && !dto.durationDays) {
      throw new BadRequestException('durationDays is required for temporary bans');
    }

    const activeBan = await this.prisma.ban.findFirst({ where: { userId: dto.userId, isActive: true } });
    if (activeBan) throw new BadRequestException(`User "${dto.userId}" is already actively banned`);

    const endsAt =
      dto.banType === BanType.temporary && dto.durationDays
        ? new Date(Date.now() + dto.durationDays * 86_400_000)
        : null;

    const createBan = this.prisma.ban.create({
      data: {
        userId: dto.userId,
        type: dto.banType,
        reason: dto.reason,
        evidence: dto.evidence ?? null,
        bannedBy: dto.bannedBy,
        matchId: dto.matchId ?? null,
        endsAt,
        isActive: true,
      },
    });

    if (dto.banType === BanType.permanent) {
      const [ban] = await this.prisma.$transaction([
        createBan,
        this.prisma.user.update({
          where: { id: dto.userId },
          data: { isActive: false },
        }),
      ]);
      await this.moderation?.notifyBan(dto.userId, dto.banType, dto.reason, endsAt, dto.bannedBy);
      return ban;
    }

    const created = await createBan;
    await this.moderation?.notifyBan(dto.userId, dto.banType, dto.reason, endsAt, dto.bannedBy);
    return created;
  }

  /**
   * Deactivates a ban by id (sets isActive=false, records liftedAt).
   * Does not throw if the ban is already inactive — idempotent.
   */
  async liftBan(banId: string) {
    const ban = await this.prisma.ban.findUnique({ where: { id: banId } });
    if (!ban) throw new NotFoundException(`Ban with id "${banId}" not found`);

    return this.prisma.ban.update({
      where: { id: banId },
      data: {
        isActive: false,
        liftedAt: new Date(),
      },
    });
  }

  /**
   * Returns active bans with pagination.
   */
  async getActiveBans(page = 1, limit = 20) {
    const where = { isActive: true };

    const [data, total] = await Promise.all([
      this.prisma.ban.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              profile: { select: { username: true } },
            },
          },
        },
      }),
      this.prisma.ban.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Returns the full ban history for a specific player, newest first.
   */
  async getBanHistory(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User with id "${userId}" not found`);

    return this.prisma.ban.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── HEURISTICS ─────────────────────────────────────────────────────────────

  /**
   * Runs a lightweight statistical check on post-match data.
   * Thresholds: winRate > 0.95 OR avgCommandsPerSecond > 20.
   * If triggered, creates an AntiCheatFlag automatically with severity="high".
   * Returns { flagged: boolean, flag?: AntiCheatFlag, reasons: string[] }.
   */
  async autoFlagCheck(userId: string, matchData: MatchDataDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User with id "${userId}" not found`);

    const reasons: string[] = [];

    if (matchData.winRate > AUTO_FLAG_WIN_RATE_THRESHOLD) {
      reasons.push(
        `win_rate_anomaly: ${(matchData.winRate * 100).toFixed(1)}% exceeds threshold of ${AUTO_FLAG_WIN_RATE_THRESHOLD * 100}%`,
      );
    }

    if (matchData.avgCommandsPerSecond > AUTO_FLAG_CPS_THRESHOLD) {
      reasons.push(
        `commands_per_second_anomaly: ${matchData.avgCommandsPerSecond} cps exceeds threshold of ${AUTO_FLAG_CPS_THRESHOLD}`,
      );
    }

    if (reasons.length === 0) {
      return { flagged: false, reasons: [] };
    }

    const flag = await this.prisma.antiCheatFlag.create({
      data: {
        userId,
        matchId: matchData.matchId ?? null,
        flagType: 'auto_heuristic_flag',
        severity: 'high',
        data: {
          reasons,
          winRate: matchData.winRate,
          avgCommandsPerSecond: matchData.avgCommandsPerSecond,
          detectedAt: new Date().toISOString(),
        },
        reviewed: false,
      },
    });

    return { flagged: true, flag, reasons };
  }
}
