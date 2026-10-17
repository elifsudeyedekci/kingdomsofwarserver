import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { LocalizationService } from './localization.service';
import { PrismaService } from '../../database/prisma.service';

const mockPrisma: any = {
  localizationKey: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    groupBy: jest.fn(),
  },
  $transaction: jest.fn(),
};

const LOCALE_EN = 'en';
const LOCALE_TR = 'tr';

const enRecord = {
  id: 'key-uuid-1',
  key: 'ui.button.play',
  language: LOCALE_EN,
  value: 'Play',
  namespace: 'game',
  version: 1,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const trRecord = { ...enRecord, id: 'key-uuid-2', language: LOCALE_TR, value: 'Oyna' };

describe('LocalizationService', () => {
  let service: LocalizationService;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocalizationService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<LocalizationService>(LocalizationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getKeys()', () => {
    it('returns paginated keys for a locale', async () => {
      mockPrisma.$transaction.mockResolvedValue([[enRecord], 1]);

      const result = await service.getKeys(LOCALE_EN, 1, 20);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(result.items[0].language).toBe(LOCALE_EN);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('applies search filter to key and value fields', async () => {
      mockPrisma.$transaction.mockResolvedValue([[enRecord], 1]);

      await service.getKeys(LOCALE_EN, 1, 20, 'button');

      const [[findCall]] = mockPrisma.$transaction.mock.calls;
      void findCall;
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('returns empty result when no keys exist for locale', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      const result = await service.getKeys('fr', 1, 20);

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('getKey()', () => {
    it('returns the key record when found', async () => {
      mockPrisma.localizationKey.findUnique.mockResolvedValue(enRecord);

      const result = await service.getKey('ui.button.play', LOCALE_EN);

      expect(mockPrisma.localizationKey.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key_language: { key: 'ui.button.play', language: LOCALE_EN } },
        }),
      );
      expect(result.value).toBe('Play');
    });

    it('throws NotFoundException when key does not exist for locale', async () => {
      mockPrisma.localizationKey.findUnique.mockResolvedValue(null);

      await expect(service.getKey('nonexistent.key', LOCALE_EN)).rejects.toThrow(NotFoundException);
    });
  });

  describe('upsertKey()', () => {
    it('creates a new key when it does not exist', async () => {
      mockPrisma.localizationKey.upsert.mockResolvedValue(enRecord);

      const result = await service.upsertKey({
        key: 'ui.button.play',
        locale: LOCALE_EN,
        value: 'Play',
      });

      expect(mockPrisma.localizationKey.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key_language: { key: 'ui.button.play', language: LOCALE_EN } },
          create: expect.objectContaining({ key: 'ui.button.play', language: LOCALE_EN, value: 'Play' }),
        }),
      );
      expect(result.value).toBe('Play');
    });

    it('increments version on update', async () => {
      mockPrisma.localizationKey.upsert.mockResolvedValue({ ...enRecord, version: 2 });

      const result = await service.upsertKey({
        key: 'ui.button.play',
        locale: LOCALE_EN,
        value: 'Play Now',
      });

      const upsertCall = mockPrisma.localizationKey.upsert.mock.calls[0][0];
      expect(upsertCall.update).toMatchObject({ version: { increment: 1 } });
      expect(result.version).toBe(2);
    });
  });

  describe('deleteKey()', () => {
    it('deletes a single locale entry when locale is specified', async () => {
      mockPrisma.localizationKey.findUnique.mockResolvedValue(enRecord);
      mockPrisma.localizationKey.delete.mockResolvedValue(enRecord);

      const result = await service.deleteKey('ui.button.play', LOCALE_EN);

      expect(mockPrisma.localizationKey.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key_language: { key: 'ui.button.play', language: LOCALE_EN } },
        }),
      );
      expect(result.deleted).toBe(1);
    });

    it('deletes all locale entries when no locale is specified', async () => {
      mockPrisma.localizationKey.deleteMany.mockResolvedValue({ count: 3 });

      const result = await service.deleteKey('ui.button.play');

      expect(mockPrisma.localizationKey.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { key: 'ui.button.play' } }),
      );
      expect(result.deleted).toBe(3);
    });

    it('throws NotFoundException when deleting all locales but none exist', async () => {
      mockPrisma.localizationKey.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.deleteKey('nonexistent.key')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getSupportedLocales()', () => {
    it('returns sorted distinct locale list', async () => {
      mockPrisma.localizationKey.findMany.mockResolvedValue([
        { language: 'en' },
        { language: 'tr' },
      ]);

      const result = await service.getSupportedLocales();

      expect(result).toEqual(['en', 'tr']);
    });
  });

  describe('importBatch()', () => {
    it('upserts all records and returns count', async () => {
      mockPrisma.$transaction.mockResolvedValue([enRecord, trRecord]);

      const result = await service.importBatch(LOCALE_EN, [
        { key: 'ui.button.play', value: 'Play' },
        { key: 'ui.button.quit', value: 'Quit' },
      ]);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(result.upserted).toBe(2);
      expect(result.locale).toBe(LOCALE_EN);
    });

    it('returns 0 upserted for empty records array', async () => {
      mockPrisma.$transaction.mockResolvedValue([]);

      const result = await service.importBatch(LOCALE_EN, []);

      expect(result.upserted).toBe(0);
    });
  });

  describe('exportLocale()', () => {
    it('returns flat key-value map for the locale', async () => {
      mockPrisma.localizationKey.findMany.mockResolvedValue([
        { key: 'ui.button.play', value: 'Play' },
        { key: 'ui.button.quit', value: 'Quit' },
      ]);

      const result = await service.exportLocale(LOCALE_EN);

      expect(result).toEqual({ 'ui.button.play': 'Play', 'ui.button.quit': 'Quit' });
    });

    it('returns empty object when no keys exist for locale', async () => {
      mockPrisma.localizationKey.findMany.mockResolvedValue([]);

      const result = await service.exportLocale('fr');

      expect(result).toEqual({});
    });
  });

  describe('getMissingKeys()', () => {
    it('returns keys present in reference locale but absent in target locale', async () => {
      mockPrisma.$transaction.mockResolvedValue([
        [{ key: 'ui.button.play' }, { key: 'ui.button.quit' }, { key: 'ui.button.settings' }],
        [{ key: 'ui.button.play' }],
      ]);

      const result = await service.getMissingKeys(LOCALE_TR, LOCALE_EN);

      expect(result.missingKeys).toContain('ui.button.quit');
      expect(result.missingKeys).toContain('ui.button.settings');
      expect(result.missingCount).toBe(2);
    });

    it('returns empty missing list when target locale is complete', async () => {
      mockPrisma.$transaction.mockResolvedValue([
        [{ key: 'ui.button.play' }],
        [{ key: 'ui.button.play' }],
      ]);

      const result = await service.getMissingKeys(LOCALE_TR, LOCALE_EN);

      expect(result.missingCount).toBe(0);
      expect(result.missingKeys).toHaveLength(0);
    });
  });

  describe('getKeyStats()', () => {
    it('returns per-locale key count summary', async () => {
      mockPrisma.localizationKey.groupBy.mockResolvedValue([
        { language: 'en', _count: { key: 150 } },
        { language: 'tr', _count: { key: 120 } },
      ]);

      const result = await service.getKeyStats();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ locale: 'en', keyCount: 150 });
      expect(result[1]).toEqual({ locale: 'tr', keyCount: 120 });
    });
  });
});
