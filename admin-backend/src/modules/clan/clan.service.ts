/**
 * ClanService
 *
 * Implements clan management mechanics for Kingdoms of War.
 * Covers: clan CRUD, membership management, role promotion, and clan wars.
 *
 * Prisma models used: Clan, ClanMember, ClanWar, PlayerProfile
 */

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateClanDto } from './dto/create-clan.dto';
import { UpdateClanDto } from './dto/update-clan.dto';
import { AddMemberDto, ClanRole } from './dto/add-member.dto';
import { PromoteMemberDto } from './dto/promote-member.dto';
import { CreateClanWarDto } from './dto/create-clan-war.dto';

/** Maximum number of members per clan. Tune this value without touching logic. */
const CLAN_MAX_MEMBERS = 50;

const CLAN_SELECT = {
  id: true,
  name: true,
  tag: true,
  description: true,
  logoUrl: true,
  leaderId: true,
  gold: true,
  points: true,
  isOpen: true,
  minMmr: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { members: true } },
} as const;

@Injectable()
export class ClanService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Clan queries ───────────────────────────────────────────────────────────

  async getClanById(id: string) {
    const clan = await this.prisma.clan.findUnique({
      where: { id },
      select: CLAN_SELECT,
    });
    if (!clan) throw new NotFoundException(`Clan not found: ${id}`);
    return clan;
  }

  async getClans(page: number, limit: number, search?: string) {
    const skip = (page - 1) * limit;

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { tag: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.clan.findMany({
        where,
        skip,
        take: limit,
        orderBy: { points: 'desc' },
        select: CLAN_SELECT,
      }),
      this.prisma.clan.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  // ─── Clan mutations ─────────────────────────────────────────────────────────

  async createClan(leaderId: string, dto: CreateClanDto) {
    // Prisma unique constraints on name + tag will throw P2002 on duplicates;
    // we let that bubble up naturally as a 409 via a global exception filter.
    return this.prisma.$transaction(async (tx) => {
      const clan = await tx.clan.create({
        data: {
          name: dto.name,
          tag: dto.tag.toUpperCase(),
          description: dto.description,
          logoUrl: dto.logoUrl,
          leaderId,
          isOpen: dto.isOpen ?? true,
          minMmr: dto.minMmr ?? 0,
          members: {
            create: { userId: leaderId, role: 'leader' },
          },
        },
        select: CLAN_SELECT,
      });

      // Reflect clan membership on the player's profile
      await tx.playerProfile.updateMany({
        where: { userId: leaderId },
        data: { clanId: clan.id },
      });

      return clan;
    });
  }

  async updateClan(id: string, dto: UpdateClanDto) {
    await this.getClanById(id); // throws NotFoundException if missing

    return this.prisma.clan.update({
      where: { id },
      data: {
        description: dto.description,
        logoUrl: dto.logoUrl,
        isOpen: dto.isOpen,
        minMmr: dto.minMmr,
      },
      select: CLAN_SELECT,
    });
  }

  async disbandClan(id: string) {
    await this.getClanById(id); // throws NotFoundException if missing

    await this.prisma.$transaction(async (tx) => {
      // Clear clanId from all member profiles before deleting members
      const members = await tx.clanMember.findMany({
        where: { clanId: id },
        select: { userId: true },
      });

      const memberIds = members.map((m) => m.userId);

      await tx.playerProfile.updateMany({
        where: { userId: { in: memberIds } },
        data: { clanId: null },
      });

      await tx.clanMember.deleteMany({ where: { clanId: id } });
      await tx.clan.delete({ where: { id } });
    });
  }

  // ─── Membership ─────────────────────────────────────────────────────────────

  async getMembers(clanId: string) {
    await this.getClanById(clanId); // throws NotFoundException if missing

    return this.prisma.clanMember.findMany({
      where: { clanId },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    });
  }

  async addMember(clanId: string, dto: AddMemberDto) {
    await this.getClanById(clanId); // throws NotFoundException if missing

    // Check for existing membership
    const existing = await this.prisma.clanMember.findUnique({
      where: { clanId_userId: { clanId, userId: dto.userId } },
    });
    if (existing) {
      throw new ConflictException('User is already a member of this clan');
    }

    // Enforce max member cap
    const memberCount = await this.prisma.clanMember.count({ where: { clanId } });
    if (memberCount >= CLAN_MAX_MEMBERS) {
      throw new BadRequestException(
        `Clan has reached the maximum member limit (${CLAN_MAX_MEMBERS})`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const member = await tx.clanMember.create({
        data: {
          clanId,
          userId: dto.userId,
          role: dto.role ?? 'member',
        },
      });

      await tx.playerProfile.updateMany({
        where: { userId: dto.userId },
        data: { clanId },
      });

      return member;
    });
  }

  async removeMember(clanId: string, userId: string) {
    const member = await this.prisma.clanMember.findUnique({
      where: { clanId_userId: { clanId, userId } },
    });
    if (!member) {
      throw new NotFoundException('Member not found in this clan');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.clanMember.delete({
        where: { clanId_userId: { clanId, userId } },
      });

      await tx.playerProfile.updateMany({
        where: { userId, clanId },
        data: { clanId: null },
      });
    });
  }

  async promoteMember(clanId: string, userId: string, dto: PromoteMemberDto) {
    const member = await this.prisma.clanMember.findUnique({
      where: { clanId_userId: { clanId, userId } },
    });
    if (!member) {
      throw new NotFoundException('Member not found in this clan');
    }

    // When promoting someone to leader, demote the current leader to officer
    if (dto.role === 'leader') {
      const clan = await this.getClanById(clanId);

      return this.prisma.$transaction(async (tx) => {
        // Demote previous leader
        await tx.clanMember.updateMany({
          where: { clanId, userId: clan.leaderId },
          data: { role: 'officer' },
        });

        // Promote new leader
        await tx.clanMember.update({
          where: { clanId_userId: { clanId, userId } },
          data: { role: 'leader' },
        });

        // Update the clan's leaderId reference
        return tx.clan.update({
          where: { id: clanId },
          data: { leaderId: userId },
          select: CLAN_SELECT,
        });
      });
    }

    return this.prisma.clanMember.update({
      where: { clanId_userId: { clanId, userId } },
      data: { role: dto.role as ClanRole },
    });
  }

  // ─── Clan Wars ──────────────────────────────────────────────────────────────

  async getClanWars(clanId: string) {
    await this.getClanById(clanId); // throws NotFoundException if missing

    return this.prisma.clanWar.findMany({
      where: {
        OR: [{ clanId }, { opponentId: clanId }],
      },
      orderBy: { startedAt: 'desc' },
    });
  }

  async createClanWar(dto: CreateClanWarDto) {
    if (dto.clanId === dto.opponentId) {
      throw new BadRequestException('A clan cannot declare war on itself');
    }

    // Verify both clans exist
    await Promise.all([this.getClanById(dto.clanId), this.getClanById(dto.opponentId)]);

    // Check for an already active war between the two clans
    const existingWar = await this.prisma.clanWar.findFirst({
      where: {
        status: 'active',
        OR: [
          { clanId: dto.clanId, opponentId: dto.opponentId },
          { clanId: dto.opponentId, opponentId: dto.clanId },
        ],
      },
    });
    if (existingWar) {
      throw new ConflictException('An active war between these clans already exists');
    }

    return this.prisma.clanWar.create({
      data: {
        clanId: dto.clanId,
        opponentId: dto.opponentId,
        endedAt: dto.endedAt ? new Date(dto.endedAt) : undefined,
        status: 'active',
      },
    });
  }
}
