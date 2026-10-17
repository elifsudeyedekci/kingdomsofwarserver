import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { BackupService, TriggerBackupDto, UpdateBackupStatusDto } from './backup.service';
import { PrismaService } from '../../database/prisma.service';

const mockPrisma: any = {
  backup: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
};

describe('BackupService', () => {
  let service: BackupService;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BackupService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<BackupService>(BackupService);
  });

  // ---------------------------------------------------------------------------
  // listBackups
  // ---------------------------------------------------------------------------
  describe('listBackups()', () => {
    it('returns paginated result with default page and limit', async () => {
      const fakeItems = [{ id: 'b1' }, { id: 'b2' }];
      mockPrisma.backup.findMany.mockResolvedValue(fakeItems);
      mockPrisma.backup.count.mockResolvedValue(2);

      const result = await service.listBackups();

      expect(mockPrisma.backup.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 20,
        orderBy: { startedAt: 'desc' },
      });
      expect(result).toEqual({ items: fakeItems, total: 2, page: 1, limit: 20 });
    });

    it('applies correct skip for custom page and limit', async () => {
      mockPrisma.backup.findMany.mockResolvedValue([]);
      mockPrisma.backup.count.mockResolvedValue(100);

      const result = await service.listBackups(3, 10);

      expect(mockPrisma.backup.findMany).toHaveBeenCalledWith({
        skip: 20,
        take: 10,
        orderBy: { startedAt: 'desc' },
      });
      expect(result).toEqual({ items: [], total: 100, page: 3, limit: 10 });
    });

    it('returns empty items and zero total when no backups exist', async () => {
      mockPrisma.backup.findMany.mockResolvedValue([]);
      mockPrisma.backup.count.mockResolvedValue(0);

      const result = await service.listBackups();

      expect(result).toEqual({ items: [], total: 0, page: 1, limit: 20 });
    });
  });

  // ---------------------------------------------------------------------------
  // getBackupById
  // ---------------------------------------------------------------------------
  describe('getBackupById()', () => {
    it('returns the backup when found', async () => {
      const fakeBackup = { id: 'abc', type: 'full', status: 'pending' };
      mockPrisma.backup.findUnique.mockResolvedValue(fakeBackup);

      const result = await service.getBackupById('abc');

      expect(mockPrisma.backup.findUnique).toHaveBeenCalledWith({ where: { id: 'abc' } });
      expect(result).toEqual(fakeBackup);
    });

    it('throws NotFoundException when backup is not found', async () => {
      mockPrisma.backup.findUnique.mockResolvedValue(null);

      await expect(service.getBackupById('missing')).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // triggerBackup
  // ---------------------------------------------------------------------------
  describe('triggerBackup()', () => {
    it('creates a backup record with the provided createdBy', async () => {
      const dto: TriggerBackupDto = { type: 'full' };
      const fakeRecord = { id: 'new1', type: 'full', status: 'pending', createdBy: 'admin' };
      mockPrisma.backup.create.mockResolvedValue(fakeRecord);

      const result = await service.triggerBackup(dto, 'admin');

      expect(mockPrisma.backup.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'full',
            status: 'pending',
            createdBy: 'admin',
          }),
        }),
      );
      expect(result).toEqual(fakeRecord);
    });

    it('creates a backup record with createdBy null when omitted', async () => {
      const dto: TriggerBackupDto = { type: 'incremental' };
      const fakeRecord = { id: 'new2', type: 'incremental', status: 'pending', createdBy: null };
      mockPrisma.backup.create.mockResolvedValue(fakeRecord);

      const result = await service.triggerBackup(dto);

      expect(mockPrisma.backup.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            createdBy: null,
          }),
        }),
      );
      expect(result).toEqual(fakeRecord);
    });
  });

  // ---------------------------------------------------------------------------
  // updateBackupStatus
  // ---------------------------------------------------------------------------
  describe('updateBackupStatus()', () => {
    const existingBackup = { id: 'b1', type: 'full', status: 'pending' };

    beforeEach(() => {
      mockPrisma.backup.findUnique.mockResolvedValue(existingBackup);
    });

    it('sets completedAt when transitioning to completed', async () => {
      const dto: UpdateBackupStatusDto = { status: 'completed' };
      mockPrisma.backup.update.mockResolvedValue({ ...existingBackup, status: 'completed' });

      await service.updateBackupStatus('b1', dto);

      expect(mockPrisma.backup.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'completed',
            completedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('does not set completedAt when transitioning to failed', async () => {
      const dto: UpdateBackupStatusDto = { status: 'failed' };
      mockPrisma.backup.update.mockResolvedValue({ ...existingBackup, status: 'failed' });

      await service.updateBackupStatus('b1', dto);

      const callData = mockPrisma.backup.update.mock.calls[0][0].data;
      expect(callData.completedAt).toBeUndefined();
      expect(callData.status).toBe('failed');
    });

    it('writes filePath, fileSize, checksum, and expiresAt from metadata', async () => {
      const dto: UpdateBackupStatusDto = {
        status: 'completed',
        metadata: {
          filePath: '/backups/b1.tar.gz',
          fileSize: 1024,
          checksum: 'abc123',
          expiresAt: '2030-01-01T00:00:00.000Z',
        },
      };
      mockPrisma.backup.update.mockResolvedValue({});

      await service.updateBackupStatus('b1', dto);

      const callData = mockPrisma.backup.update.mock.calls[0][0].data;
      expect(callData.filePath).toBe('/backups/b1.tar.gz');
      expect(callData.fileSize).toBe(1024);
      expect(callData.checksum).toBe('abc123');
      expect(callData.expiresAt).toEqual(new Date('2030-01-01T00:00:00.000Z'));
    });

    it('omits metadata fields that are undefined', async () => {
      const dto: UpdateBackupStatusDto = {
        status: 'completed',
        metadata: { filePath: '/backups/b1.tar.gz' },
      };
      mockPrisma.backup.update.mockResolvedValue({});

      await service.updateBackupStatus('b1', dto);

      const callData = mockPrisma.backup.update.mock.calls[0][0].data;
      expect(callData.filePath).toBe('/backups/b1.tar.gz');
      expect(callData.fileSize).toBeUndefined();
      expect(callData.checksum).toBeUndefined();
      expect(callData.expiresAt).toBeUndefined();
    });

    it('throws NotFoundException when backup does not exist', async () => {
      mockPrisma.backup.findUnique.mockResolvedValue(null);
      const dto: UpdateBackupStatusDto = { status: 'completed' };

      await expect(service.updateBackupStatus('missing', dto)).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // deleteBackup
  // ---------------------------------------------------------------------------
  describe('deleteBackup()', () => {
    it('deletes the backup and returns { deleted: true, id }', async () => {
      mockPrisma.backup.findUnique.mockResolvedValue({ id: 'b1' });
      mockPrisma.backup.delete.mockResolvedValue({ id: 'b1' });

      const result = await service.deleteBackup('b1');

      expect(mockPrisma.backup.delete).toHaveBeenCalledWith({ where: { id: 'b1' } });
      expect(result).toEqual({ deleted: true, id: 'b1' });
    });

    it('throws NotFoundException when backup does not exist', async () => {
      mockPrisma.backup.findUnique.mockResolvedValue(null);

      await expect(service.deleteBackup('ghost')).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // getBackupStats
  // ---------------------------------------------------------------------------
  describe('getBackupStats()', () => {
    it('computes total, completed, failed, pending, and successRate correctly', async () => {
      // total=10, completed=8, failed=2, pending=0
      mockPrisma.backup.count
        .mockResolvedValueOnce(10)  // total
        .mockResolvedValueOnce(8)   // completed
        .mockResolvedValueOnce(2);  // failed
      const lastBackup = { startedAt: new Date('2025-01-01'), status: 'completed', type: 'full' };
      mockPrisma.backup.findFirst.mockResolvedValue(lastBackup);

      const result = await service.getBackupStats();

      expect(result.total).toBe(10);
      expect(result.completed).toBe(8);
      expect(result.failed).toBe(2);
      expect(result.pending).toBe(0);
      // 8 / (8+2) = 0.80 → 80.00
      expect(result.successRate).toBe(80);
      expect(result.lastBackup).toEqual(lastBackup);
    });

    it('returns successRate null when there are no finished backups', async () => {
      mockPrisma.backup.count
        .mockResolvedValueOnce(3)  // total (all pending)
        .mockResolvedValueOnce(0)  // completed
        .mockResolvedValueOnce(0); // failed
      const lastBackup = { startedAt: new Date(), status: 'pending', type: 'incremental' };
      mockPrisma.backup.findFirst.mockResolvedValue(lastBackup);

      const result = await service.getBackupStats();

      expect(result.successRate).toBeNull();
      expect(result.pending).toBe(3);
    });

    it('returns lastBackup null when no backup records exist', async () => {
      mockPrisma.backup.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      mockPrisma.backup.findFirst.mockResolvedValue(null);

      const result = await service.getBackupStats();

      expect(result.lastBackup).toBeNull();
      expect(result.total).toBe(0);
      expect(result.successRate).toBeNull();
    });
  });
});
