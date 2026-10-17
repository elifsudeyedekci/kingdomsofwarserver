import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateCivilizationDto } from './dto/create-civilization.dto';
import { CreateUnitDto } from './dto/create-unit.dto';
import { CreateGameMapDto } from './dto/create-map.dto';

// ---------------------------------------------------------------------------
// Helper types
// ---------------------------------------------------------------------------

/** Filter options for list queries that support civId + age. */
interface ContentFilter {
  civId?: string;
  age?: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * MasterDataService
 *
 * Provides CRUD operations for all game master-data entities:
 * civilizations, units, buildings, technologies, maps, landmarks,
 * balance configs, and version management.
 *
 * All entities follow the flat `{ id, nameKey, data, version, status }`
 * pattern from the Prisma schema — rich fields are stored inside `data`.
 */
@Injectable()
export class MasterDataService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Civilizations
  // ─────────────────────────────────────────────────────────────────────────

  /** Returns all civilization records ordered by primary key. */
  getCivilizations() {
    return this.prisma.civilization.findMany({ orderBy: { id: 'asc' } });
  }

  /** Returns one civilization by its stable string id. Throws if not found. */
  async getCivilization(civId: string) {
    const civ = await this.prisma.civilization.findUnique({ where: { id: civId } });
    if (!civ) throw new NotFoundException(`Civilization '${civId}' not found`);
    return civ;
  }

  /** Creates a new civilization. The civId becomes the primary key. */
  createCivilization(dto: CreateCivilizationDto) {
    return this.prisma.civilization.create({
      data: {
        id: dto.civId,
        nameKey: dto.nameKey,
        data: dto.data as object,
      },
    });
  }

