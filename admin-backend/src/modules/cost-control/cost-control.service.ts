import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UpdateCostDto } from './dto/update-cost.dto';
import { CostSimulationDto } from './dto/cost-simulation.dto';

/** Shape returned by getEconomySnapshot. */
export interface EconomySnapshot {
  unitCosts: Record<string, unknown>[];
  buildingCosts: Record<string, unknown>[];
  techCosts: Record<string, unknown>[];
  resourceRates: Record<string, unknown>[];
}

/** Single simulation result entry. */
export interface SimulatedCostEntry {
  configKey: string;
  original: unknown;
  simulated: unknown;
}

/** Full simulation report returned by simulateCostChange. */
export interface SimulationReport {
  civId: string;
  age: number;
  resourceMultiplier: number;
  affectedConfigs: SimulatedCostEntry[];
  summary: string;
}

/** Thin history record — BalanceConfig keeps only the latest row per key. */
export interface CostHistoryRecord {
  configKey: string;
  version: number;
  updatedAt: Date;
  updatedBy: string | null;
}

const COST_PREFIX = 'cost.';

/** Prefix buckets used for economy snapshot categorisation. */
const SNAPSHOT_BUCKETS: Record<keyof EconomySnapshot, string> = {
  unitCosts: 'cost.unit.',
  buildingCosts: 'cost.building.',
  techCosts: 'cost.tech.',
  resourceRates: 'cost.resource.',
};

/**
 * Handles all read/write operations for game economy cost configuration.
 * Uses the shared BalanceConfig table with keys prefixed "cost.".
 */
@Injectable()
export class CostControlService {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns every BalanceConfig row whose key starts with "cost.". */
  async getAllCosts() {
    return this.prisma.balanceConfig.findMany({
      where: { configKey: { startsWith: COST_PREFIX } },
      orderBy: { configKey: 'asc' },
    });
  }

  /**
   * Returns a single cost config by key.
   * @throws NotFoundException when the key does not exist.
   */
  async getCost(configKey: string) {
    const record = await this.prisma.balanceConfig.findUnique({
      where: { configKey },
    });
    if (!record) {
      throw new NotFoundException(`Cost config not found: ${configKey}`);
    }
    return record;
  }

  /**
   * Creates or updates a cost config, incrementing the version counter on
   * each update so callers can track revision history numerically.
   */
  async updateCost(dto: UpdateCostDto) {
    const existing = await this.prisma.balanceConfig.findUnique({
      where: { configKey: dto.configKey },
    });

    const nextVersion = existing ? existing.version + 1 : 1;

    return this.prisma.balanceConfig.upsert({
      where: { configKey: dto.configKey },
      update: {
        value: dto.value,
        description: dto.description,
        updatedBy: dto.updatedBy,
        version: nextVersion,
      },
      create: {
        configKey: dto.configKey,
        value: dto.value,
        description: dto.description,
        updatedBy: dto.updatedBy,
        version: 1,
      },
    });
  }

  /**
   * Applies multiple cost updates atomically.
   * All updates succeed or all are rolled back.
   */
  async bulkUpdateCosts(updates: UpdateCostDto[]) {
    return this.prisma.$transaction(async (tx) => {
      const results = [];
      for (const dto of updates) {
        const existing = await tx.balanceConfig.findUnique({
          where: { configKey: dto.configKey },
        });
        const nextVersion = existing ? existing.version + 1 : 1;
        results.push(
          await tx.balanceConfig.upsert({
            where: { configKey: dto.configKey },
            update: {
              value: dto.value,
              description: dto.description,
              updatedBy: dto.updatedBy,
              version: nextVersion,
            },
            create: {
              configKey: dto.configKey,
              value: dto.value,
              description: dto.description,
              updatedBy: dto.updatedBy,
              version: 1,
            },
          }),
        );
      }
      return results;
    });
  }

