import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AdminGateway } from '../../gateway/admin.gateway';
import { Prisma } from '@prisma/client';
import { CreateMatchDto } from './dto/create-match.dto';
import { RecordResultDto } from './dto/record-result.dto';

const ELO_K = 32;

function expectedScore(rA: number, rB: number): number {
  return 1 / (1 + Math.pow(10, (rB - rA) / 400));
}

function computeEloDeltas(
  ratings: { userId: string; mmr: number }[],
  winnerIds: Set<string>,
): Map<string, number> {
  const deltas = new Map<string, number>(ratings.map((r) => [r.userId, 0]));
  const n = ratings.length;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = ratings[i];
      const b = ratings[j];
      const eA = expectedScore(a.mmr, b.mmr);
      const sA = winnerIds.has(a.userId) ? 1 : 0;
      const sB = winnerIds.has(b.userId) ? 1 : 0;
      deltas.set(a.userId, (deltas.get(a.userId) ?? 0) + ELO_K * (sA - eA));
      deltas.set(b.userId, (deltas.get(b.userId) ?? 0) + ELO_K * (sB - (1 - eA)));
    }
  }

  const divisor = Math.max(1, n - 1);
  for (const [userId, delta] of deltas) {
    deltas.set(userId, Math.round(delta / divisor));
  }

  return deltas;
}

@Injectable()
export class MatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: AdminGateway,
  ) {}

  async create(dto: CreateMatchDto) {
    return this.prisma.match.create({
      data: {
        mode: dto.mode,
        mapId: dto.mapId,
        seed: dto.seed,
        region: dto.region,
        players: dto.players
          ? {
              create: dto.players.map((p) => ({
                userId: p.userId,
                slot: p.slot,
                teamId: p.teamId,
                civId: p.civId,
              })),
            }
          : undefined,
      },
      include: { players: true },
    });
  }

  async start(matchId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: { players: true },
    });
    if (!match) throw new NotFoundException('Match not found');
    if (match.status !== 'waiting') throw new BadRequestException('Match is not in waiting state');

    const userIds = match.players.map((p) => p.userId);
    const profiles = await this.prisma.playerProfile.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, mmr: true },
    });
    const mmrMap = new Map(profiles.map((p) => [p.userId, p.mmr]));

    await this.prisma.$transaction([
      this.prisma.match.update({
        where: { id: matchId },
        data: { status: 'loading', startedAt: new Date() },
      }),
      ...match.players.map((mp) =>
        this.prisma.matchPlayer.update({
          where: { id: mp.id },
          data: { mmrBefore: mmrMap.get(mp.userId) ?? 1000 },
        }),
      ),
    ]);

    const started = await this.prisma.match.findUnique({ where: { id: matchId }, include: { players: true } });
    this.gateway.emitMatchStarted({
      matchId,
      playerCount: match.players.length,
      gameMode: match.mode,
    });
    return started;
  }

  async recordResult(matchId: string, dto: RecordResultDto) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: { players: true },
    });
    if (!match) throw new NotFoundException('Match not found');
    if (match.status === 'completed') throw new BadRequestException('Match already completed');

    const userIds = match.players.map((p) => p.userId);
    const profiles = await this.prisma.playerProfile.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, mmr: true },
    });
    const currentMmrMap = new Map(profiles.map((p) => [p.userId, p.mmr]));

    const winnerIds = new Set(dto.participants.filter((p) => p.isWinner).map((p) => p.userId));
    const ratings = match.players.map((mp) => ({
      userId: mp.userId,
      mmr: mp.mmrBefore ?? currentMmrMap.get(mp.userId) ?? 1000,
    }));
    const deltas = computeEloDeltas(ratings, winnerIds);

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.match.update({
        where: { id: matchId },
        data: {
          status: 'completed',
          endedAt: new Date(),
          durationTicks: dto.durationTicks,
          dataHash: dto.dataHash,
        },
      });

      for (const participant of dto.participants) {
        const delta = deltas.get(participant.userId) ?? 0;
        const mp = match.players.find((p) => p.userId === participant.userId);
        if (!mp) continue;

        const mmrBefore = mp.mmrBefore ?? ratings.find((r) => r.userId === participant.userId)?.mmr ?? 1000;
        const mmrAfter = Math.max(0, mmrBefore + delta);

        await tx.matchPlayer.update({
          where: { id: mp.id },
          data: {
            isWinner: participant.isWinner,
            surrendered: participant.surrendered ?? false,
            disconnected: participant.disconnected ?? false,
            mmrAfter,
            mmrDelta: delta,
          },
        });

        await tx.playerProfile.update({
          where: { userId: participant.userId },
          data: {
            mmr: mmrAfter,
            ...(delta > 0 ? { peakMmr: { increment: delta } } : {}),
            totalMatches: { increment: 1 },
            wins: participant.isWinner ? { increment: 1 } : undefined,
            losses: !participant.isWinner ? { increment: 1 } : undefined,
          },
        });
      }

      await tx.matchResult.create({
        data: {
          matchId,
          winnerUserId: dto.winnerUserId,
          victoryType: dto.victoryType,
          serverValidated: false,
        },
      });
    });

    this.gateway.emitMatchEnded({
      matchId,
      winnerId: dto.winnerUserId,
      duration: dto.durationTicks ?? 0,
    });
    return this.getById(matchId);
  }

  async abandon(matchId: string) {
    const match = await this.prisma.match.findUnique({ where: { id: matchId } });
    if (!match) throw new NotFoundException('Match not found');
    return this.prisma.match.update({
      where: { id: matchId },
      data: { status: 'cancelled', endedAt: new Date() },
    });
  }

  async getById(matchId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        players: {
          select: {
            userId: true,
            slot: true,
            teamId: true,
            civId: true,
            mmrBefore: true,
            mmrAfter: true,
            mmrDelta: true,
            isWinner: true,
            surrendered: true,
          },
        },
        result: true,
      },
    });
    if (!match) throw new NotFoundException('Match not found');
    return match;
  }
}
