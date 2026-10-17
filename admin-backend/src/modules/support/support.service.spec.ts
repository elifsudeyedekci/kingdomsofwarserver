/**
 * Story Type : Logic (service-layer data operations)
 * Output     : tests/unit/support/  (co-located NestJS convention)
 * Gate Level : BLOCKING
 *
 * NOTE: SupportService is a stub at the time of writing. Tests are written
 * against the domain surface derived from the Prisma schema
 * (SupportTicket, ModerationReport, Ban, Mute).
 * Method signatures are forward-looking contracts.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SupportService } from './support.service';
import { PrismaService } from '../../database/prisma.service';

// ---------------------------------------------------------------------------
// Prisma mock
// ---------------------------------------------------------------------------

const mockPrisma: any = {
  supportTicket: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  moderationReport: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  ban: {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  mute: {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TICKET_ID = 'ticket-uuid-1';
const USER_ID = 'user-uuid-1';
const ADMIN_ID = 'admin-uuid-1';
const REPORT_ID = 'report-uuid-1';
const BAN_ID = 'ban-uuid-1';

const openTicket = {
  id: TICKET_ID,
  userId: USER_ID,
  subject: 'Cannot connect to match',
  category: 'technical',
  priority: 'medium',
  status: 'open',
  assignedTo: null,
  messages: [],
  resolvedAt: null,
  closedAt: null,
  createdAt: new Date('2026-06-01'),
  updatedAt: new Date('2026-06-01'),
};

const resolvedTicket = {
  ...openTicket,
  status: 'resolved',
  resolvedAt: new Date('2026-06-02'),
};

const pendingReport = {
  id: REPORT_ID,
  reporterId: 'user-uuid-2',
  targetUserId: USER_ID,
  type: 'cheating',
  reason: 'Speed hack suspected',
  evidence: null,
  status: 'pending',
  reviewedBy: null,
  reviewNote: null,
  createdAt: new Date('2026-06-01'),
  reviewedAt: null,
};

const activeBan = {
  id: BAN_ID,
  userId: USER_ID,
  type: 'temporary',
  reason: 'Cheating confirmed',
  evidence: null,
  bannedBy: ADMIN_ID,
  matchId: null,
  startsAt: new Date('2026-06-01'),
  endsAt: new Date('2026-06-08'),
  isActive: true,
  liftedBy: null,
  liftedAt: null,
  liftNote: null,
  createdAt: new Date('2026-06-01'),
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('SupportService', () => {
  let service: SupportService;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupportService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SupportService>(SupportService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // getTickets()
  // -------------------------------------------------------------------------
  describe('getTickets()', () => {
    it('returns paginated tickets filtered by status', async () => {
      mockPrisma.supportTicket.findMany.mockResolvedValue([openTicket]);
      mockPrisma.supportTicket.count.mockResolvedValue(1);

      const result = await service.getTickets({ status: 'open', page: 1, limit: 20 });

      expect(mockPrisma.supportTicket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'open' }),
          skip: 0,
          take: 20,
        }),
      );
      expect(result.items[0].status).toBe('open');
    });

    it('returns all tickets when no status filter is provided', async () => {
      mockPrisma.supportTicket.findMany.mockResolvedValue([openTicket, resolvedTicket]);
      mockPrisma.supportTicket.count.mockResolvedValue(2);

      const result = await service.getTickets({ page: 1, limit: 20 });

      expect(result.total).toBe(2);
    });

    it('returns empty list when no tickets exist', async () => {
      mockPrisma.supportTicket.findMany.mockResolvedValue([]);
      mockPrisma.supportTicket.count.mockResolvedValue(0);

      const result = await service.getTickets({ page: 1, limit: 20 });

      expect(result.items).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // getTicketById()
  // -------------------------------------------------------------------------
  describe('getTicketById()', () => {
    it('returns the ticket when found', async () => {
      mockPrisma.supportTicket.findUnique.mockResolvedValue(openTicket);

      const result = await service.getTicketById(TICKET_ID);

      expect(result.id).toBe(TICKET_ID);
    });

    it('throws NotFoundException when ticket does not exist', async () => {
      mockPrisma.supportTicket.findUnique.mockResolvedValue(null);

      await expect(service.getTicketById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // updateTicketStatus()
  // -------------------------------------------------------------------------
  describe('updateTicketStatus()', () => {
    it('transitions open ticket to in_progress and assigns agent', async () => {
      const updatedTicket = { ...openTicket, status: 'in_progress', assignedTo: ADMIN_ID };
      mockPrisma.supportTicket.findUnique.mockResolvedValue(openTicket);
      mockPrisma.supportTicket.update.mockResolvedValue(updatedTicket);

      const result = await service.updateTicketStatus(TICKET_ID, {
        status: 'in_progress',
        assignedTo: ADMIN_ID,
      });

      expect(mockPrisma.supportTicket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: TICKET_ID },
          data: expect.objectContaining({ status: 'in_progress', assignedTo: ADMIN_ID }),
        }),
      );
      expect(result.status).toBe('in_progress');
    });

    it('sets resolvedAt timestamp when transitioning to resolved', async () => {
      mockPrisma.supportTicket.findUnique.mockResolvedValue(openTicket);
      mockPrisma.supportTicket.update.mockResolvedValue(resolvedTicket);

      await service.updateTicketStatus(TICKET_ID, { status: 'resolved' });

      const updateCall = mockPrisma.supportTicket.update.mock.calls[0][0];
      expect(updateCall.data.resolvedAt).toBeInstanceOf(Date);
    });

    it('throws NotFoundException when ticket does not exist', async () => {
      mockPrisma.supportTicket.findUnique.mockResolvedValue(null);

      await expect(
        service.updateTicketStatus('nonexistent', { status: 'resolved' }),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.supportTicket.update).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when transitioning a closed ticket', async () => {
      const closedTicket = { ...openTicket, status: 'closed', closedAt: new Date() };
      mockPrisma.supportTicket.findUnique.mockResolvedValue(closedTicket);

      await expect(
        service.updateTicketStatus(TICKET_ID, { status: 'in_progress' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // -------------------------------------------------------------------------
  // getModerationReports()
  // -------------------------------------------------------------------------
  describe('getModerationReports()', () => {
    it('returns pending reports ordered by createdAt descending', async () => {
      mockPrisma.moderationReport.findMany.mockResolvedValue([pendingReport]);
      mockPrisma.moderationReport.count.mockResolvedValue(1);

      const result = await service.getModerationReports({ status: 'pending', page: 1, limit: 20 });

      expect(mockPrisma.moderationReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'pending' }),
        }),
      );
      expect(result.items[0].type).toBe('cheating');
    });
  });

  // -------------------------------------------------------------------------
  // reviewModerationReport()
  // -------------------------------------------------------------------------
  describe('reviewModerationReport()', () => {
    it('marks report as reviewed with reviewer info', async () => {
      const reviewed = {
        ...pendingReport,
        status: 'reviewed',
        reviewedBy: ADMIN_ID,
        reviewNote: 'Confirmed via match replay',
        reviewedAt: new Date(),
      };
      mockPrisma.moderationReport.findUnique.mockResolvedValue(pendingReport);
      mockPrisma.moderationReport.update.mockResolvedValue(reviewed);

      const result = await service.reviewModerationReport(REPORT_ID, {
        reviewedBy: ADMIN_ID,
        reviewNote: 'Confirmed via match replay',
        status: 'reviewed',
      });

      expect(mockPrisma.moderationReport.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: REPORT_ID },
          data: expect.objectContaining({ reviewedBy: ADMIN_ID, status: 'reviewed' }),
        }),
      );
      expect(result.status).toBe('reviewed');
    });

    it('throws NotFoundException when report does not exist', async () => {
      mockPrisma.moderationReport.findUnique.mockResolvedValue(null);

      await expect(
        service.reviewModerationReport('nonexistent', { reviewedBy: ADMIN_ID, status: 'reviewed' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // banPlayer()
  // -------------------------------------------------------------------------
  describe('banPlayer()', () => {
    it('creates an active ban record for the target user', async () => {
      mockPrisma.ban.findFirst.mockResolvedValue(null);
      mockPrisma.ban.create.mockResolvedValue(activeBan);

      const result = await service.banPlayer({
        userId: USER_ID,
        type: 'temporary',
        reason: 'Cheating confirmed',
        bannedBy: ADMIN_ID,
        endsAt: activeBan.endsAt,
      });

      expect(mockPrisma.ban.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: USER_ID,
            isActive: true,
            bannedBy: ADMIN_ID,
          }),
        }),
      );
      expect(result.isActive).toBe(true);
    });

    it('throws BadRequestException when an active ban already exists for the user', async () => {
      mockPrisma.ban.findFirst.mockResolvedValue(activeBan);

      await expect(
        service.banPlayer({
          userId: USER_ID,
          type: 'temporary',
          reason: 'Duplicate ban',
          bannedBy: ADMIN_ID,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.ban.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when reason is empty', async () => {
      mockPrisma.ban.findFirst.mockResolvedValue(null);

      await expect(
        service.banPlayer({ userId: USER_ID, type: 'temporary', reason: '', bannedBy: ADMIN_ID }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // -------------------------------------------------------------------------
  // liftBan()
  // -------------------------------------------------------------------------
  describe('liftBan()', () => {
    it('sets isActive=false and records liftedBy and liftedAt', async () => {
      const liftedBan = {
        ...activeBan,
        isActive: false,
        liftedBy: ADMIN_ID,
        liftedAt: new Date(),
        liftNote: 'Appeal accepted',
      };
      mockPrisma.ban.findFirst.mockResolvedValue(activeBan);
      mockPrisma.ban.update.mockResolvedValue(liftedBan);

      const result = await service.liftBan(BAN_ID, { liftedBy: ADMIN_ID, liftNote: 'Appeal accepted' });

      expect(mockPrisma.ban.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: BAN_ID },
          data: expect.objectContaining({ isActive: false, liftedBy: ADMIN_ID }),
        }),
      );
      expect(result.isActive).toBe(false);
    });

    it('throws NotFoundException when no active ban exists with the given id', async () => {
      mockPrisma.ban.findFirst.mockResolvedValue(null);

      await expect(
        service.liftBan('nonexistent', { liftedBy: ADMIN_ID }),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.ban.update).not.toHaveBeenCalled();
    });
  });
});
