import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SendNotificationDto, BulkNotificationDto } from './dto/send-notification.dto';
import { CreateMailCampaignDto, CreateSmsCampaignDto } from './dto/create-campaign.dto';
import { UpdatePreferenceDto } from './dto/update-preference.dto';

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- In-game Notifications ----------

  async sendNotification(dto: SendNotificationDto) {
    return this.prisma.notification.create({
      data: {
        userId:   dto.userId,
        type:     dto.type,
        title:    dto.title,
        body:     dto.body,
        titleKey: dto.titleKey,
        bodyKey:  dto.bodyKey,
        data:     dto.data,
        sentAt:   new Date(),
      },
    });
  }

  async sendBulkNotification(dto: BulkNotificationDto) {
    const now = new Date();
    const result = await this.prisma.notification.createMany({
      data: dto.userIds.map((userId) => ({
        userId,
        type:   dto.type,
        title:  dto.title,
        body:   dto.body,
        data:   dto.data,
        sentAt: now,
      })),
    });
    return { sent: result.count };
  }

  async getUserNotifications(userId: string, page = 1, limit = 20, unreadOnly = false) {
    const skip  = (page - 1) * limit;
    const where = unreadOnly ? { userId, isRead: false } : { userId };
    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.notification.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async markAsRead(notificationId: string, userId: string) {
    const notif = await this.prisma.notification.findUnique({ where: { id: notificationId } });
    if (!notif || notif.userId !== userId) throw new NotFoundException('Notification not found');
    return this.prisma.notification.update({
      where: { id: notificationId },
      data:  { isRead: true, readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data:  { isRead: true, readAt: new Date() },
    });
    return { updated: result.count };
  }

  async deleteNotification(id: string, userId: string) {
    const notif = await this.prisma.notification.findUnique({ where: { id } });
    if (!notif || notif.userId !== userId) throw new NotFoundException('Notification not found');
    return this.prisma.notification.delete({ where: { id } });
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({ where: { userId, isRead: false } });
    return { count };
  }

  // ---------- Push Tokens ----------

  async registerPushToken(userId: string, deviceId: string, pushToken: string) {
    return this.prisma.playerDevice.updateMany({
      where: { userId, deviceId },
      data:  { pushToken, isActive: true },
    });
  }

  async getUserPushTokens(userId: string) {
    return this.prisma.playerDevice.findMany({
      where:  { userId, isActive: true, pushToken: { not: null } },
      select: { deviceId: true, platform: true, pushToken: true },
    });
  }

  // ---------- Mail Campaigns ----------

  async getMailCampaigns(page = 1, limit = 10, status?: string) {
    const skip  = (page - 1) * limit;
    const where = status ? { status } : {};
    const [data, total] = await Promise.all([
      this.prisma.mailCampaign.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.mailCampaign.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async createMailCampaign(dto: CreateMailCampaignDto, createdBy: string) {
    return this.prisma.mailCampaign.create({
      data: { ...dto, createdBy, countries: dto.countries ?? [] },
    });
  }

  async updateMailCampaign(id: string, data: Partial<CreateMailCampaignDto>) {
    return this.prisma.mailCampaign.update({ where: { id }, data });
  }

  async sendMailCampaign(id: string) {
    const campaign = await this.prisma.mailCampaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException(`Mail campaign ${id} not found`);
    if (campaign.status !== 'draft') throw new BadRequestException('Campaign must be in draft status to send');
    return this.prisma.mailCampaign.update({
      where: { id },
      data:  { status: 'sent', sentAt: new Date() },
    });
  }

  async trackMailOpen(id: string) {
    return this.prisma.mailCampaign.update({ where: { id }, data: { openCount: { increment: 1 } } });
  }

  async trackMailClick(id: string) {
    return this.prisma.mailCampaign.update({ where: { id }, data: { clickCount: { increment: 1 } } });
  }

  // ---------- SMS Campaigns ----------

  async getSmsCampaigns(page = 1, limit = 10) {
    const skip  = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.smsCampaign.findMany({ skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.smsCampaign.count(),
    ]);
    return { data, total, page, limit };
  }

  async createSmsCampaign(dto: CreateSmsCampaignDto, createdBy: string) {
    return this.prisma.smsCampaign.create({
      data: { ...dto, createdBy, countries: dto.countries ?? [] },
    });
  }

  async sendSmsCampaign(id: string) {
    const campaign = await this.prisma.smsCampaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException(`SMS campaign ${id} not found`);
    if (campaign.status !== 'draft') throw new BadRequestException('Campaign must be in draft status to send');
    return this.prisma.smsCampaign.update({
      where: { id },
      data:  { status: 'sent', sentAt: new Date() },
    });
  }

  // ---------- Communication Preferences ----------

  async getPreferences(userId: string) {
    return this.prisma.communicationPreference.upsert({
      where:  { userId },
      create: { userId },
      update: {},
    });
  }

  async updatePreferences(userId: string, dto: UpdatePreferenceDto) {
    return this.prisma.communicationPreference.upsert({
      where:  { userId },
      create: { userId, ...dto },
      update: dto,
    });
  }

  async canSendPush(userId: string) {
    const prefs = await this.getPreferences(userId);
    return prefs.pushEnabled;
  }

  async canSendMail(userId: string) {
    const prefs = await this.getPreferences(userId);
    return prefs.mailEnabled;
  }
}