  /**
   * Returns a structured snapshot of the economy, grouping configs by
   * category prefix (unit / building / tech / resource).
   */
  async getEconomySnapshot(): Promise<EconomySnapshot> {
    const allCosts = await this.prisma.balanceConfig.findMany({
      where: { configKey: { startsWith: COST_PREFIX } },
      orderBy: { configKey: 'asc' },
    });

    const snapshot: EconomySnapshot = {
      unitCosts: [],
      buildingCosts: [],
      techCosts: [],
      resourceRates: [],
    };

    for (const record of allCosts) {
      for (const [bucket, prefix] of Object.entries(SNAPSHOT_BUCKETS) as [
        keyof EconomySnapshot,
        string,
      ][]) {
        if (record.configKey.startsWith(prefix)) {
          snapshot[bucket].push(record as Record<string, unknown>);
          break;
        }
      }
    }

    return snapshot;
  }

  /**
   * Simulates multiplying all cost configs matching the given civId and age
   * without persisting any changes. Returns the projected values alongside
   * the originals so callers can preview the economic impact.
   */
  async simulateCostChange(dto: CostSimulationDto): Promise<SimulationReport> {
    const scopePrefix = `${COST_PREFIX}${dto.civId}.age${dto.age}.`;

    const matchingConfigs = await this.prisma.balanceConfig.findMany({
      where: { configKey: { startsWith: scopePrefix } },
      orderBy: { configKey: 'asc' },
    });

    const affectedConfigs: SimulatedCostEntry[] = matchingConfigs.map(
      (config) => {
        const simulated = this.applyMultiplier(
          config.value,
          dto.resourceMultiplier,
        );
        return {
          configKey: config.configKey,
          original: config.value,
          simulated,
        };
      },
    );

    const summary =
      affectedConfigs.length === 0
        ? `No cost configs found for civ "${dto.civId}" at age ${dto.age}. No changes projected.`
        : `Applying ×${dto.resourceMultiplier} to ${affectedConfigs.length} config(s) for civ "${dto.civId}" age ${dto.age}. No data was written.`;

    return {
      civId: dto.civId,
      age: dto.age,
      resourceMultiplier: dto.resourceMultiplier,
      affectedConfigs,
      summary,
    };
  }

  /**
   * Returns the current version metadata for a single config key.
   * Because BalanceConfig stores only the latest row, this returns the
   * version number and timestamps rather than a full audit trail.
   * @throws NotFoundException when the key does not exist.
   */
  async getCostHistory(configKey: string): Promise<CostHistoryRecord> {
    const record = await this.prisma.balanceConfig.findUnique({
      where: { configKey },
      select: {
        configKey: true,
        version: true,
        updatedAt: true,
        updatedBy: true,
      },
    });
    if (!record) {
      throw new NotFoundException(`Cost config not found: ${configKey}`);
    }
    return record;
  }

  /**
   * Exports all cost configs as a CSV string.
   * Columns: configKey, value, description, version, updatedAt, updatedBy
   */
  async exportCostSheet(): Promise<string> {
    const records = await this.prisma.balanceConfig.findMany({
      where: { configKey: { startsWith: COST_PREFIX } },
      orderBy: { configKey: 'asc' },
    });

    const header = 'configKey,value,description,version,updatedAt,updatedBy';
    const rows = records.map((r) =>
      [
        this.csvEscape(r.configKey),
        this.csvEscape(JSON.stringify(r.value)),
        this.csvEscape(r.description ?? ''),
        String(r.version),
        r.updatedAt.toISOString(),
        this.csvEscape(r.updatedBy ?? ''),
      ].join(','),
    );

    return [header, ...rows].join('\n');
  }

  // ──────────────────────────────────────────────────────────── private helpers

  /**
   * Multiplies numeric leaf values in a JSON payload by the given factor.
   * Objects and arrays are traversed recursively; non-numeric leaves are
   * returned unchanged.
   */
  private applyMultiplier(value: unknown, multiplier: number): unknown {
    if (typeof value === 'number') {
      return Math.round(value * multiplier);
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.applyMultiplier(item, multiplier));
    }
    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([k, v]) => [
          k,
          this.applyMultiplier(v, multiplier),
        ]),
      );
    }
    return value;
  }

  /** Wraps a string in double-quotes and escapes embedded double-quotes. */
  private csvEscape(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
