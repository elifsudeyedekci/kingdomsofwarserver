import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from './notification.service';
import { PrismaService } from '../../database/prisma.service';

const mockPrisma: any = {
  notification:              { create: jest.fn(), createMany: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn(), update: jest.fn(), updateMany: jest.fn(), delete: jest.fn() },
  playerDevice:              { updateMany: jest.fn(), findMany: jest.fn() },
  mailCampaign:              { findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
  smsCampaign:               { findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
  communicationPreference:   { upsert: jest.fn() },
};

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(async () => {
    jest.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<NotificationService>(NotificationService);
  });

  describe('sendNotification()', () => {
    it('creates and returns notification record', async () => {
      const dto: any = { userId: 'u1', type: 'match_start', title: 'Go!' };
      const created = { id: 'n1', ...dto, isRead: false, sentAt: new Date() };
      mockPrisma.notification.create.mockResolvedValue(created);
      const result = await service.sendNotification(dto);
      expect(result).toEqual(created);
      expect(mockPrisma.notification.create).toHaveBeenCalled();
    });
  });

  describe('getUserNotifications()', () => {
    it('returns paginated results', async () => {
      const data  = [{ id: 'n1' }, { id: 'n2' }];
      mockPrisma.notification.findMany.mockResolvedValue(data);
      mockPrisma.notification.count.mockResolvedValue(2);
      const result = await service.getUserNotifications('u1', 1, 20);
      expect(result.data).toEqual(data);
      expect(result.total).toBe(2);
    });
  });

  describe('markAsRead()', () => {
    it('throws NotFoundException when notification belongs to different user', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue({ id: 'n1', userId: 'other' });
      await expect(service.markAsRead('n1', 'u1')).rejects.toThrow(NotFoundException);
    });

    it('marks notification as read for correct user', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue({ id: 'n1', userId: 'u1' });
      const updated = { id: 'n1', isRead: true, readAt: new Date() };
      mockPrisma.notification.update.mockResolvedValue(updated);
      const result = await service.markAsRead('n1', 'u1');
      expect(result.isRead).toBe(true);
    });
  });

  describe('markAllAsRead()', () => {
    it('updates all unread notifications for user', async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 5 });
      const result = await service.markAllAsRead('u1');
      expect(result.updated).toBe(5);
    });
  });

  describe('getUnreadCount()', () => {
    it('returns correct count', async () => {
      mockPrisma.notification.count.mockResolvedValue(3);
      await expect(service.getUnreadCount('u1')).resolves.toEqual({ count: 3 });
    });
  });

  describe('getPreferences()', () => {
    it('creates default preferences when not found (upsert)', async () => {
      const prefs = { userId: 'u1', pushEnabled: true, mailEnabled: false };
      mockPrisma.communicationPreference.upsert.mockResolvedValue(prefs);
      const result = await service.getPreferences('u1');
      expect(result).toEqual(prefs);
      expect(mockPrisma.communicationPreference.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'u1' }, create: { userId: 'u1' } }),
      );
    });
  });

  describe('sendMailCampaign()', () => {
    it('throws BadRequestException when campaign is not draft', async () => {
      mockPrisma.mailCampaign.findUnique.mockResolvedValue({ id: 'c1', status: 'sent' });
      await expect(service.sendMailCampaign('c1')).rejects.toThrow(BadRequestException);
    });

    it('sets status to sent for draft campaigns', async () => {
      mockPrisma.mailCampaign.findUnique.mockResolvedValue({ id: 'c1', status: 'draft' });
      const updated = { id: 'c1', status: 'sent', sentAt: new Date() };
      mockPrisma.mailCampaign.update.mockResolvedValue(updated);
      const result = await service.sendMailCampaign('c1');
      expect(result.status).toBe('sent');
    });
  });
});
