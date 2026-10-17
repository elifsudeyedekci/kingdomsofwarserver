import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateLiveOpsEventDto } from './dto/create-event.dto';
import { CreateQuestDto } from './dto/create-quest.dto';

const XP_PER_LEVEL = 1000;

@Injectable()
export class LiveOpsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- Season ----------

  async getSeason(seasonId: string) {
    const season = await this.prisma.season.findUnique({ where: { id: seasonId } });
    if (!season) throw new NotFoundException(`Season ${seasonId} not found`);
    return season;
  }

  /** All seasons, newest first, with how many battle passes each has. */
  async listSeasons() {
    const seasons = await this.prisma.season.findMany({ orderBy: { number: 'desc' } });
    const counts = await this.prisma.battlePass.groupBy({ by: ['seasonId'], _count: { _all: true } });
    const by = new Map(counts.map((c) => [c.seasonId, c._count._all]));
    return seasons.map((x) => ({ ...x, battlePasses: by.get(x.id) ?? 0 }));
  }

  /** Real battle-pass numbers of one season. */
  async battlePassStats(seasonId: string) {
    const [agg, premium, top] = await Promise.all([
      this.prisma.battlePass.aggregate({ where: { seasonId }, _count: { _all: true }, _avg: { level: true, xp: true }, _max: { level: true } }),
      this.prisma.battlePass.count({ where: { seasonId, isPremium: true } }),
      this.prisma.battlePass.findMany({ where: { seasonId }, orderBy: [{ level: 'desc' }, { xp: 'desc' }], take: 10, select: { userId: true, level: true, xp: true, isPremium: true } }),
    ]);
    return { seasonId, players: agg._count._all, premium, premiumRate: agg._count._all ? Math.round((premium / agg._count._all) * 100) : 0, avgLevel: Math.round((agg._avg.level ?? 0) * 10) / 10, avgXp: Math.round(agg._avg.xp ?? 0), maxLevel: agg._max.level ?? 0, top };
  }

  async getActiveSeason() {
    const season = await this.prisma.season.findFirst({ where: { isActive: true } });
    if (!season) throw new NotFoundException('No active season found');
    return season;
  }

  async createSeason(data: { number: number; name: string; startAt: Date; endAt: Date; bpMaxLevel?: number }) {
    return this.prisma.season.create({ data });
  }

  async setActiveSeason(seasonId: string) {
    const exists = await this.prisma.season.findUnique({ where: { id: seasonId } });
    if (!exists) throw new NotFoundException(`Season ${seasonId} not found`);
    await this.prisma.$transaction([
      this.prisma.season.updateMany({ data: { isActive: false } }),
      this.prisma.season.update({ where: { id: seasonId }, data: { isActive: true } }),
    ]);
    return this.prisma.season.findUnique({ where: { id: seasonId } });
  }

  // ---------- Events ----------

  async getEvents(page = 1, limit = 20, activeOnly?: boolean) {
    const skip  = (page - 1) * limit;
    const where = activeOnly ? { isActive: true } : {};
    const [data, total] = await Promise.all([
      this.prisma.liveOpsEvent.findMany({ where, skip, take: limit, orderBy: { startAt: 'desc' } }),
      this.prisma.liveOpsEvent.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async getEvent(id: string) {
    const event = await this.prisma.liveOpsEvent.findUnique({ where: { id } });
    if (!event) throw new NotFoundException(`Event ${id} not found`);
    return event;
  }

  async createEvent(dto: CreateLiveOpsEventDto) {
    return this.prisma.liveOpsEvent.create({
      data: {
        titleKey:   dto.titleKey,
        descKey:    dto.descKey,
        type:       dto.type,
        startAt:    new Date(dto.startAt),
        endAt:      new Date(dto.endAt),
        config:     dto.config,
        rewards:    dto.rewards,
        segment:    dto.segment,
        countries:  dto.countries ?? [],
        minVersion: dto.minVersion,
      },
    });
  }

  async updateEvent(id: string, data: Partial<CreateLiveOpsEventDto> & { isActive?: boolean }) {
    await this.getEvent(id);
    return this.prisma.liveOpsEvent.update({ where: { id }, data });
  }

  async deleteEvent(id: string) {
    await this.getEvent(id);
    return this.prisma.liveOpsEvent.delete({ where: { id } });
  }

  async getActiveEvents(countryCode?: string, appVersion?: string) {
    const now = new Date();
    const events = await this.prisma.liveOpsEvent.findMany({
      where: { isActive: true, startAt: { lte: now }, endAt: { gte: now } },
    });
    return events.filter((ev) => {
      if (countryCode && ev.countries.length > 0 && !ev.countries.includes(countryCode)) return false;
      if (appVersion && ev.minVersion && appVersion < ev.minVersion) return false;
      return true;
    });
  }

  // ---------- Battle Pass ----------

  async getBattlePass(userId: string, seasonId: string) {
    await this.getSeason(seasonId);
    return this.prisma.battlePass.upsert({
      where:  { seasonId_userId: { seasonId, userId } },
      create: { seasonId, userId },
      update: {},
    });
  }

  async grantBattlePassXp(userId: string, seasonId: string, xp: number) {
    if (!Number.isInteger(xp) || xp <= 0) throw new BadRequestException('xp must be a positive integer');
    const season  = await this.getSeason(seasonId);
    const bp      = await this.getBattlePass(userId, seasonId);
    const totalXp = bp.xp + xp;
    const newLevel = Math.min(Math.floor(totalXp / XP_PER_LEVEL), season.bpMaxLevel);
    return this.prisma.battlePass.update({
      where: { seasonId_userId: { seasonId, userId } },
      data:  { xp: totalXp, level: newLevel },
    });
  }

  async purchasePremiumPass(userId: string, seasonId: string) {
    const bp = await this.getBattlePass(userId, seasonId);
    if (bp.isPremium) throw new BadRequestException('Premium battle pass already purchased');
    return this.prisma.battlePass.update({
      where: { seasonId_userId: { seasonId, userId } },
      data:  { isPremium: true, purchasedAt: new Date() },
    });
  }

  // ---------- Quests ----------

  async getQuests(type?: string, isActive?: boolean) {
    const where: Record<string, any> = {};
    if (type     !== undefined) where.type     = type;
    if (isActive !== undefined) where.isActive = isActive;
    return this.prisma.quest.findMany({ where, orderBy: { createdAt: 'desc' } });
  }

  async createQuest(dto: CreateQuestDto) {
    return this.prisma.quest.create({ data: { ...dto } });
  }

  // ---------- Chests ----------

  async getChests() {
    return this.prisma.chest.findMany({ where: { isActive: true } });
  }

  async getChest(chestType: string) {
    const chest = await this.prisma.chest.findUnique({ where: { chestType } });
    if (!chest) throw new NotFoundException(`Chest type "${chestType}" not found`);
    return chest;
  }
}
