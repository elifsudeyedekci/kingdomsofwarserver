import { Optional } from '@nestjs/common';
import { PrivacyService } from '../privacy/privacy.service';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrivacyRequestType, PrivacyRequestStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AcceptLegalDto } from './dto/accept-legal.dto';
import { CreateLegalTextDto } from './dto/create-legal-text.dto';

@Injectable()
export class LegalService {
  constructor(private readonly prisma: PrismaService, @Optional() private readonly privacy?: PrivacyService) {}

  // ---------- Legal Texts ----------

  async getActiveLegalTexts(language: string) {
    return this.prisma.legalText.findMany({
      where: { isActive: true, language },
      orderBy: { publishedAt: 'desc' },
    });
  }

  async getLegalText(type: string, language: string) {
    const text = await this.prisma.legalText.findFirst({
      where: { type, language, isActive: true },
    });
    if (!text) throw new NotFoundException(`Legal text "${type}" (${language}) not found`);
    return text;
  }

  async createLegalText(dto: CreateLegalTextDto) {
    const hash = crypto.createHash('md5').update(dto.content).digest('hex');
    return this.prisma.legalText.create({ data: { ...dto, hash } });
  }

  async publishLegalText(id: string) {
    const text = await this.prisma.legalText.findUnique({ where: { id } });
    if (!text) throw new NotFoundException(`Legal text ${id} not found`);
    return this.prisma.$transaction(async (tx) => {
      await tx.legalText.updateMany({
        where: { type: text.type, language: text.language, id: { not: id } },
        data:  { isActive: false },
      });
      return tx.legalText.update({
        where: { id },
        data:  { isActive: true, publishedAt: new Date() },
      });
    });
  }

  // ---------- Acceptances ----------

  async acceptLegal(userId: string, dto: AcceptLegalDto, ipAddress?: string) {
    const text = await this.prisma.legalText.findUnique({ where: { id: dto.legalTextId } });
    if (!text) throw new NotFoundException(`Legal text ${dto.legalTextId} not found`);
    return this.prisma.legalAcceptance.create({
      data: {
        userId,
        legalTextId: dto.legalTextId,
        ipAddress,
        deviceId:   dto.deviceId,
        appVersion: dto.appVersion,
        language:   dto.language,
        country:    dto.country,
      },
    });
  }

  async getUserAcceptances(userId: string) {
    return this.prisma.legalAcceptance.findMany({
      where:   { userId },
      include: { legalText: true },
      orderBy: { acceptedAt: 'desc' },
    });
  }

  async hasUserAccepted(userId: string, legalTextId: string) {
    const count = await this.prisma.legalAcceptance.count({ where: { userId, legalTextId } });
    return count > 0;
  }

  async getLegalEvidence(userId: string) {
    const acceptances = await this.prisma.legalAcceptance.findMany({
      where:   { userId },
      include: { legalText: true },
    });
    return { userId, exportedAt: new Date(), acceptances };
  }

  // ---------- Privacy Requests ----------

  async createPrivacyRequest(userId: string, type: PrivacyRequestType) {
    const existing = await this.prisma.privacyRequest.findFirst({
      where: { userId, status: { in: ['pending', 'processing'] } },
    });
    if (existing) throw new BadRequestException('A pending or in-progress privacy request already exists for this user');
    return this.prisma.privacyRequest.create({ data: { userId, type } });
  }

  async getPrivacyRequests(status?: PrivacyRequestStatus, page = 1, limit = 10) {
    const skip  = (page - 1) * limit;
    const where = status ? { status } : {};
    const [data, total] = await Promise.all([
      this.prisma.privacyRequest.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.privacyRequest.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async getPrivacyRequest(id: string) {
    const req = await this.prisma.privacyRequest.findUnique({
      where:   { id },
      include: { exportJob: true, deleteJob: true },
    });
    if (!req) throw new NotFoundException(`Privacy request ${id} not found`);
    return req;
  }

  async startProcessing(id: string, adminId: string) {
    await this.getPrivacyRequest(id);
    return this.prisma.privacyRequest.update({
      where: { id },
      data:  { status: 'processing', assignedAdmin: adminId },
    });
  }

  /** The export is generated on demand from the live data (GET .../export); the request is marked completed and points to it. */
  async completeExport(id: string, fileUrl?: string) {
    await this.getPrivacyRequest(id);
    fileUrl = fileUrl || `/legal/privacy-requests/${id}/export`;
    return this.prisma.$transaction(async (tx) => {
      const req = await tx.privacyRequest.update({
        where: { id },
        data:  { status: 'completed', resultUrl: fileUrl, completedAt: new Date() },
      });
      await tx.dataExportJob.upsert({
        where:  { privacyRequestId: id },
        create: { privacyRequestId: id, status: 'completed', fileUrl, completedAt: new Date() },
        update: { status: 'completed', fileUrl, completedAt: new Date() },
      });
      return req;
    });
  }

  /** REALLY erases / anonymises the player's personal data first, then records the request as completed. Irreversible. */
  async completeDelete(id: string, adminId: string) {
    const pr = await this.getPrivacyRequest(id);
    if (this.privacy) await this.privacy.erase(pr.userId, adminId);
    return this.prisma.$transaction(async (tx) => {
      const req = await tx.privacyRequest.update({
        where: { id },
        data:  { status: 'completed', completedAt: new Date() },
      });
      await tx.dataDeleteJob.upsert({
        where:  { privacyRequestId: id },
        create: {
          privacyRequestId:         id,
          status:                   'completed',
          completedAt:              new Date(),
          confirmedByAdmin:         adminId,
          irreversibleConfirmedAt:  new Date(),
        },
        update: {
          status:                  'completed',
          completedAt:             new Date(),
          confirmedByAdmin:        adminId,
          irreversibleConfirmedAt: new Date(),
        },
      });
      return req;
    });
  }

  async exportForRequest(id: string) {
    const pr = await this.getPrivacyRequest(id);
    if (!this.privacy) throw new Error('privacy service unavailable');
    return this.privacy.export(pr.userId);
  }

  // ---------- Evidence Export ----------

  async exportLegalEvidence(userId: string, requestedBy?: string) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    return this.prisma.legalEvidenceExport.create({
      data: { userId, requestedBy, exportedAt: new Date(), expiresAt },
    });
  }
}
