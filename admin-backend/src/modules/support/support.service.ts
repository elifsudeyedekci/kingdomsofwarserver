/**
 * SupportService
 *
 * Implements the Support & Moderation system described in the game's
 * administration design. Covers:
 *   - Support ticket lifecycle (open → in_progress → resolved/closed)
 *   - Moderation report review workflow
 *   - Player ban and mute management
 *
 * All data is persisted via PrismaService using the SupportTicket,
 * ModerationReport, Ban, and Mute models defined in schema.prisma.
 */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, SupportTicketStatus, SupportTicketPriority } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { ReplyTicketDto } from './dto/reply-ticket.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { AssignTicketDto } from './dto/assign-ticket.dto';
import { ResolveTicketDto } from './dto/resolve-ticket.dto';
import { BanPlayerDto } from './dto/ban-player.dto';
import { LiftBanDto } from './dto/lift-ban.dto';
import { ReviewReportDto } from './dto/review-report.dto';

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

export interface GetTicketsParams {
  page: number;
  limit: number;
  status?: SupportTicketStatus;
  priority?: SupportTicketPriority;
}

export interface GetModerationReportsParams {
  page: number;
  limit: number;
  status?: string;
}

interface TicketMessage {
  id: string;
  senderId: string;
  body: string;
  isAdminReply: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Status transition rules
// ---------------------------------------------------------------------------

/**
 * Allowed status transitions.
 * closed tickets cannot move to any other status except open (reopen).
 * Attempting to move a closed ticket to anything except open throws.
 */
const CLOSED_REOPEN_TARGET: SupportTicketStatus = SupportTicketStatus.open;

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Tickets
  // -------------------------------------------------------------------------

