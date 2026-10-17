import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { LegalService } from './legal.service';
import { PrismaService } from '../../database/prisma.service';

const mockPrisma: any = {
  legalText:           { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  legalAcceptance:     { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  legalEvidenceExport: { create: jest.fn() },
  privacyRequest:      { create: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn(), update: jest.fn() },
  dataExportJob:       { upsert: jest.fn() },
  dataDeleteJob:       { upsert: jest.fn() },
  $transaction:        jest.fn((fn: any) => fn(mockPrisma)),
};

describe('LegalService', () => {
  let service: LegalService;

  beforeEach(async () => {
    jest.resetAllMocks();
    mockPrisma.$transaction.mockImplementation((fn: any) => fn(mockPrisma));   // resetAllMocks wipes the implementation set at declaration
    const module: TestingModule = await Test.createTestingModule({
      providers: [LegalService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<LegalService>(LegalService);
  });

  describe('getActiveLegalTexts()', () => {
    it('returns active texts filtered by language', async () => {
      const texts = [{ id: 't1', type: 'tos', language: 'tr', isActive: true }];
      mockPrisma.legalText.findMany.mockResolvedValue(texts);
      const result = await service.getActiveLegalTexts('tr');
      expect(result).toEqual(texts);
      expect(mockPrisma.legalText.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ language: 'tr', isActive: true }) }),
      );
    });
  });

  describe('acceptLegal()', () => {
    it('creates acceptance record', async () => {
      const text = { id: 'lt1', type: 'tos', isActive: true };
      const acceptance = { id: 'acc1', userId: 'u1', legalTextId: 'lt1' };
      mockPrisma.legalText.findUnique.mockResolvedValue(text);
      mockPrisma.legalAcceptance.create.mockResolvedValue(acceptance);
      const dto: any = { legalTextId: 'lt1' };
      const result = await service.acceptLegal('u1', dto, '1.2.3.4');
      expect(result).toEqual(acceptance);
      expect(mockPrisma.legalAcceptance.create).toHaveBeenCalled();
    });

    it('throws NotFoundException when legal text not found', async () => {
      mockPrisma.legalText.findUnique.mockResolvedValue(null);
      await expect(service.acceptLegal('u1', { legalTextId: 'bad' } as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('hasUserAccepted()', () => {
    it('returns true when acceptance exists', async () => {
      mockPrisma.legalAcceptance.count.mockResolvedValue(1);
      await expect(service.hasUserAccepted('u1', 'lt1')).resolves.toBe(true);
    });

    it('returns false when no acceptance', async () => {
      mockPrisma.legalAcceptance.count.mockResolvedValue(0);
      await expect(service.hasUserAccepted('u1', 'lt1')).resolves.toBe(false);
    });
  });

  describe('createPrivacyRequest()', () => {
    it('creates request when no pending request exists', async () => {
      mockPrisma.privacyRequest.findFirst.mockResolvedValue(null);
      const created = { id: 'pr1', userId: 'u1', type: 'export', status: 'pending' };
      mockPrisma.privacyRequest.create.mockResolvedValue(created);
      const result = await service.createPrivacyRequest('u1', 'export' as any);
      expect(result).toEqual(created);
    });

    it('throws BadRequestException when pending request already exists', async () => {
      mockPrisma.privacyRequest.findFirst.mockResolvedValue({ id: 'existing', status: 'pending' });
      await expect(service.createPrivacyRequest('u1', 'export' as any)).rejects.toThrow(BadRequestException);
    });
  });

  describe('publishLegalText()', () => {
    it('deactivates others of same type+language and activates the target', async () => {
      const text = { id: 'lt2', type: 'privacy', language: 'en' };
      mockPrisma.legalText.findUnique.mockResolvedValue(text);
      mockPrisma.legalText.updateMany.mockResolvedValue({ count: 2 });
      const published = { ...text, isActive: true, publishedAt: new Date() };
      mockPrisma.legalText.update.mockResolvedValue(published);
      const result = await service.publishLegalText('lt2');
      expect(mockPrisma.legalText.updateMany).toHaveBeenCalled();
      expect(result.isActive).toBe(true);
    });
  });
});
