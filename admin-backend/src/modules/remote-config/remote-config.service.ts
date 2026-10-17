import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateFeatureFlagDto } from './dto/create-feature-flag.dto';
import { CreateAbTestDto } from './dto/create-ab-test.dto';
import { UpsertRemoteConfigDto } from './dto/upsert-config.dto';

function hashString(s: string): number {
  let hash = 5381;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash + s.charCodeAt(i)) >>> 0;
  }
  // murmur3 finaliser: plain DJB2 puts sequential ids (user-0..user-99) into one bucket (measured: 100 of 100 in the same variant)
  hash ^= hash >>> 16; hash = Math.imul(hash, 0x85ebca6b) >>> 0; hash ^= hash >>> 13; hash = Math.imul(hash, 0xc2b2ae35) >>> 0; hash ^= hash >>> 16;
  return hash >>> 0;
}

@Injectable()
export class RemoteConfigService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────
  // Feature Flags
  // ─────────────────────────────────────────────

  async getFeatureFlags() {
    return this.prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });
  }

  async getFeatureFlag(key: string) {
    const flag = await this.prisma.featureFlag.findUnique({ where: { key } });
    if (!flag) throw new NotFoundException(`FeatureFlag "${key}" not found`);
    return flag;
  }

  async createFeatureFlag(dto: CreateFeatureFlagDto) {
    return this.prisma.featureFlag.create({
      data: {
        key:         dto.key,
        value:       dto.value ?? false,
        description: dto.description,
        updatedBy:   dto.updatedBy,
      },
    });
  }

  async updateFeatureFlag(key: string, dto: Partial<CreateFeatureFlagDto>) {
    await this.getFeatureFlag(key);
    return this.prisma.featureFlag.update({
      where: { key },
      data: {
        ...(dto.value !== undefined && { value: dto.value }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.updatedBy !== undefined && { updatedBy: dto.updatedBy }),
      },
    });
  }

  async deleteFeatureFlag(key: string) {
    await this.getFeatureFlag(key);
    return this.prisma.featureFlag.delete({ where: { key } });
  }

  async isEnabled(key: string): Promise<boolean> {
    const flag = await this.prisma.featureFlag.findUnique({ where: { key } });
    return flag?.value ?? false;
  }

  // ─────────────────────────────────────────────
  // A/B Tests
  // ─────────────────────────────────────────────

  async getAbTests(activeOnly?: boolean) {
    const where = activeOnly ? { status: 'active' } : {};
    return this.prisma.abTest.findMany({ where, orderBy: { createdAt: 'desc' } });
  }

  async getAbTest(name: string) {
    const test = await this.prisma.abTest.findUnique({ where: { name } });
    if (!test) throw new NotFoundException(`AbTest "${name}" not found`);
    return test;
  }

  async createAbTest(dto: CreateAbTestDto) {
    return this.prisma.abTest.create({
      data: {
        name:      dto.name,
        description: dto.description,
        variants:  dto.variants as any,
        targetPct: dto.targetPct ?? 0.1,
        metric:    dto.metric,
        status:    'draft',
        startAt:   dto.startAt,
        endAt:     dto.endAt,
      },
    });
  }

  async updateAbTest(name: string, data: Partial<CreateAbTestDto> & { status?: string; result?: any }) {
    await this.getAbTest(name);
    return this.prisma.abTest.update({ where: { name }, data: data as any });
  }

  async getVariantForUser(name: string, userId: string): Promise<string | null> {
    const test = await this.getAbTest(name);
    if (test.status !== 'active') return null;

    const variants = test.variants as Array<{ variantId: string; weight: number }>;
    if (!variants || variants.length === 0) return null;

    const bucket = (hashString(`${name}:${userId}`) % 10000) / 10000;

    let cumulative = 0;
    for (const variant of variants) {
      cumulative += variant.weight;
      if (bucket < cumulative) return variant.variantId;
    }

    return variants[variants.length - 1].variantId;
  }

  // ─────────────────────────────────────────────
  // Remote Config
  // ─────────────────────────────────────────────

  async getConfigs(environment?: string) {
    const where: any = {};
    if (environment) where.environment = environment;
    return this.prisma.remoteConfig.findMany({ where, orderBy: { key: 'asc' } });
  }

  async getConfig(key: string) {
    const config = await this.prisma.remoteConfig.findUnique({ where: { key } });
    if (!config) throw new NotFoundException(`RemoteConfig "${key}" not found`);
    return config;
  }

  async upsertConfig(dto: UpsertRemoteConfigDto) {
    return this.prisma.remoteConfig.upsert({
      where: { key: dto.key },
      create: {
        key:         dto.key,
        value:       dto.value,
        environment: dto.environment ?? 'production',
        description: dto.description,
        updatedBy:   dto.updatedBy,
      },
      update: {
        value:       dto.value,
        environment: dto.environment ?? 'production',
        description: dto.description,
        updatedBy:   dto.updatedBy,
      },
    });
  }

  async deleteConfig(id: string) {
    return this.prisma.remoteConfig.delete({ where: { id } });
  }

  // ─────────────────────────────────────────────
  // System Settings
  // ─────────────────────────────────────────────

  async getSettings() {
    return this.prisma.systemSetting.findMany({ orderBy: { key: 'asc' } });
  }

  async getSetting(key: string) {
    return this.prisma.systemSetting.findUnique({ where: { key } });
  }

  async setSetting(key: string, value: any, updatedBy?: string) {
    return this.prisma.systemSetting.upsert({
      where:  { key },
      create: { key, value, updatedBy },
      update: { value, updatedBy },
    });
  }

  async deleteSetting(key: string) {
    return this.prisma.systemSetting.delete({ where: { key } });
  }

  // ─────────────────────────────────────────────
  // Client Startup Bundle
  // ─────────────────────────────────────────────

  async getClientConfig(environment = 'production') {
    const [configs, flags] = await Promise.all([
      this.prisma.remoteConfig.findMany({ where: { environment } }),
      this.prisma.featureFlag.findMany({ where: { value: true } }),
    ]);

    const configMap: Record<string, any> = {};
    for (const c of configs) configMap[c.key] = c.value;

    const flagMap: Record<string, boolean> = {};
    for (const f of flags) flagMap[f.key] = true;

    return { configs: configMap, flags: flagMap, environment };
  }
}