  /**
   * Returns a paginated list of support tickets, optionally filtered by
   * status and/or priority. Used by admin dashboard.
   */
  async getTickets(params: GetTicketsParams) {
    const { page, limit, status, priority } = params;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (priority) where.priority = priority;

    const [items, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, email: true } } },
      }),
      this.prisma.supportTicket.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  /**
   * Returns a single ticket with all message history included.
   * Throws NotFoundException if the ticket does not exist.
   */
  async getTicketById(id: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: { user: { select: { id: true, email: true } } },
    });
    if (!ticket) throw new NotFoundException('Support ticket not found');
    return ticket;
  }

  /**
   * Returns a player's own ticket history, paginated.
   */
  async getPlayerTickets(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.supportTicket.count({ where: { userId } }),
    ]);
    return { items, total, page, limit };
  }

  /**
   * Creates a new support ticket for the given user.
   * Initial status is always 'open'.
   */
  async createTicket(userId: string, dto: CreateTicketDto) {
    const firstMessage: TicketMessage = {
      id: crypto.randomUUID(),
      senderId: userId,
      body: dto.body,
      isAdminReply: false,
      createdAt: new Date().toISOString(),
    };

    return this.prisma.supportTicket.create({
      data: {
        userId,
        subject: dto.subject,
        category: dto.category,
        priority: dto.priority ?? SupportTicketPriority.medium,
        status: SupportTicketStatus.open,
        messages: [firstMessage] as unknown as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Appends a reply message to the ticket's messages JSON array.
   * Automatically moves status from 'open' to 'in_progress' when an
   * admin replies for the first time.
   */
  async replyToTicket(ticketId: string, dto: ReplyTicketDto) {
    const ticket = await this.getTicketById(ticketId);

    const existingMessages = Array.isArray(ticket.messages)
      ? (ticket.messages as unknown) as TicketMessage[]
      : [];

    const newMessage: TicketMessage = {
      id: crypto.randomUUID(),
      senderId: dto.senderId,
      body: dto.body,
      isAdminReply: dto.isAdminReply ?? false,
      createdAt: new Date().toISOString(),
    };

    const updatedMessages = [...existingMessages, newMessage];

    const newStatus =
      dto.isAdminReply && ticket.status === SupportTicketStatus.open
        ? SupportTicketStatus.in_progress
        : ticket.status;

    return this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        messages: updatedMessages as unknown as Prisma.InputJsonValue,
        status: newStatus,
      },
    });
  }

  /**
   * Transitions a ticket to the requested status.
   *
   * Rules:
   *   - Ticket must exist (NotFoundException otherwise).
   *   - A 'closed' ticket can only be re-opened (status = 'open').
   *     Any other target throws BadRequestException.
   *   - Transitioning to 'resolved' automatically sets resolvedAt.
   *   - Transitioning to 'closed' automatically sets closedAt.
   *   - Optional assignedTo may be set alongside the status change.
   */
  async updateTicketStatus(id: string, dto: UpdateTicketStatusDto) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('Support ticket not found');

    if (
      ticket.status === SupportTicketStatus.closed &&
      dto.status !== CLOSED_REOPEN_TARGET
    ) {
      throw new BadRequestException(
        `Cannot transition a closed ticket to '${dto.status}'. Reopen it first (status=open).`,
      );
    }

    const data: Record<string, unknown> = {
      status: dto.status,
    };

    if (dto.assignedTo !== undefined) data.assignedTo = dto.assignedTo;

    if (dto.status === SupportTicketStatus.resolved) {
      data.resolvedAt = new Date();
    }

    if (dto.status === SupportTicketStatus.closed) {
      data.closedAt = new Date();
    }

    return this.prisma.supportTicket.update({
      where: { id },
      data,
    });
  }

  /**
   * Assigns a ticket to a specific admin user.
   * Status remains unchanged; use updateTicketStatus separately
   * if you also want to change the status.
   */
  async assignTicket(id: string, dto: AssignTicketDto) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('Support ticket not found');

    return this.prisma.supportTicket.update({
      where: { id },
      data: { assignedTo: dto.adminId },
    });
  }

  /**
   * Marks a ticket as resolved with a resolution note.
   * Sets resolvedAt timestamp automatically.
   */
  async resolveTicket(id: string, dto: ResolveTicketDto) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('Support ticket not found');

    // Store resolution note as the last admin message for audit trail.
    const existingMessages = Array.isArray(ticket.messages)
      ? (ticket.messages as unknown) as TicketMessage[]
      : [];

    const resolutionMessage: TicketMessage = {
      id: crypto.randomUUID(),
      senderId: 'system',
      body: `[RESOLUTION] ${dto.resolution}`,
      isAdminReply: true,
      createdAt: new Date().toISOString(),
    };

    return this.prisma.supportTicket.update({
      where: { id },
      data: {
        status: SupportTicketStatus.resolved,
        resolvedAt: new Date(),
        messages: [...existingMessages, resolutionMessage] as unknown as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Returns aggregate stats for the support dashboard:
   *   - Count per status (open, in_progress, waiting_player, resolved, closed)
   *   - Average resolution time in hours (resolved tickets only)
   */
  async getTicketStats() {
    const [open, inProgress, waitingPlayer, resolved, closed] =
      await Promise.all([
        this.prisma.supportTicket.count({
          where: { status: SupportTicketStatus.open },
        }),
        this.prisma.supportTicket.count({
          where: { status: SupportTicketStatus.in_progress },
        }),
        this.prisma.supportTicket.count({
          where: { status: SupportTicketStatus.waiting_player },
        }),
        this.prisma.supportTicket.count({
          where: { status: SupportTicketStatus.resolved },
        }),
        this.prisma.supportTicket.count({
          where: { status: SupportTicketStatus.closed },
        }),
      ]);

    // Average resolution time: only consider tickets that have both
    // createdAt and resolvedAt set.
    const resolvedTickets = await this.prisma.supportTicket.findMany({
      where: {
        status: SupportTicketStatus.resolved,
        resolvedAt: { not: null },
      },
      select: { createdAt: true, resolvedAt: true },
    });

    let avgResolutionHours: number | null = null;
    if (resolvedTickets.length > 0) {
      const totalMs = resolvedTickets.reduce((sum, t) => {
        const diff = t.resolvedAt!.getTime() - t.createdAt.getTime();
        return sum + diff;
      }, 0);
      avgResolutionHours =
        Math.round((totalMs / resolvedTickets.length / 3_600_000) * 100) / 100;
    }

    return {
      open,
      in_progress: inProgress,
      waiting_player: waitingPlayer,
      resolved,
      closed,
      total: open + inProgress + waitingPlayer + resolved + closed,
      avgResolutionHours,
    };
  }

  // -------------------------------------------------------------------------
  // Moderation Reports
  // -------------------------------------------------------------------------

  /**
   * Returns a paginated list of moderation reports, optionally filtered by
   * status. Ordered by createdAt descending (newest first).
   */
  async getModerationReports(params: GetModerationReportsParams) {
    const { page, limit, status } = params;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      this.prisma.moderationReport.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.moderationReport.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  /**
   * Marks a moderation report as reviewed with reviewer info and optional note.
   * Throws NotFoundException if the report does not exist.
   */
  async reviewModerationReport(id: string, dto: ReviewReportDto) {
    const report = await this.prisma.moderationReport.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Moderation report not found');

    return this.prisma.moderationReport.update({
      where: { id },
      data: {
        status: dto.status,
        reviewedBy: dto.reviewedBy,
        reviewNote: dto.reviewNote,
        reviewedAt: new Date(),
      },
    });
  }

  // -------------------------------------------------------------------------
  // Bans
  // -------------------------------------------------------------------------

  /**
   * Creates an active ban record for the target user.
   *
   * Rules:
   *   - reason must be non-empty (BadRequestException otherwise).
   *   - If the user already has an active ban, throws BadRequestException.
   */
  async banPlayer(dto: BanPlayerDto) {
    if (!dto.reason || dto.reason.trim().length === 0) {
      throw new BadRequestException('Ban reason must not be empty');
    }

    const existingActiveBan = await this.prisma.ban.findFirst({
      where: { userId: dto.userId, isActive: true },
    });

    if (existingActiveBan) {
      throw new BadRequestException(
        `User '${dto.userId}' already has an active ban (id: ${existingActiveBan.id}).`,
      );
    }

    return this.prisma.ban.create({
      data: {
        userId: dto.userId,
        type: dto.type,
        reason: dto.reason,
        bannedBy: dto.bannedBy,
        isActive: true,
        endsAt: dto.endsAt,
        matchId: dto.matchId,
        evidence: dto.evidence,
      },
    });
  }

  /**
   * Lifts an active ban: sets isActive=false and records who lifted it.
   * Throws NotFoundException when no active ban with that id exists.
   */
  async liftBan(banId: string, dto: LiftBanDto) {
    const ban = await this.prisma.ban.findFirst({
      where: { id: banId, isActive: true },
    });
    if (!ban) throw new NotFoundException('Active ban not found');

    return this.prisma.ban.update({
      where: { id: banId },
      data: {
        isActive: false,
        liftedBy: dto.liftedBy,
        liftedAt: new Date(),
        liftNote: dto.liftNote,
      },
    });
  }

  /**
   * Returns all active bans for a given user (most recent first).
   */
  async getActiveBans(userId: string) {
    return this.prisma.ban.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
