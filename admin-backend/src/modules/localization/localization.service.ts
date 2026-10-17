import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UpsertLocalizationKeyDto } from './dto/upsert-localization-key.dto';
import { LocalizationRecordDto } from './dto/import-batch.dto';

/**
 * Implements localization management as described in the admin-backend spec.
 *
 * Schema note: the design doc uses "locale" as a parameter name throughout, but
 * the LocalizationKey model in schema.prisma stores the same concept in the
 * "language" column. All internal DB calls use "language"; the public API surface
 * accepts "locale" via DTOs and translates transparently here.
 */
@Injectable()
export class LocalizationService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // getKeys — paginated list with optional full-text search on key / value
  // ---------------------------------------------------------------------------
  async getKeys(
    locale: string,
    page: number,
    limit: number,
    search?: string,
  ) {
    const skip = (page - 1) * limit;

    const where = {
      language: locale,
      ...(search
        ? {
            OR: [
              { key: { contains: search, mode: 'insensitive' as const } },
              { value: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.localizationKey.findMany({
        where,
        skip,
        take: limit,
        orderBy: { key: 'asc' },
      }),
      this.prisma.localizationKey.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ---------------------------------------------------------------------------
  // getKey — single record by key + locale
  // ---------------------------------------------------------------------------
  async getKey(key: string, locale: string) {
    const record = await this.prisma.localizationKey.findUnique({
      where: { key_language: { key, language: locale } },
    });

    if (!record) {
      throw new NotFoundException(
        `Localization key "${key}" not found for locale "${locale}"`,
      );
    }

    return record;
  }

  // ---------------------------------------------------------------------------
  // upsertKey — create or update a key+locale pair
  // ---------------------------------------------------------------------------
  async upsertKey(dto: UpsertLocalizationKeyDto) {
    const { key, locale, value, namespace } = dto;

    return this.prisma.localizationKey.upsert({
      where: { key_language: { key, language: locale } },
      create: {
        key,
        language: locale,
        value,
        namespace: namespace ?? 'game',
      },
      update: {
        value,
        ...(namespace !== undefined ? { namespace } : {}),
        version: { increment: 1 },
      },
    });
  }

  // ---------------------------------------------------------------------------
  // deleteKey — delete one locale entry, or all locales for a key
  // ---------------------------------------------------------------------------
  async deleteKey(key: string, locale?: string) {
    if (locale) {
      // Verify it exists before deleting so we can surface a 404
      await this.getKey(key, locale);

      await this.prisma.localizationKey.delete({
        where: { key_language: { key, language: locale } },
      });

      return { deleted: 1 };
    }

    // No locale specified — remove all language variants
    const { count } = await this.prisma.localizationKey.deleteMany({
      where: { key },
    });

    if (count === 0) {
      throw new NotFoundException(`No localization entries found for key "${key}"`);
    }

    return { deleted: count };
  }

  // ---------------------------------------------------------------------------
  // getSupportedLocales — distinct language values in the DB
  // ---------------------------------------------------------------------------
  async getSupportedLocales(): Promise<string[]> {
    const rows = await this.prisma.localizationKey.findMany({
      distinct: ['language'],
      select: { language: true },
      orderBy: { language: 'asc' },
    });

    return rows.map((r) => r.language);
  }

  // ---------------------------------------------------------------------------
  // importBatch — bulk upsert for a given locale
  // ---------------------------------------------------------------------------
  async importBatch(locale: string, records: LocalizationRecordDto[]) {
    let upserted = 0;

    // Run all upserts inside a single transaction for atomicity
    await this.prisma.$transaction(
      records.map((r) =>
        this.prisma.localizationKey.upsert({
          where: { key_language: { key: r.key, language: locale } },
          create: {
            key: r.key,
            language: locale,
            value: r.value,
            namespace: 'game',
          },
          update: {
            value: r.value,
            version: { increment: 1 },
          },
        }),
      ),
    );

    upserted = records.length;

    return { locale, upserted };
  }

  // ---------------------------------------------------------------------------
  // exportLocale — all key-value pairs for a locale as a flat object
  // ---------------------------------------------------------------------------
  async exportLocale(locale: string): Promise<Record<string, string>> {
    const rows = await this.prisma.localizationKey.findMany({
      where: { language: locale },
      select: { key: true, value: true },
      orderBy: { key: 'asc' },
    });

    return rows.reduce<Record<string, string>>((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});
  }

  // ---------------------------------------------------------------------------
  // getMissingKeys — keys present in referenceLocale but absent in locale
  // ---------------------------------------------------------------------------
  async getMissingKeys(locale: string, referenceLocale: string) {
    const [referenceRows, localeRows] = await this.prisma.$transaction([
      this.prisma.localizationKey.findMany({
        where: { language: referenceLocale },
        select: { key: true },
      }),
      this.prisma.localizationKey.findMany({
        where: { language: locale },
        select: { key: true },
      }),
    ]);

    const localeKeySet = new Set(localeRows.map((r) => r.key));
    const missing = referenceRows
      .map((r) => r.key)
      .filter((k) => !localeKeySet.has(k));

    return {
      locale,
      referenceLocale,
      missingCount: missing.length,
      missingKeys: missing,
    };
  }

  // ---------------------------------------------------------------------------
  // getKeyStats — per-locale key count summary
  // ---------------------------------------------------------------------------
  async getKeyStats() {
    const rows = await this.prisma.localizationKey.groupBy({
      by: ['language'],
      _count: { key: true },
      orderBy: { language: 'asc' },
    });

    return rows.map((r) => ({
      locale: r.language,
      keyCount: r._count?.key ?? 0,
    }));
  }
}
