/**
 * Story Type  : Logic (service-layer CRUD and guard clauses)
 * Output      : src/modules/master-data/
 * Gate Level  : BLOCKING
 *
 * Covered methods
 *   getCivilizations()           — returns ordered array
 *   getCivilization(id)          — happy path + NotFoundException
 *   createCivilization(dto)      — correct Prisma data shape
 *   updateCivilization(id, data) — increments version; throws on missing civ
 *   getUnits(filter)             — no-filter and civId-filter paths
 *   getUnit(id)                  — happy path + NotFoundException
 *   createUnit(dto)              — null civId coercion
 *   updateUnit(id, data)         — delegates getUnit guard, increments version
 *   getBuilding(id)              — happy path + NotFoundException
 *   getMaps(activeOnly)          — returns all vs. isActive=true filter
 *   getMap(id)                   — happy path + NotFoundException
 *   getAllBalanceConfigs()        — returns ordered array
 *   getBalanceConfig(key)        — happy path + NotFoundException
 *   setBalanceConfig(key, v, by) — upsert shape (create v=1, update increment)
 *   getBalanceConfigHistory(key) — delegates getBalanceConfig (same result)
 *   getVersions()                — returns desc-ordered array
 *   publishVersion(id, by)       — sets publishedAt; throws on missing id
 *   getLandmarks(civId)          — with and without civId filter
 *   createLandmark(dto)          — default ageRequired=1
 *   getTechnologies(filter)      — civId filter path
 *
 * Mock scope : civilization, unit, building, technology, gameMap,
 *              landmark, balanceConfig, masterDataVersion prisma models.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { MasterDataService } from './master-data.service';
import { PrismaService } from '../../database/prisma.service';

// ---------------------------------------------------------------------------
// Prisma mock — only the models that master-data.service.ts actually uses
// ---------------------------------------------------------------------------

const mockPrisma: any = {
  civilization: {
    findMany:   jest.fn(),
    findUnique: jest.fn(),
    create:     jest.fn(),
    update:     jest.fn(),
  },
  unit: {
    findMany:   jest.fn(),
    findUnique: jest.fn(),
    create:     jest.fn(),
    update:     jest.fn(),
  },
  building: {
    findMany:   jest.fn(),
    findUnique: jest.fn(),
    create:     jest.fn(),
    update:     jest.fn(),
  },
  technology: {
    findMany:   jest.fn(),
    findUnique: jest.fn(),
    create:     jest.fn(),
  },
  gameMap: {
    findMany:   jest.fn(),
    findUnique: jest.fn(),
    create:     jest.fn(),
    update:     jest.fn(),
  },
  landmark: {
    findMany: jest.fn(),
    create:   jest.fn(),
  },
  balanceConfig: {
    findMany:   jest.fn(),
    findUnique: jest.fn(),
    upsert:     jest.fn(),
  },
  masterDataVersion: {
    findMany:   jest.fn(),
    findUnique: jest.fn(),
    update:     jest.fn(),
  },
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = new Date('2026-06-14T00:00:00.000Z');

const civFixture = {
  id: 'english',
  nameKey: 'civ.english.name',
  data: { bonuses: [], uniqueUnits: ['longbowman'] },
  version: 1,
  status: 'draft',
  createdAt: NOW,
  updatedAt: NOW,
};

const unitFixture = {
  id: 'longbowman',
  nameKey: 'unit.longbowman.name',
  civId: 'english',
  data: { baseStats: { hp: 70 }, cost: { food: 60, gold: 20 }, trainTime: 22, age: 2 },
  version: 1,
  status: 'draft',
  createdAt: NOW,
  updatedAt: NOW,
};

const buildingFixture = {
  id: 'barracks',
  nameKey: 'building.barracks.name',
  civId: null,
  data: { hp: 2400, trainableUnits: ['spearman', 'man-at-arms'] },
  version: 1,
  status: 'draft',
  createdAt: NOW,
  updatedAt: NOW,
};

const mapActiveFixture = {
  id: 'arabia',
  nameKey: 'map.arabia.name',
  data: { size: 'large', playerCount: 8, isActive: true },
  version: 1,
  status: 'draft',
  createdAt: NOW,
  updatedAt: NOW,
};

const mapInactiveFixture = {
  id: 'black_forest',
  nameKey: 'map.black_forest.name',
  data: { size: 'large', playerCount: 4, isActive: false },
  version: 1,
  status: 'draft',
  createdAt: NOW,
  updatedAt: NOW,
};

const balanceFixture = {
  id: 'uuid-bal-1',
  configKey: 'unit_damage_multiplier',
  value: { multiplier: 1.0 },
  description: null,
  version: 3,
  updatedAt: NOW,
  updatedBy: 'admin-1',
};

const versionFixture = {
  id: 'uuid-ver-1',
  dataType: 'civilization',
  version: 2,
  publishedAt: null,
  publishedBy: null,
  createdAt: NOW,
};

const landmarkFixture = {
  id: 'white_tower',
  nameKey: 'landmark.white_tower.name',
  civId: 'english',
  ageRequired: 2,
  data: { hp: 3200, bonus: 'production_speed' },
  version: 1,
  createdAt: NOW,
  updatedAt: NOW,
};

const techFixture = {
  id: 'fletching',
  nameKey: 'tech.fletching.name',
  civId: null,
  data: { cost: { food: 100, gold: 75 }, researchTime: 35, age: 2 },
  version: 1,
  status: 'draft',
  createdAt: NOW,
  updatedAt: NOW,
};

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('MasterDataService', () => {
  let service: MasterDataService;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MasterDataService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<MasterDataService>(MasterDataService);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getCivilizations()
  // ─────────────────────────────────────────────────────────────────────────

  describe('getCivilizations()', () => {
    it('normal case — returns array ordered by id asc', async () => {
      // Arrange
      mockPrisma.civilization.findMany.mockResolvedValue([civFixture]);

      // Act
      const result = await service.getCivilizations();

      // Assert
      expect(mockPrisma.civilization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { id: 'asc' } }),
      );
      expect(result).toEqual([civFixture]);
    });

    it('empty table — returns empty array without throwing', async () => {
      // Arrange
      mockPrisma.civilization.findMany.mockResolvedValue([]);

      // Act
      const result = await service.getCivilizations();

      // Assert
      expect(result).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getCivilization()
  // ─────────────────────────────────────────────────────────────────────────

  describe('getCivilization()', () => {
    it('normal case — returns the civilization when found', async () => {
      // Arrange
      mockPrisma.civilization.findUnique.mockResolvedValue(civFixture);

      // Act
      const result = await service.getCivilization('english');

      // Assert
      expect(result).toEqual(civFixture);
      expect(mockPrisma.civilization.findUnique).toHaveBeenCalledWith({
        where: { id: 'english' },
      });
    });

    it('not found — throws NotFoundException with civId in message', async () => {
      // Arrange
      mockPrisma.civilization.findUnique.mockResolvedValue(null);

      // Act + Assert
      await expect(service.getCivilization('unknown-civ')).rejects.toThrow(NotFoundException);
      await expect(service.getCivilization('unknown-civ')).rejects.toThrow(
        "Civilization 'unknown-civ' not found",
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // createCivilization()
  // ─────────────────────────────────────────────────────────────────────────

  describe('createCivilization()', () => {
    it('normal case — passes correct data shape to Prisma create', async () => {
      // Arrange
      mockPrisma.civilization.create.mockResolvedValue(civFixture);
      const dto = {
        civId: 'english',
        nameKey: 'civ.english.name',
        data: { bonuses: [], uniqueUnits: ['longbowman'] },
      };

      // Act
      const result = await service.createCivilization(dto);

      // Assert
      expect(mockPrisma.civilization.create).toHaveBeenCalledWith({
        data: {
          id: 'english',
          nameKey: 'civ.english.name',
          data: dto.data,
        },
      });
      expect(result).toEqual(civFixture);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // updateCivilization()
  // ─────────────────────────────────────────────────────────────────────────

  describe('updateCivilization()', () => {
    it('normal case — calls getCivilization guard then updates with version increment', async () => {
      // Arrange — findUnique is called by the internal getCivilization guard
      mockPrisma.civilization.findUnique.mockResolvedValue(civFixture);
      const updatedFixture = { ...civFixture, nameKey: 'civ.english.v2', version: 2 };
      mockPrisma.civilization.update.mockResolvedValue(updatedFixture);

      // Act
      const result = await service.updateCivilization('english', { nameKey: 'civ.english.v2' });

      // Assert
      expect(mockPrisma.civilization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'english' },
          data: expect.objectContaining({ version: { increment: 1 } }),
        }),
      );
      expect(result).toEqual(updatedFixture);
    });

    it('missing civilization — throws NotFoundException, never calls update', async () => {
      // Arrange
      mockPrisma.civilization.findUnique.mockResolvedValue(null);

      // Act + Assert
      await expect(
        service.updateCivilization('ghost-civ', { nameKey: 'anything' }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.civilization.update).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getUnits()
  // ─────────────────────────────────────────────────────────────────────────

  describe('getUnits()', () => {
    it('no filter — passes empty where clause to Prisma', async () => {
      // Arrange
      mockPrisma.unit.findMany.mockResolvedValue([unitFixture]);

      // Act
      const result = await service.getUnits();

      // Assert
      expect(mockPrisma.unit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
      expect(result).toEqual([unitFixture]);
    });

    it('civId filter — passes civId into where clause', async () => {
      // Arrange
      mockPrisma.unit.findMany.mockResolvedValue([unitFixture]);

      // Act
      await service.getUnits({ civId: 'english' });

      // Assert
      expect(mockPrisma.unit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { civId: 'english' } }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getUnit()
  // ─────────────────────────────────────────────────────────────────────────

  describe('getUnit()', () => {
    it('normal case — returns the unit when found', async () => {
      // Arrange
      mockPrisma.unit.findUnique.mockResolvedValue(unitFixture);

      // Act
      const result = await service.getUnit('longbowman');

      // Assert
      expect(result).toEqual(unitFixture);
    });

    it('not found — throws NotFoundException with unitId in message', async () => {
      // Arrange
      mockPrisma.unit.findUnique.mockResolvedValue(null);

      // Act + Assert
      await expect(service.getUnit('ghost-unit')).rejects.toThrow(NotFoundException);
      await expect(service.getUnit('ghost-unit')).rejects.toThrow("Unit 'ghost-unit' not found");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // createUnit()
  // ─────────────────────────────────────────────────────────────────────────

  describe('createUnit()', () => {
    it('civId present — passes civId through to Prisma create', async () => {
      // Arrange
      mockPrisma.unit.create.mockResolvedValue(unitFixture);
      const dto = {
        unitId: 'longbowman',
        nameKey: 'unit.longbowman.name',
        civId: 'english',
        data: { baseStats: { hp: 70 }, cost: { food: 60, gold: 20 } },
        age: 2,
      };

      // Act
      const result = await service.createUnit(dto);

      // Assert
      expect(mockPrisma.unit.create).toHaveBeenCalledWith({
        data: { id: 'longbowman', nameKey: 'unit.longbowman.name', civId: 'english', data: dto.data },
      });
      expect(result).toEqual(unitFixture);
    });

    it('civId absent — coerces civId to null in Prisma create', async () => {
      // Arrange
      const genericUnit = { ...unitFixture, civId: null };
      mockPrisma.unit.create.mockResolvedValue(genericUnit);
      const dto = { unitId: 'generic-soldier', nameKey: 'unit.generic.name', data: {}, age: 1 };

      // Act
      await service.createUnit(dto);

      // Assert
      const createArg = mockPrisma.unit.create.mock.calls[0][0];
      expect(createArg.data.civId).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // updateUnit()
  // ─────────────────────────────────────────────────────────────────────────

  describe('updateUnit()', () => {
    it('normal case — increments version on the existing unit', async () => {
      // Arrange
      mockPrisma.unit.findUnique.mockResolvedValue(unitFixture);
      mockPrisma.unit.update.mockResolvedValue({ ...unitFixture, version: 2 });

      // Act
      await service.updateUnit('longbowman', { nameKey: 'unit.longbowman.v2' });

      // Assert
      expect(mockPrisma.unit.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'longbowman' },
          data: expect.objectContaining({ version: { increment: 1 } }),
        }),
      );
    });

    it('missing unit — throws NotFoundException, never calls update', async () => {
      // Arrange
      mockPrisma.unit.findUnique.mockResolvedValue(null);

      // Act + Assert
      await expect(service.updateUnit('ghost-unit', {})).rejects.toThrow(NotFoundException);
      expect(mockPrisma.unit.update).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getBuilding() — error path
  // ─────────────────────────────────────────────────────────────────────────

  describe('getBuilding()', () => {
    it('normal case — returns the building when found', async () => {
      // Arrange
      mockPrisma.building.findUnique.mockResolvedValue(buildingFixture);

      // Act
      const result = await service.getBuilding('barracks');

      // Assert
      expect(result).toEqual(buildingFixture);
    });

    it('not found — throws NotFoundException with buildingId in message', async () => {
      // Arrange
      mockPrisma.building.findUnique.mockResolvedValue(null);

      // Act + Assert
      await expect(service.getBuilding('ghost-building')).rejects.toThrow(NotFoundException);
      await expect(service.getBuilding('ghost-building')).rejects.toThrow(
        "Building 'ghost-building' not found",
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getMaps() — activeOnly filter
  // ─────────────────────────────────────────────────────────────────────────

  describe('getMaps()', () => {
    it('activeOnly=false — returns all maps regardless of isActive flag', async () => {
      // Arrange
      mockPrisma.gameMap.findMany.mockResolvedValue([mapActiveFixture, mapInactiveFixture]);

      // Act
      const result = await service.getMaps(false);

      // Assert
      expect(result).toHaveLength(2);
    });

    it('activeOnly=true — filters to only maps where data.isActive === true', async () => {
      // Arrange
      mockPrisma.gameMap.findMany.mockResolvedValue([mapActiveFixture, mapInactiveFixture]);

      // Act
      const result = await service.getMaps(true);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('arabia');
    });

    it('default (no arg) — equivalent to activeOnly=false, returns all maps', async () => {
      // Arrange
      mockPrisma.gameMap.findMany.mockResolvedValue([mapActiveFixture, mapInactiveFixture]);

      // Act
      const result = await service.getMaps();

      // Assert
      expect(result).toHaveLength(2);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getMap()
  // ─────────────────────────────────────────────────────────────────────────

  describe('getMap()', () => {
    it('normal case — returns the map when found', async () => {
      // Arrange
      mockPrisma.gameMap.findUnique.mockResolvedValue(mapActiveFixture);

      // Act
      const result = await service.getMap('arabia');

      // Assert
      expect(result).toEqual(mapActiveFixture);
    });

    it('not found — throws NotFoundException with mapId in message', async () => {
      // Arrange
      mockPrisma.gameMap.findUnique.mockResolvedValue(null);

      // Act + Assert
      await expect(service.getMap('ghost-map')).rejects.toThrow(NotFoundException);
      await expect(service.getMap('ghost-map')).rejects.toThrow("Map 'ghost-map' not found");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getAllBalanceConfigs()
  // ─────────────────────────────────────────────────────────────────────────

  describe('getAllBalanceConfigs()', () => {
    it('normal case — returns array ordered by configKey asc', async () => {
      // Arrange
      mockPrisma.balanceConfig.findMany.mockResolvedValue([balanceFixture]);

      // Act
      const result = await service.getAllBalanceConfigs();

      // Assert
      expect(mockPrisma.balanceConfig.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { configKey: 'asc' } }),
      );
      expect(result).toEqual([balanceFixture]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getBalanceConfig()
  // ─────────────────────────────────────────────────────────────────────────

  describe('getBalanceConfig()', () => {
    it('normal case — returns the config when found', async () => {
      // Arrange
      mockPrisma.balanceConfig.findUnique.mockResolvedValue(balanceFixture);

      // Act
      const result = await service.getBalanceConfig('unit_damage_multiplier');

      // Assert
      expect(result).toEqual(balanceFixture);
    });

    it('not found — throws NotFoundException with configKey in message', async () => {
      // Arrange
      mockPrisma.balanceConfig.findUnique.mockResolvedValue(null);

      // Act + Assert
      await expect(service.getBalanceConfig('missing_key')).rejects.toThrow(NotFoundException);
      await expect(service.getBalanceConfig('missing_key')).rejects.toThrow(
        "BalanceConfig 'missing_key' not found",
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // setBalanceConfig()
  // ─────────────────────────────────────────────────────────────────────────

  describe('setBalanceConfig()', () => {
    it('upsert shape — create path sets version=1; update path uses increment', async () => {
      // Arrange
      const updatedFixture = { ...balanceFixture, version: 4 };
      mockPrisma.balanceConfig.upsert.mockResolvedValue(updatedFixture);

      // Act
      const result = await service.setBalanceConfig(
        'unit_damage_multiplier',
        { multiplier: 1.1 },
        'admin-2',
      );

      // Assert
      expect(mockPrisma.balanceConfig.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where:  { configKey: 'unit_damage_multiplier' },
          create: expect.objectContaining({ configKey: 'unit_damage_multiplier', version: 1, updatedBy: 'admin-2' }),
          update: expect.objectContaining({ value: { multiplier: 1.1 }, version: { increment: 1 }, updatedBy: 'admin-2' }),
        }),
      );
      expect(result).toEqual(updatedFixture);
    });

    it('updatedBy omitted — passes null for updatedBy in both create and update', async () => {
      // Arrange
      mockPrisma.balanceConfig.upsert.mockResolvedValue(balanceFixture);

      // Act
      await service.setBalanceConfig('some_key', 42);

      // Assert
      const upsertArg = mockPrisma.balanceConfig.upsert.mock.calls[0][0];
      expect(upsertArg.create.updatedBy).toBeNull();
      expect(upsertArg.update.updatedBy).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getBalanceConfigHistory()
  // ─────────────────────────────────────────────────────────────────────────

  describe('getBalanceConfigHistory()', () => {
    it('delegates to getBalanceConfig and returns the same record', async () => {
      // Arrange
      mockPrisma.balanceConfig.findUnique.mockResolvedValue(balanceFixture);

      // Act
      const result = await service.getBalanceConfigHistory('unit_damage_multiplier');

      // Assert — same record returned because history == current state in this schema
      expect(result).toEqual(balanceFixture);
      expect(mockPrisma.balanceConfig.findUnique).toHaveBeenCalledTimes(1);
    });

    it('missing key — propagates NotFoundException from getBalanceConfig', async () => {
      // Arrange
      mockPrisma.balanceConfig.findUnique.mockResolvedValue(null);

      // Act + Assert
      await expect(service.getBalanceConfigHistory('ghost_key')).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getVersions()
  // ─────────────────────────────────────────────────────────────────────────

  describe('getVersions()', () => {
    it('normal case — returns array ordered by publishedAt descending', async () => {
      // Arrange
      mockPrisma.masterDataVersion.findMany.mockResolvedValue([versionFixture]);

      // Act
      const result = await service.getVersions();

      // Assert
      expect(mockPrisma.masterDataVersion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { publishedAt: 'desc' } }),
      );
      expect(result).toEqual([versionFixture]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // publishVersion()
  // ─────────────────────────────────────────────────────────────────────────

  describe('publishVersion()', () => {
    it('normal case — sets publishedAt and publishedBy on the version record', async () => {
      // Arrange
      mockPrisma.masterDataVersion.findUnique.mockResolvedValue(versionFixture);
      const publishedRecord = { ...versionFixture, publishedAt: NOW, publishedBy: 'admin-1' };
      mockPrisma.masterDataVersion.update.mockResolvedValue(publishedRecord);

      // Act
      const result = await service.publishVersion('uuid-ver-1', 'admin-1');

      // Assert
      expect(mockPrisma.masterDataVersion.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'uuid-ver-1' },
          data: expect.objectContaining({ publishedBy: 'admin-1' }),
        }),
      );
      expect(result.publishedBy).toBe('admin-1');
    });

    it('missing version record — throws NotFoundException, never calls update', async () => {
      // Arrange
      mockPrisma.masterDataVersion.findUnique.mockResolvedValue(null);

      // Act + Assert
      await expect(service.publishVersion('ghost-id', 'admin-1')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.masterDataVersion.update).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getLandmarks()
  // ─────────────────────────────────────────────────────────────────────────

  describe('getLandmarks()', () => {
    it('with civId — passes civId filter to Prisma', async () => {
      // Arrange
      mockPrisma.landmark.findMany.mockResolvedValue([landmarkFixture]);

      // Act
      const result = await service.getLandmarks('english');

      // Assert
      expect(mockPrisma.landmark.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { civId: 'english' } }),
      );
      expect(result).toEqual([landmarkFixture]);
    });

    it('no civId — passes undefined where to Prisma (returns all landmarks)', async () => {
      // Arrange
      mockPrisma.landmark.findMany.mockResolvedValue([landmarkFixture]);

      // Act
      await service.getLandmarks();

      // Assert
      const callArg = mockPrisma.landmark.findMany.mock.calls[0][0];
      expect(callArg.where).toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // createLandmark()
  // ─────────────────────────────────────────────────────────────────────────

  describe('createLandmark()', () => {
    it('ageRequired absent — defaults to 1 in Prisma create call', async () => {
      // Arrange
      mockPrisma.landmark.create.mockResolvedValue(landmarkFixture);
      const dto = {
        landmarkId: 'white_tower',
        nameKey: 'landmark.white_tower.name',
        civId: 'english',
        data: { hp: 3200, bonus: 'production_speed' },
      };

      // Act
      await service.createLandmark(dto);

      // Assert
      const createArg = mockPrisma.landmark.create.mock.calls[0][0];
      expect(createArg.data.ageRequired).toBe(1);
    });

    it('ageRequired provided — passes explicit value through', async () => {
      // Arrange
      mockPrisma.landmark.create.mockResolvedValue({ ...landmarkFixture, ageRequired: 3 });
      const dto = {
        landmarkId: 'white_tower',
        nameKey: 'landmark.white_tower.name',
        civId: 'english',
        ageRequired: 3,
        data: { hp: 3200, bonus: 'production_speed' },
      };

      // Act
      await service.createLandmark(dto);

      // Assert
      const createArg = mockPrisma.landmark.create.mock.calls[0][0];
      expect(createArg.data.ageRequired).toBe(3);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getTechnologies()
  // ─────────────────────────────────────────────────────────────────────────

  describe('getTechnologies()', () => {
    it('civId filter — passes civId into where clause', async () => {
      // Arrange
      mockPrisma.technology.findMany.mockResolvedValue([techFixture]);

      // Act
      await service.getTechnologies({ civId: 'french' });

      // Assert
      expect(mockPrisma.technology.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { civId: 'french' } }),
      );
    });

    it('no filter — returns all technologies with empty where', async () => {
      // Arrange
      mockPrisma.technology.findMany.mockResolvedValue([techFixture]);

      // Act
      const result = await service.getTechnologies();

      // Assert
      expect(mockPrisma.technology.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
      expect(result).toEqual([techFixture]);
    });
  });
});
