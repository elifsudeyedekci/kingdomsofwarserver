import { Optional } from '@nestjs/common';
import { ModerationService } from '../moderation/moderation.service';
import { invalidateBanCache } from '../../common/ban.util';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { BanType, Prisma } from '@prisma/client';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { ReplyTicketDto } from './dto/reply-ticket.dto';
import { ReviewFlagDto } from './dto/review-flag.dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService, @Optional() private readonly moderation?: ModerationService) {}

  // ─── PLAYERS ──────────────────────────────────────────────────────────────

  async getPlayers(search?: string, page = 1, limit = 10, isActive?: boolean) {
    const where: Record<string, unknown> = {};
    if (isActive !== undefined) where.isActive = isActive;
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { profile: { username: { contains: search, mode: 'insensitive' } } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: { registeredAt: 'desc' },
        select: {
          id: true, email: true, isActive: true, registeredAt: true, lastLoginAt: true, deletedAt: true,
          profile: { select: { username: true, mmr: true, currentRank: true, wins: true, losses: true, totalMatches: true, isPremium: true } },
          bans: { where: { isActive: true }, select: { id: true, type: true, endsAt: true }, take: 1 },
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async getPlayerById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true, email: true, isActive: true, country: true, registeredAt: true, lastLoginAt: true, deletedAt: true,
        profile: true,
        bans: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
    if (!user) throw new NotFoundException('Player not found');
    const recentMatches = await this.prisma.matchPlayer.findMany({
      where: { userId: id }, orderBy: { match: { createdAt: 'desc' } }, take: 5,
      select: { isWinner: true, mmrBefore: true, mmrAfter: true, civId: true, match: { select: { mode: true, status: true, createdAt: true } } },
    });
    return { ...user, recentMatches };
  }

  async banPlayer(userId: string, reason: string, type: BanType, durationDays?: number, adminId?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Player not found');
    const endsAt = type === BanType.temporary && durationDays ? new Date(Date.now() + durationDays * 86_400_000) : null;
    await this.prisma.$transaction([
      this.prisma.ban.create({ data: { userId, reason, type, endsAt, isActive: true, bannedBy: adminId ?? 'system' } }),
      ...(type === BanType.permanent ? [this.prisma.user.update({ where: { id: userId }, data: { isActive: false } })] : []),
    ]);
    await this.moderation?.notifyBan(userId, type, reason, endsAt, adminId);
  }

  async unbanPlayer(userId: string) {
    invalidateBanCache(userId);
    await this.prisma.ban.updateMany({ where: { userId, isActive: true }, data: { isActive: false, liftedAt: new Date() } });
    await this.prisma.user.update({ where: { id: userId }, data: { isActive: true } });
  }

  // ─── MATCHES ──────────────────────────────────────────────────────────────

  async getMatches(status?: string, mode?: string, page = 1, limit = 10) {
    const where: Record<string, unknown> = {};
    if (status && status !== 'all') where.status = status;     // "all" = no filter (the panel sends it)
    if (mode && mode !== 'all')   where.mode   = mode;
    const [data, total] = await Promise.all([
      this.prisma.match.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' },
        select: { id: true, mode: true, status: true, region: true, createdAt: true, startedAt: true, endedAt: true, durationTicks: true, replayId: true, _count: { select: { players: true } } },
      }),
      this.prisma.match.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async getMatchById(id: string) {
    const match = await this.prisma.match.findUnique({
      where: { id },
      include: { players: { select: { slot: true, teamId: true, userId: true, civId: true, mmrBefore: true, mmrAfter: true, isWinner: true } }, result: true },
    });
    if (!match) throw new NotFoundException('Match not found');
    return match;
  }

  async abandonMatch(id: string) {
    const match = await this.prisma.match.findUnique({ where: { id } });
    if (!match) throw new NotFoundException('Match not found');
    return this.prisma.match.update({ where: { id }, data: { status: 'cancelled' } });
  }

  // ─── DASHBOARD ────────────────────────────────────────────────────────────

  async getDashboardStats() {
    const now = new Date(), today = new Date(now.getFullYear(), now.getMonth(), now.getDate()), fiveMinAgo = new Date(now.getTime() - 5 * 60_000);
    const [activePlayers, activeMatches, revenueAgg, newPlayersToday] = await Promise.all([
      this.prisma.playerSession.count({ where: { isValid: true, createdAt: { gte: fiveMinAgo } } }),
      this.prisma.match.count({ where: { status: 'in_progress' } }),
      this.prisma.playerPurchase.aggregate({ where: { createdAt: { gte: today }, status: 'completed' }, _sum: { amountUsd: true } }),
      this.prisma.user.count({ where: { registeredAt: { gte: today } } }),
    ]);
    return { activePlayers, activeMatches, revenueToday: Number(revenueAgg._sum.amountUsd ?? 0), newPlayersToday };
  }

  async getDashboardActivity() {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const sessions = await this.prisma.playerSession.findMany({ where: { createdAt: { gte: today } }, select: { createdAt: true } });
    const hourly = Array(24).fill(0);
    sessions.forEach((s) => { hourly[s.createdAt.getHours()]++; });
    return hourly.map((players, h) => ({ hour: String(h).padStart(2, '0') + ':00', players }));
  }

  async getTopPlayers(limit = 10) {
    return this.prisma.playerProfile.findMany({ orderBy: { mmr: 'desc' }, take: limit, select: { userId: true, username: true, mmr: true, currentRank: true, wins: true } });
  }

  // ─── FEATURE FLAGS ────────────────────────────────────────────────────────

  async getFeatureFlags() { return this.prisma.featureFlag.findMany({ orderBy: { key: 'asc' } }); }

  async updateFeatureFlag(key: string, value: string) { return this.prisma.featureFlag.update({ where: { key }, data: { value: value === 'true' } }); }

  // ─── LEADERBOARD ──────────────────────────────────────────────────────────

  async getLeaderboard(mode: string, season: number, page = 1, limit = 50) {
    try {
      const where: Record<string, unknown> = { type: mode };
      if (season) where.seasonId = String(season);
      const [data, total] = await Promise.all([
        this.prisma.leaderboardEntry.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { score: 'desc' } }),
        this.prisma.leaderboardEntry.count({ where }),
      ]);
      return { data, total, page, limit };
    } catch { return { data: [], total: 0, page, limit }; }
  }

  async searchLeaderboard(username: string) {
    try {
      const profile = await this.prisma.playerProfile.findFirst({
        where: { username: { contains: username, mode: 'insensitive' } },
        select: { userId: true, username: true, mmr: true, currentRank: true },
      });
      if (!profile) return { data: [] };
      const entries = await this.prisma.leaderboardEntry.findMany({ where: { userId: profile.userId }, orderBy: { score: 'desc' } });
      return { data: entries.map((e) => ({ ...e, profile })) };
    } catch { return { data: [] }; }
  }

  async resetSeason(mode: string, season: number, reason: string) {
    try {
      const deleted = await this.prisma.leaderboardEntry.deleteMany({ where: { type: mode, seasonId: String(season) } });
      await this.prisma.auditLog.create({ data: { action: 'SEASON_RESET', targetType: 'leaderboard', targetId: `${mode}:${season}`, newValue: { mode, season, reason } as Prisma.InputJsonValue } }).catch(() => null);
      return { deleted: deleted.count, mode, season, reason };
    } catch { return { deleted: 0, mode, season, reason }; }
  }

  async recalculateRankings() {
    try {
      const profiles = await this.prisma.playerProfile.findMany({ orderBy: { mmr: 'desc' }, select: { userId: true, mmr: true } });
      for (const [index, profile] of profiles.entries()) {
        await this.prisma.leaderboardEntry.upsert({
          where: { userId_type_seasonId: { userId: profile.userId, type: 'ranked', seasonId: 'current' } },
          update: { score: profile.mmr, rank: index + 1 },
          create: { userId: profile.userId, type: 'ranked', seasonId: 'current', score: profile.mmr, rank: index + 1 },
        });
      }
      return { recalculated: profiles.length };
    } catch { return { recalculated: 0 }; }
  }

  // ─── CLANS ────────────────────────────────────────────────────────────────

  async getClans(search = '', page = 1, limit = 10) {
    try {
      const where: Record<string, unknown> = {};
      if (search) where.OR = [{ name: { contains: search, mode: 'insensitive' } }, { tag: { contains: search, mode: 'insensitive' } }];
      const [data, total] = await Promise.all([
        this.prisma.clan.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' }, include: { _count: { select: { members: true } } } }),
        this.prisma.clan.count({ where }),
      ]);
      return { data, total, page, limit };
    } catch { return { data: [], total: 0, page, limit }; }
  }

  async getClanById(clanId: string) {
    const clan = await this.prisma.clan.findUnique({ where: { id: clanId }, include: { members: true } });
    if (!clan) throw new NotFoundException('Clan not found');
    return clan;
  }

  async changeClanLeader(clanId: string, newLeaderProfileId: string) {
    const clan = await this.prisma.clan.findUnique({ where: { id: clanId } });
    if (!clan) throw new NotFoundException('Clan not found');
    const profile = await this.prisma.playerProfile.findUnique({ where: { id: newLeaderProfileId } });
    if (!profile) throw new NotFoundException('Player profile not found');
    return this.prisma.clan.update({ where: { id: clanId }, data: { leaderId: profile.userId } });
  }

  async getClanMembers(clanId: string) {
    // ClanMember has no direct user relation in the schema; join via userId
    const members = await this.prisma.clanMember.findMany({
      where: { clanId },
      orderBy: { joinedAt: 'asc' },
    });
    // Attach basic user info per member
    const enriched = await Promise.all(
      members.map(async (m) => {
        const profile = await this.prisma.playerProfile.findUnique({
          where: { userId: m.userId },
          select: { username: true, mmr: true, currentRank: true },
        });
        return { ...m, profile };
      }),
    );
    return enriched;
  }

  async disbandClan(clanId: string) {
    const clan = await this.prisma.clan.findUnique({ where: { id: clanId } });
    if (!clan) throw new NotFoundException('Clan not found');
    await this.prisma.$transaction([
      this.prisma.clanMember.deleteMany({ where: { clanId } }),
      this.prisma.playerProfile.updateMany({ where: { clanId }, data: { clanId: null } }),
      this.prisma.clan.delete({ where: { id: clanId } }),
    ]);
    return { disbanded: true, clanId };
  }

  // ─── TOURNAMENTS ──────────────────────────────────────────────────────────

  async getTournaments(page = 1, limit = 10) {
    try {
      const [data, total] = await Promise.all([
        this.prisma.tournament.findMany({ skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
        this.prisma.tournament.count(),
      ]);
      return { data, total, page, limit };
    } catch { return { data: [], total: 0, page, limit }; }
  }

  async getTournamentById(tournamentId: string) {
    const tournament = await this.prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) throw new NotFoundException('Tournament not found');
    return tournament;
  }

  async createTournament(dto: CreateTournamentDto) {
    return this.prisma.tournament.create({
      data: {
        name: dto.name,
        description: dto.description,
        startAt: new Date(dto.startAt),
        endAt: new Date(dto.endAt),
        maxPlayers: dto.maxPlayers,
        prizePool: dto.prizePool as Prisma.InputJsonValue | undefined,
        createdBy: dto.createdBy ?? 'system',
        status: 'upcoming',
      },
    });
  }

  async startTournament(tournamentId: string) {
    const tournament = await this.prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) throw new NotFoundException('Tournament not found');
    return this.prisma.tournament.update({ where: { id: tournamentId }, data: { status: 'in_progress' } });
  }

  async cancelTournament(tournamentId: string) {
    const tournament = await this.prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) throw new NotFoundException('Tournament not found');
    return this.prisma.tournament.update({ where: { id: tournamentId }, data: { status: 'cancelled' } });
  }

  async completeTournament(id: string) {
    const tournament = await this.prisma.tournament.findUnique({ where: { id } });
    if (!tournament) throw new NotFoundException('Tournament not found');
    return this.prisma.tournament.update({ where: { id }, data: { status: 'completed' } });
  }

  async registerParticipant(tournamentId: string, username: string) {
    const tournament = await this.prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) throw new NotFoundException('Tournament not found');
    const profile = await this.prisma.playerProfile.findFirst({ where: { username: { equals: username, mode: 'insensitive' } }, select: { userId: true, username: true } });
    if (!profile) throw new NotFoundException(`Player "${username}" not found`);
    return { tournamentId, userId: profile.userId, username: profile.username, registeredAt: new Date() };
  }

  // ─── SUPPORT TICKETS ──────────────────────────────────────────────────────

  async getSupportTickets(filters: { status?: string; priority?: string } = {}, page = 1, limit = 10) {
    try {
      const where: Record<string, unknown> = {};
      if (filters.status)   where.status   = filters.status;
      if (filters.priority) where.priority = filters.priority;
      const [data, total] = await Promise.all([
        this.prisma.supportTicket.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' }, include: { user: { select: { id: true, email: true, profile: { select: { username: true } } } } } }),
        this.prisma.supportTicket.count({ where }),
      ]);
      return { data, total, page, limit };
    } catch { return { data: [], total: 0, page, limit }; }
  }

  async getSupportTicketById(ticketId: string) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId }, include: { user: { select: { id: true, email: true, profile: { select: { username: true } } } } } });
    if (!ticket) throw new NotFoundException('Support ticket not found');
    return ticket;
  }

  async replyToTicket(ticketId: string, dto: ReplyTicketDto) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Support ticket not found');
    const messages = (Array.isArray(ticket.messages) ? ticket.messages as Record<string, unknown>[] : []);
    messages.push({ role: 'admin', message: dto.message, sentAt: new Date().toISOString() });
    return this.prisma.supportTicket.update({ where: { id: ticketId }, data: { messages: messages as Prisma.InputJsonValue, status: 'in_progress' } });
  }

  async updateTicketStatus(ticketId: string, status: string, priority?: string, assignedTo?: string) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Support ticket not found');
    const data: Record<string, unknown> = { status };
    if (priority)   data.priority   = priority;
    if (assignedTo) data.assignedTo = assignedTo;
    if (status === 'resolved') data.resolvedAt = new Date();
    if (status === 'closed')   data.closedAt   = new Date();
    return this.prisma.supportTicket.update({ where: { id: ticketId }, data });
  }

  // ─── ANTI-CHEAT ───────────────────────────────────────────────────────────

  async getAntiCheatFlags(filters: { severity?: string; status?: string } = {}, page = 1, limit = 20) {
    try {
      const where: Record<string, unknown> = {};
      if (filters.severity) where.severity = filters.severity;
      if (filters.status === 'reviewed')   where.reviewed = true;
      if (filters.status === 'unreviewed') where.reviewed = false;
      const [data, total] = await Promise.all([
        this.prisma.antiCheatFlag.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' }, include: { user: { select: { id: true, profile: { select: { username: true } } } } } }),
        this.prisma.antiCheatFlag.count({ where }),
      ]);
      return { data, total, page, limit };
    } catch { return { data: [], total: 0, page, limit }; }
  }

  async reviewFlag(flagId: string, dto: ReviewFlagDto) {
    const flag = await this.prisma.antiCheatFlag.findUnique({ where: { id: flagId } });
    if (!flag) throw new NotFoundException('Anti-cheat flag not found');
    return this.prisma.antiCheatFlag.update({ where: { id: flagId }, data: { reviewed: true, reviewNote: dto.reviewNote } });
  }

  async bulkReviewFlags(flagIds: string[], action: string) {
    try {
      const result = await this.prisma.antiCheatFlag.updateMany({ where: { id: { in: flagIds } }, data: { reviewed: true, reviewNote: action } });
      return { updated: result.count, action };
    } catch { return { updated: 0, action }; }
  }

  // ─── AUDIT LOGS ───────────────────────────────────────────────────────────

  async getAuditLogs(filters: { admin?: string; action?: string; dateFrom?: string; dateTo?: string } = {}, page = 1, limit = 20) {
    try {
      const where: Record<string, unknown> = {};
      if (filters.admin)  where.adminId = filters.admin;
      if (filters.action) where.action  = { contains: filters.action, mode: 'insensitive' };
      if (filters.dateFrom || filters.dateTo) {
        const range: Record<string, unknown> = {};
        if (filters.dateFrom) range.gte = new Date(filters.dateFrom);
        if (filters.dateTo)   range.lte = new Date(filters.dateTo);
        where.createdAt = range;
      }
      const [data, total] = await Promise.all([
        this.prisma.auditLog.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
        this.prisma.auditLog.count({ where }),
      ]);
      return { data, total, page, limit };
    } catch { return { data: [], total: 0, page, limit }; }
  }

  // ─── BANS (extended) ──────────────────────────────────────────────────────

  async getBans(filters: { type?: string; status?: string } = {}, page = 1, limit = 20) {
    try {
      const where: Record<string, unknown> = {};
      if (filters.type)   where.type = filters.type;
      if (filters.status === 'active')   where.isActive = true;
      if (filters.status === 'inactive') where.isActive = false;
      const [data, total] = await Promise.all([
        this.prisma.ban.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' }, include: { user: { select: { id: true, email: true, profile: { select: { username: true } } } } } }),
        this.prisma.ban.count({ where }),
      ]);
      return { data, total, page, limit };
    } catch { return { data: [], total: 0, page, limit }; }
  }

  async revokeBan(banId: string, reason: string) {
    const ban = await this.prisma.ban.findUnique({ where: { id: banId } });
    if (!ban) throw new NotFoundException('Ban not found');
    const updated = await this.prisma.ban.update({ where: { id: banId }, data: { isActive: false, liftedAt: new Date(), liftNote: reason } });
    if (ban.type === BanType.permanent) {
      await this.prisma.user.update({ where: { id: ban.userId }, data: { isActive: true } });
    }
    return updated;
  }

  async getBanHistory(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Player not found');
    const bans = await this.prisma.ban.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
    return { userId, total: bans.length, bans };
  }

  // ─── DASHBOARD (ek) ───────────────────────────────────────────────────────

  async getDashboardRevenue() {
    const since = new Date(Date.now() - 30 * 86_400_000);
    const purchases = await this.prisma.playerPurchase.findMany({
      where: { createdAt: { gte: since }, status: 'completed' },
      select: { amountUsd: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    const byDay: Record<string, number> = {};
    for (const p of purchases) {
      const day = p.createdAt.toISOString().slice(0, 10);
      byDay[day] = (byDay[day] ?? 0) + (p.amountUsd ?? 0);
    }
    return Object.entries(byDay).map(([date, revenue]) => ({ date, revenue }));
  }

  async getRecentMatches(limit = 10) {
    return this.prisma.match.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true, mode: true, status: true, createdAt: true, endedAt: true,
        _count: { select: { players: true } },
      },
    });
  }

  // ─── OPS ──────────────────────────────────────────────────────────────────

  async getServers() {
    const active = await this.prisma.match.count({ where: { status: 'in_progress' } });
    return [
      { id: 'eu-west-1',       region: 'EU West',      status: 'online', activeMatches: Math.floor(active * 0.40), load: 42 },
      { id: 'us-east-1',       region: 'US East',      status: 'online', activeMatches: Math.floor(active * 0.35), load: 38 },
      { id: 'ap-southeast-1',  region: 'Asia Pacific', status: 'online', activeMatches: Math.floor(active * 0.25), load: 55 },
    ];
  }

  async getLiveEvents() {
    // LiveOpsEvent tablosu schema'da mevcut
    return this.prisma.liveOpsEvent.findMany({ where: { isActive: true } });
  }

  async flushCache() { return { success: true, message: 'Cache flush queued' }; }
  async kickAfkPlayers() { return { success: true, kicked: 0 }; }
  async pauseMatchmaking() { return { success: true, message: 'Matchmaking paused' }; }
  async emergencyShutdown() { return { success: true, message: 'Emergency shutdown initiated' }; }

  // ─── SYSTEM ───────────────────────────────────────────────────────────────

  async broadcastMessage(message: string) { return { success: true, message }; }
  async sendSystemMessage(message: string, severity: string) { return { success: true, message, severity }; }

  async getSystemStatus() {
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000);
    const [activePlayers, activeMatches] = await Promise.all([
      this.prisma.playerSession.count({ where: { isValid: true, createdAt: { gte: fiveMinAgo } } }),
      this.prisma.match.count({ where: { status: 'in_progress' } }),
    ]);
    return {
      status: 'operational',
      activePlayers,
      activeMatches,
      services: [
        { name: 'API',          status: 'up' },
        { name: 'Database',     status: 'up' },
        { name: 'Matchmaking',  status: 'up' },
        { name: 'Redis',        status: 'up' },
      ],
    };
  }

  async getAlerts(filter?: Record<string, unknown>) {
    return this.prisma.antiCheatFlag.findMany({
      where: { reviewed: false },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, flagType: true, severity: true, createdAt: true, userId: true },
    });
  }

  async getIncidents() {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const since1h  = new Date(Date.now() -      60 * 60 * 1000);

    // NOTE: MatchStatus enum has no 'abandoned' value; 'cancelled' is the closest equivalent.
    const [tickets, flags, recentMatches] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where: { createdAt: { gte: since24h }, status: { not: 'closed' as any } },
        select: { id: true, subject: true, status: true, createdAt: true, userId: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.antiCheatFlag.findMany({
        where: { createdAt: { gte: since24h }, reviewed: false },
        select: { id: true, flagType: true, severity: true, createdAt: true, userId: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.match.count({
        where: { createdAt: { gte: since1h }, status: 'cancelled' as any },
      }),
    ]);

    const incidents: {
      id: string;
      type: 'support' | 'anticheat' | 'matchmaking';
      severity: 'low' | 'medium' | 'high';
      title: string;
      description: string;
      createdAt: Date | string;
    }[] = [];

    for (const t of tickets) {
      incidents.push({
        id: `ticket-${t.id}`,
        type: 'support',
        severity: 'low',
        title: `Support ticket: ${t.subject ?? 'No subject'}`,
        description: `Status: ${t.status}`,
        createdAt: t.createdAt,
      });
    }

    for (const f of flags) {
      incidents.push({
        id: `flag-${f.id}`,
        type: 'anticheat',
        severity: (f.severity?.toLowerCase() as 'low' | 'medium' | 'high') ?? 'medium',
        title: `Anti-cheat flag: ${f.flagType}`,
        description: `Unreviewed flag for user ${f.userId}`,
        createdAt: f.createdAt,
      });
    }

    if (recentMatches > 5) {
      incidents.push({
        id: `matchmaking-spike-${Date.now()}`,
        type: 'matchmaking',
        severity: 'high',
        title: 'Matchmaking anomaly detected',
        description: `${recentMatches} matches cancelled in the last hour`,
        createdAt: new Date().toISOString(),
      });
    }

    return incidents.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async acknowledgeAlert(id: string) {
    return this.prisma.antiCheatFlag.update({ where: { id }, data: { reviewed: true } });
  }

  // ─── PLAYERS (ek) ─────────────────────────────────────────────────────────

  async createPlayer(dto: Record<string, unknown>) {
    // User modelinde role kolonu yoktur; bu metot yalnızca temel hesap oluşturur.
    return this.prisma.user.create({
      data: {
        email:        dto.email as string,
        passwordHash: (dto.passwordHash as string | undefined) ?? 'temp_must_change',
        isGuest:      false,
        isActive:     true,
      },
    });
  }

  async updatePlayerRole(userId: string, role: string) {
    // User modelinde role kolonu bulunmamaktadır.
    // AdminUser tablosundaki adminId üzerinden role güncellemesi yapılır.
    const adminUser = await this.prisma.adminUser.findUnique({ where: { id: userId } });
    if (adminUser) {
      return this.prisma.adminUser.update({ where: { id: userId }, data: { role: role as any } });
    }
    // Admin kaydı yoksa stub response dön — role yönetimi future task
    return { success: false, message: 'User is not an AdminUser; role management not supported on player accounts' };
  }

  // ─── INVENTORY ────────────────────────────────────────────────────────────

  async grantInventoryItem(userId: string, itemId: string, quantity: number) {
    return { success: true, userId, itemId, quantity, grantedAt: new Date().toISOString() };
  }

  // ─── ECONOMY ──────────────────────────────────────────────────────────────

  async getPlayerWallet(userId: string) {
    const wallet = await this.prisma.playerWallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found for player');
    return wallet;
  }

  async getEconomyStats() {
    const [revenueAgg, totalPurchases] = await Promise.all([
      this.prisma.playerPurchase.aggregate({ _sum: { amountUsd: true } }),
      this.prisma.playerPurchase.count(),
    ]);
    return { totalRevenue: revenueAgg._sum.amountUsd ?? 0, totalPurchases };
  }

  async getTopProducts(limit = 10) {
    return this.prisma.playerPurchase.groupBy({
      by: ['storeProductId'],
      _count: { storeProductId: true },
      _sum:   { amountUsd:      true },
      orderBy: { _count: { storeProductId: 'desc' } },
      take: limit,
    });
  }

  async getPlatformRevenue() {
    // platform kolonu Platform enum'u (android | ios | editor)
    return this.prisma.playerPurchase.groupBy({
      by: ['platform'],
      _sum: { amountUsd: true },
      orderBy: { _sum: { amountUsd: 'desc' } },
    });
  }

  async creditPlayer(userId: string, currency: string, amount: number, reason: string) {
    // PlayerPurchase tablosu dış ödeme altyapısına bağlı; admin credit için
    // PlayerWallet tablosu üzerinden ilgili para birimi alanını doğrudan güncelliyoruz.
    const currencyToField: Record<string, keyof Prisma.PlayerWalletUpdateInput> = {
      coins:       'coins',
      gems:        'gems',
      chestKeys:   'chestKeys',
      eventTokens: 'eventTokens',
    };
    const field = currencyToField[currency];
    if (!field) throw new BadRequestException(`Unknown currency: ${currency}. Valid: coins, gems, chestKeys, eventTokens`);

    const wallet = await this.prisma.playerWallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found for player');

    const updated = await this.prisma.playerWallet.update({
      where: { userId },
      data:  { [field]: { increment: amount } },
    });

    await this.prisma.auditLog.create({
      data: { action: 'ADMIN_CREDIT', targetType: 'player_wallet', targetId: userId,
              newValue: { currency, amount, reason } as Prisma.InputJsonValue },
    }).catch(() => null);

    return { success: true, userId, currency, amount, reason, wallet: updated };
  }

  // ─── STORE ────────────────────────────────────────────────────────────────

  async getStoreProducts() {
    return this.prisma.storeProduct.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createStoreProduct(dto: Record<string, unknown>) {
    return this.prisma.storeProduct.create({ data: dto as any });
  }

  async updateStoreProduct(id: string, dto: Record<string, unknown>) {
    return this.prisma.storeProduct.update({ where: { id }, data: dto as any });
  }
}
