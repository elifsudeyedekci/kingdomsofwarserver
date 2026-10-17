/**
 * ClanWarService
 *
 * Implements the Clan War system for Kingdoms of War.
 * Covers: war declaration, participant selection, attack recording,
 *         score calculation, winner determination, and war-coin rewards.
 *
 * Prisma models used: ClanWar, ClanWarParticipant, ClanWarAttack,
 *                     ClanMember, PlayerProfile, PlayerWallet, Clan
 *
 * Implements: Clan War System design spec
 */

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import {
  ClanWarDTO,
  ClanWarResultDTO,
  WarAttackDTO,
} from './dto/clan-war.dto';

// ─── Configuration constants (tune without touching logic) ───────────────────

/** Maximum participants selected from each clan when a war starts. */
const WAR_MAX_PARTICIPANTS_PER_CLAN = 15;

/** Maximum attacks each participant may perform per war. */
const WAR_MAX_ATTACKS_PER_MEMBER = 2;

/** War coins awarded to each member of the winning clan on war end. */
const WAR_COINS_REWARD = 50;

// ─── Shared Prisma select shapes ─────────────────────────────────────────────

const WAR_SELECT = {
  id: true,
  clanId: true,
  opponentId: true,
  status: true,
  clanScore: true,
  opponentScore: true,
  scheduledAt: true,
  startedAt: true,
  endedAt: true,
  winnerId: true,
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Map a raw ClanWar DB record to the public ClanWarDTO shape.
 * "clanId" is the attacking clan; "opponentId" is the defending clan.
 */
function toWarDTO(
  war: {
    id: string;
    clanId: string;
    opponentId: string;
    status: string;
    clanScore: number;
    opponentScore: number;
    scheduledAt: Date | null;
    startedAt: Date | null;
    endedAt: Date | null;
    winnerId: string | null;
  },
): ClanWarDTO {
  return {
    id: war.id,
    attackingClanId: war.clanId,
    defendingClanId: war.opponentId,
    status: war.status,
    attackingClanScore: war.clanScore,
    defendingClanScore: war.opponentScore,
    scheduledAt: war.scheduledAt,
    startedAt: war.startedAt,
    endedAt: war.endedAt,
    winnerId: war.winnerId,
  };
}

// ─── Service ─────────────────────────────────────────────────────────────────

/** Paginated wrapper as defined in the Clan War system spec. */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class ClanWarService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Declare war ───────────────────────────────────────────────────────────

  /**
   * Declare a war between two clans scheduled for a future date.
   * Validates that both clans exist and are not already at war
   * (status: 'scheduled' or 'active').
   */
  async declareWar(
    attackingClanId: string,
    defendingClanId: string,
    scheduledAt: Date,
  ): Promise<ClanWarDTO> {
    if (attackingClanId === defendingClanId) {
      throw new BadRequestException('A clan cannot declare war on itself');
    }

    // Verify both clans exist (throws NotFoundException if missing)
    const [attackingClan, defendingClan] = await Promise.all([
      this.prisma.clan.findUnique({ where: { id: attackingClanId } }),
      this.prisma.clan.findUnique({ where: { id: defendingClanId } }),
    ]);

    if (!attackingClan) throw new NotFoundException(`Clan not found: ${attackingClanId}`);
    if (!defendingClan) throw new NotFoundException(`Clan not found: ${defendingClanId}`);

    // Check for an ongoing war between these two clans in either direction
    const existingWar = await this.prisma.clanWar.findFirst({
      where: {
        status: { in: ['scheduled', 'active'] },
        OR: [
          { clanId: attackingClanId, opponentId: defendingClanId },
          { clanId: defendingClanId, opponentId: attackingClanId },
        ],
      },
    });
    if (existingWar) {
      throw new ConflictException(
        'An active or scheduled war between these clans already exists',
      );
    }

    const war = await this.prisma.clanWar.create({
      data: {
        clanId: attackingClanId,
        opponentId: defendingClanId,
        scheduledAt,
        status: 'scheduled',
      },
      select: WAR_SELECT,
    });

    return toWarDTO(war);
  }

  // ─── Start war ─────────────────────────────────────────────────────────────

  /**
   * Transition a scheduled war to 'active', set startedAt, and select
   * up to WAR_MAX_PARTICIPANTS_PER_CLAN members per side ranked by MMR desc.
   */
  async startWar(warId: string): Promise<ClanWarDTO> {
    const war = await this.prisma.clanWar.findUnique({
      where: { id: warId },
      select: WAR_SELECT,
    });
    if (!war) throw new NotFoundException(`Clan war not found: ${warId}`);
    if (war.status !== 'scheduled') {
      throw new BadRequestException(
        `War cannot be started — current status is '${war.status}'`,
      );
    }

    // Select top members by MMR for each clan
    const [attackers, defenders] = await Promise.all([
      this.prisma.playerProfile.findMany({
        where: { clanId: war.clanId },
        orderBy: { mmr: 'desc' },
        take: WAR_MAX_PARTICIPANTS_PER_CLAN,
        select: { userId: true },
      }),
      this.prisma.playerProfile.findMany({
        where: { clanId: war.opponentId },
        orderBy: { mmr: 'desc' },
        take: WAR_MAX_PARTICIPANTS_PER_CLAN,
        select: { userId: true },
      }),
    ]);

    const attackerParticipants = attackers.map((p) => ({
      warId,
      clanId: war.clanId,
      userId: p.userId,
    }));
    const defenderParticipants = defenders.map((p) => ({
      warId,
      clanId: war.opponentId,
      userId: p.userId,
    }));

    const updated = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Enroll participants from both clans
      await tx.clanWarParticipant.createMany({
        data: [...attackerParticipants, ...defenderParticipants],
        skipDuplicates: true,
      });

      return tx.clanWar.update({
        where: { id: warId },
        data: { status: 'active', startedAt: new Date() },
        select: WAR_SELECT,
      });
    });

    return toWarDTO(updated);
  }

  // ─── Record attack ─────────────────────────────────────────────────────────

  /**
   * Record a single war attack (stars 0–3, destruction 0–100%).
   * Enforces that:
   *  - The war is active
   *  - Both attacker and defender are participants in this war
   *  - The attacker has not exceeded WAR_MAX_ATTACKS_PER_MEMBER
   *  - stars and destruction are within valid ranges (handled by DTO validators,
   *    but also guarded here for service-level safety)
   */
  async recordWarAttack(
    warId: string,
    attackerId: string,
    defenderId: string,
    stars: number,
    destruction: number,
  ): Promise<WarAttackDTO> {
    if (stars < 0 || stars > 3) {
      throw new BadRequestException('Stars must be between 0 and 3');
    }
    if (destruction < 0 || destruction > 100) {
      throw new BadRequestException('Destruction must be between 0 and 100');
    }

    const war = await this.prisma.clanWar.findUnique({
      where: { id: warId },
      select: { ...WAR_SELECT, participants: { select: { userId: true, clanId: true } } },
    });
    if (!war) throw new NotFoundException(`Clan war not found: ${warId}`);
    if (war.status !== 'active') {
      throw new BadRequestException(
        `Cannot record an attack — war status is '${war.status}'`,
      );
    }

    // Verify attacker and defender are enrolled participants
    const attackerEntry = war.participants.find((p) => p.userId === attackerId);
    const defenderEntry = war.participants.find((p) => p.userId === defenderId);

    if (!attackerEntry) {
      throw new BadRequestException(`Attacker ${attackerId} is not a participant in this war`);
    }
    if (!defenderEntry) {
      throw new BadRequestException(`Defender ${defenderId} is not a participant in this war`);
    }

    // Attacker and defender must be on opposing sides
    if (attackerEntry.clanId === defenderEntry.clanId) {
      throw new BadRequestException('Attacker and defender must belong to opposing clans');
    }

    // Enforce attack limit per member
    const attackCount = await this.prisma.clanWarAttack.count({
      where: { warId, attackerId },
    });
    if (attackCount >= WAR_MAX_ATTACKS_PER_MEMBER) {
      throw new BadRequestException(
        `Attacker has reached the maximum of ${WAR_MAX_ATTACKS_PER_MEMBER} attacks per war`,
      );
    }

    // Record the attack and update the war score in a transaction
    const attack = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const created = await tx.clanWarAttack.create({
        data: { warId, attackerId, defenderId, stars, destruction },
      });

      // Update score: attacker's clan gains the stars from this attack
      const isAttackingClan = attackerEntry.clanId === war.clanId;
      if (isAttackingClan) {
        await tx.clanWar.update({
          where: { id: warId },
          data: { clanScore: { increment: stars } },
        });
      } else {
        await tx.clanWar.update({
          where: { id: warId },
          data: { opponentScore: { increment: stars } },
        });
      }

      return created;
    });

    return {
      id: attack.id,
      warId: attack.warId,
      attackerId: attack.attackerId,
      defenderId: attack.defenderId,
      stars: attack.stars,
      destruction: attack.destruction,
      createdAt: attack.createdAt,
    };
  }

  // ─── End war ───────────────────────────────────────────────────────────────

  /**
   * Finalize a war: calculate final scores using the best attack per
   * defender for each side, determine the winner, award war coins to
   * winning clan members, and transition status to 'ended'.
   *
   * Scoring rule: sum of the best (highest star) attack per unique defender.
   * Tie-break: higher total destruction among those best attacks wins;
   * if still equal, result is a draw.
   */
  async endWar(warId: string): Promise<ClanWarResultDTO> {
    const war = await this.prisma.clanWar.findUnique({
      where: { id: warId },
      select: {
        ...WAR_SELECT,
        participants: { select: { userId: true, clanId: true } },
        attacks: {
          select: {
            attackerId: true,
            defenderId: true,
            stars: true,
            destruction: true,
          },
        },
      },
    });
    if (!war) throw new NotFoundException(`Clan war not found: ${warId}`);
    if (war.status !== 'active') {
      throw new BadRequestException(
        `War cannot be ended — current status is '${war.status}'`,
      );
    }

    // Build sets of participant user IDs per clan side
    const attackingUserIds = new Set(
      war.participants.filter((p) => p.clanId === war.clanId).map((p) => p.userId),
    );
    const defendingUserIds = new Set(
      war.participants.filter((p) => p.clanId === war.opponentId).map((p) => p.userId),
    );

    // Calculate best attack per defender for each attacking side
    const { score: attackingScore, destruction: attackingDestruction } =
      computeBestAttackScores(war.attacks, attackingUserIds, defendingUserIds);
    const { score: defendingScore, destruction: defendingDestruction } =
      computeBestAttackScores(war.attacks, defendingUserIds, attackingUserIds);

    // Determine winner
    let winner: 'attacking' | 'defending' | 'draw';
    let winnerId: string | null = null;

    if (attackingScore > defendingScore) {
      winner = 'attacking';
      winnerId = war.clanId;
    } else if (defendingScore > attackingScore) {
      winner = 'defending';
      winnerId = war.opponentId;
    } else if (attackingDestruction > defendingDestruction) {
      // Score tie — break by total destruction
      winner = 'attacking';
      winnerId = war.clanId;
    } else if (defendingDestruction > attackingDestruction) {
      winner = 'defending';
      winnerId = war.opponentId;
    } else {
      winner = 'draw';
      winnerId = null;
    }

    // Award war coins to winning clan members
    const winnerMemberIds: string[] = winner === 'attacking'
      ? [...attackingUserIds]
      : winner === 'defending'
        ? [...defendingUserIds]
        : [];

    const updated = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Award coins — upsert wallets that may not yet exist
      if (winnerMemberIds.length > 0) {
        for (const userId of winnerMemberIds) {
          await tx.playerWallet.upsert({
            where: { userId },
            update: { coins: { increment: WAR_COINS_REWARD } },
            create: {
              userId,
              coins: WAR_COINS_REWARD,
              gems: 0,
              chestKeys: 0,
              eventTokens: 0,
              bpXp: 0,
            },
          });
        }
      }

      return tx.clanWar.update({
        where: { id: warId },
        data: {
          status: 'ended',
          endedAt: new Date(),
          clanScore: attackingScore,
          opponentScore: defendingScore,
          winnerId,
        },
        select: WAR_SELECT,
      });
    });

    const warDto = toWarDTO(updated);

    return {
      ...warDto,
      winner,
      warCoinsAwarded: winnerMemberIds.length > 0 ? WAR_COINS_REWARD : 0,
    };
  }

  // ─── Query methods ─────────────────────────────────────────────────────────

  async getWarStatus(warId: string): Promise<ClanWarDTO> {
    const war = await this.prisma.clanWar.findUnique({
      where: { id: warId },
      select: WAR_SELECT,
    });
    if (!war) throw new NotFoundException(`Clan war not found: ${warId}`);
    return toWarDTO(war);
  }

  async getWarHistory(
    clanId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedResponse<ClanWarDTO>> {
    // Verify clan exists
    const clan = await this.prisma.clan.findUnique({ where: { id: clanId } });
    if (!clan) throw new NotFoundException(`Clan not found: ${clanId}`);

    const skip = (page - 1) * limit;
    const where: Prisma.ClanWarWhereInput = {
      OR: [{ clanId }, { opponentId: clanId }],
    };

    const [wars, total] = await Promise.all([
      this.prisma.clanWar.findMany({
        where,
        skip,
        take: limit,
        orderBy: { scheduledAt: 'desc' },
        select: WAR_SELECT,
      }),
      this.prisma.clanWar.count({ where }),
    ]);

    return {
      data: wars.map(toWarDTO),
      total,
      page,
      limit,
    };
  }
}