  /** Partially updates a civilization's nameKey and/or data blob. */
  async updateCivilization(civId: string, data: Partial<Pick<CreateCivilizationDto, 'nameKey' | 'data'>>) {
    await this.getCivilization(civId); // throws NotFoundException if absent
    return this.prisma.civilization.update({
      where: { id: civId },
      data: {
        ...(data.nameKey !== undefined && { nameKey: data.nameKey }),
        ...(data.data !== undefined && { data: data.data as object }),
        version: { increment: 1 },
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Units
  // ─────────────────────────────────────────────────────────────────────────

  /** Returns units, optionally filtered by civId and/or age tier. */
  getUnits(filter: ContentFilter = {}) {
    const where: Record<string, unknown> = {};
    if (filter.civId) where.civId = filter.civId;
    return this.prisma.unit.findMany({ where, orderBy: { id: 'asc' } });
  }

  /** Returns one unit by its stable string id. Throws if not found. */
  async getUnit(unitId: string) {
    const unit = await this.prisma.unit.findUnique({ where: { id: unitId } });
    if (!unit) throw new NotFoundException(`Unit '${unitId}' not found`);
    return unit;
  }

  /** Creates a new unit. The unitId becomes the primary key. */
  createUnit(dto: CreateUnitDto) {
    return this.prisma.unit.create({
      data: {
        id: dto.unitId,
        nameKey: dto.nameKey,
        civId: dto.civId ?? null,
        data: dto.data as object,
      },
    });
  }

  /** Partially updates a unit's nameKey and/or data blob. */
  async updateUnit(unitId: string, data: Partial<Pick<CreateUnitDto, 'nameKey' | 'data'>>) {
    await this.getUnit(unitId);
    return this.prisma.unit.update({
      where: { id: unitId },
      data: {
        ...(data.nameKey !== undefined && { nameKey: data.nameKey }),
        ...(data.data !== undefined && { data: data.data as object }),
        version: { increment: 1 },
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Buildings
  // ─────────────────────────────────────────────────────────────────────────

  /** Returns buildings, optionally filtered by civId and/or age tier. */
  getBuildings(filter: ContentFilter = {}) {
    const where: Record<string, unknown> = {};
    if (filter.civId) where.civId = filter.civId;
    return this.prisma.building.findMany({ where, orderBy: { id: 'asc' } });
  }

  /** Returns one building by its stable string id. Throws if not found. */
  async getBuilding(buildingId: string) {
    const building = await this.prisma.building.findUnique({ where: { id: buildingId } });
    if (!building) throw new NotFoundException(`Building '${buildingId}' not found`);
    return building;
  }

  /** Creates a new building. The buildingId becomes the primary key. */
  createBuilding(dto: { buildingId: string; nameKey: string; civId?: string; data: Record<string, unknown> }) {
    return this.prisma.building.create({
      data: {
        id: dto.buildingId,
        nameKey: dto.nameKey,
        civId: dto.civId ?? null,
        data: dto.data as object,
      },
    });
  }

  /** Partially updates a building's nameKey and/or data blob. */
  async updateBuilding(buildingId: string, data: { nameKey?: string; data?: Record<string, unknown> }) {
    await this.getBuilding(buildingId);
    return this.prisma.building.update({
      where: { id: buildingId },
      data: {
        ...(data.nameKey !== undefined && { nameKey: data.nameKey }),
        ...(data.data !== undefined && { data: data.data as object }),
        version: { increment: 1 },
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Technologies
  // ─────────────────────────────────────────────────────────────────────────

  /** Returns technologies, optionally filtered by civId and/or age tier. */
  getTechnologies(filter: ContentFilter = {}) {
    const where: Record<string, unknown> = {};
    if (filter.civId) where.civId = filter.civId;
    return this.prisma.technology.findMany({ where, orderBy: { id: 'asc' } });
  }

  /** Returns one technology by its stable string id. Throws if not found. */
  async getTechnology(techId: string) {
    const tech = await this.prisma.technology.findUnique({ where: { id: techId } });
    if (!tech) throw new NotFoundException(`Technology '${techId}' not found`);
    return tech;
  }

  /** Creates a new technology. The techId becomes the primary key. */
  createTechnology(dto: { techId: string; nameKey: string; civId?: string; data: Record<string, unknown> }) {
    return this.prisma.technology.create({
      data: {
        id: dto.techId,
        nameKey: dto.nameKey,
        civId: dto.civId ?? null,
        data: dto.data as object,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Maps
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Returns game maps. Pass `activeOnly = true` to restrict to maps
   * where `data.isActive === true`.
   */
  async getMaps(activeOnly = false) {
    const maps = await this.prisma.gameMap.findMany({ orderBy: { id: 'asc' } });
    if (!activeOnly) return maps;
    return maps.filter((m) => {
      const d = m.data as Record<string, unknown>;
      return d?.isActive === true;
    });
  }

  /** Returns one map by its stable string id. Throws if not found. */
  async getMap(mapId: string) {
    const map = await this.prisma.gameMap.findUnique({ where: { id: mapId } });
    if (!map) throw new NotFoundException(`Map '${mapId}' not found`);
    return map;
  }

  /** Creates a new game map. The mapId becomes the primary key. */
  createMap(dto: CreateGameMapDto) {
    return this.prisma.gameMap.create({
      data: {
        id: dto.mapId,
        nameKey: dto.nameKey,
        data: dto.data as object,
      },
    });
  }

  /**
   * Partially updates a map's nameKey and/or data blob.
   * Pass `{ isActive: true/false }` inside `data` to toggle active state.
   */
  async updateMap(mapId: string, data: { nameKey?: string; data?: Record<string, unknown> }) {
    await this.getMap(mapId);
    return this.prisma.gameMap.update({
      where: { id: mapId },
      data: {
        ...(data.nameKey !== undefined && { nameKey: data.nameKey }),
        ...(data.data !== undefined && { data: data.data as object }),
        version: { increment: 1 },
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Landmarks
  // ─────────────────────────────────────────────────────────────────────────

  /** Returns landmarks, optionally filtered by civId. */
  getLandmarks(civId?: string) {
    return this.prisma.landmark.findMany({
      where: civId ? { civId } : undefined,
      orderBy: { id: 'asc' },
    });
  }

  /** Creates a new landmark. The landmarkId becomes the primary key. */
  createLandmark(dto: { landmarkId: string; nameKey: string; civId?: string; ageRequired?: number; data: Record<string, unknown> }) {
    return this.prisma.landmark.create({
      data: {
        id: dto.landmarkId,
        nameKey: dto.nameKey,
        civId: dto.civId ?? null,
        ageRequired: dto.ageRequired ?? 1,
        data: dto.data as object,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Balance Config
  // ─────────────────────────────────────────────────────────────────────────

  /** Returns all balance config entries ordered by key. */
  getAllBalanceConfigs() {
    return this.prisma.balanceConfig.findMany({ orderBy: { configKey: 'asc' } });
  }

  /** Returns one balance config by its unique key. Throws if not found. */
  async getBalanceConfig(configKey: string) {
    const config = await this.prisma.balanceConfig.findUnique({ where: { configKey } });
    if (!config) throw new NotFoundException(`BalanceConfig '${configKey}' not found`);
    return config;
  }

  /**
   * Upserts a balance config entry.
   * On update, the version counter is incremented automatically.
   */
  setBalanceConfig(configKey: string, value: unknown, updatedBy?: string) {
    return this.prisma.balanceConfig.upsert({
      where: { configKey },
      create: {
        configKey,
        value: value as object,
        version: 1,
        updatedBy: updatedBy ?? null,
      },
      update: {
        value: value as object,
        version: { increment: 1 },
        updatedBy: updatedBy ?? null,
      },
    });
  }

  /**
   * Returns the current (active) balance config entry for the given key,
   * including its version field.
   * Kept as a separate method so callers can distinguish "current state"
   * from a future history log without changing the public API.
   */
  async getBalanceConfigHistory(configKey: string) {
    return this.getBalanceConfig(configKey);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Master Data Versions
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Returns all master data versions ordered by creation time descending.
   * The Prisma `MasterDataVersion` model uses `dataType + version` as a
   * composite unique key.
   */
  getVersions() {
    return this.prisma.masterDataVersion.findMany({
      orderBy: { publishedAt: 'desc' },
    });
  }

  /**
   * Marks the given MasterDataVersion record as published by setting
   * `publishedAt` and `publishedBy`. This does NOT mark others as inactive
   * because the schema's `MasterDataVersion` has no `isActive` column —
   * the composite key `(dataType, version)` is the canonical reference.
   */
  async publishVersion(id: string, publishedBy: string) {
    const record = await this.prisma.masterDataVersion.findUnique({ where: { id } });
    if (!record) throw new NotFoundException(`MasterDataVersion '${id}' not found`);
    return this.prisma.masterDataVersion.update({
      where: { id },
      data: {
        publishedAt: new Date(),
        publishedBy,
      },
    });
  }
}