// ─── Score calculation helper ────────────────────────────────────────────────

/**
 * For each defender that the given attackers have targeted, find the best
 * (highest stars, then highest destruction) attack. Sum those best-attack
 * stars as the clan's final score, and sum destruction for tie-breaking.
 */
function computeBestAttackScores(
  attacks: Array<{
    attackerId: string;
    defenderId: string;
    stars: number;
    destruction: number;
  }>,
  attackerIds: Set<string>,
  defenderIds: Set<string>,
): { score: number; destruction: number } {
  // Key: defenderId → best { stars, destruction } from this side's attackers
  const bestPerDefender = new Map<string, { stars: number; destruction: number }>();

  for (const atk of attacks) {
    if (!attackerIds.has(atk.attackerId)) continue;
    if (!defenderIds.has(atk.defenderId)) continue;

    const existing = bestPerDefender.get(atk.defenderId);
    if (
      !existing ||
      atk.stars > existing.stars ||
      (atk.stars === existing.stars && atk.destruction > existing.destruction)
    ) {
      bestPerDefender.set(atk.defenderId, {
        stars: atk.stars,
        destruction: atk.destruction,
      });
    }
  }

  let score = 0;
  let destruction = 0;
  for (const best of bestPerDefender.values()) {
    score += best.stars;
    destruction += best.destruction;
  }

  return { score, destruction };
}
