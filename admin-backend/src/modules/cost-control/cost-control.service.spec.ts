/**
 * Story Type  : Logic (service-layer economy config CRUD, simulation, CSV export)
 * Output      : src/modules/cost-control/
 * Gate Level  : BLOCKING
 *
 * Covered methods
 *   getAllCosts()            — startsWith:"cost." filter + order
 *   getCost(key)            — happy path + NotFoundException
 *   updateCost(dto)         — create path (version=1) + update path (version+1)
 *   bulkUpdateCosts(dtos)   — wraps in $transaction callback (NOT an array)
 *   getEconomySnapshot()    — categorises records by sub-prefix into four buckets
 *   simulateCostChange(dto) — read-only: projects values, no upsert/transaction
 *   getCostHistory(key)     — happy path + NotFoundException
 *   exportCostSheet()       — CSV header, one row per record, comma-escape
 *
 * Mock scope  : balanceConfig prisma model + $transaction only.
 *
 * NOTE ON bulkUpdateCosts:
 *   The service calls `this.prisma.$transaction(async (tx) => { ... })` with a
 *   CALLBACK. The mock therefore invokes that callback with a fake tx object
 *   that mirrors the balanceConfig methods. Using `mockResolvedValue([...])` (an
 *   array) would bypass the callback entirely and return wrong results.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CostControlService } from './cost-control.service';
import { PrismaService } from '../../database/prisma.service';

// ---------------------------------------------------------------------------
// Fake transaction client reused by the $transaction callback mock
// ---------------------------------------------------------------------------

const mockTx = {
  balanceConfig: {
    findUnique: jest.fn(),
    upsert:     jest.fn(),
  },
};

// ---------------------------------------------------------------------------
// Prisma mock — only balanceConfig and $transaction used by cost-control
// ---------------------------------------------------------------------------

const mockPrisma: any = {
  balanceConfig: {
    findMany:   jest.fn(),
    findUnique: jest.fn(),
    upsert:     jest.fn(),
  },
  // Invokes the callback with mockTx so inner tx.balanceConfig calls are captured
  $transaction: jest.fn().mockImplementation((cb: (tx: typeof mockTx) => Promise<unknown>) =>
    cb(mockTx),
  ),
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = new Date('2026-06-14T00:00:00.000Z');

const spearmanCost = {
  id: 'uuid-1',
  configKey: 'cost.unit.spearman.wood',
  value: { wood: 50 },
  description: 'Spearman wood cost',
  version: 3,
  updatedAt: NOW,
  updatedBy: 'admin@kowgame.com',
};

const knightCost = {
  id: 'uuid-2',
  configKey: 'cost.unit.knight.food',
  value: { food: 120 },
  description: 'Knight food cost',
  version: 1,
  updatedAt: NOW,
  updatedBy: null,
};

const barracksCost = {
  id: 'uuid-3',
  configKey: 'cost.building.barracks.wood',
  value: { wood: 150 },
  description: 'Barracks wood cost',
  version: 2,
  updatedAt: NOW,
  updatedBy: null,
};

const fletchingCost = {
  id: 'uuid-4',
  configKey: 'cost.tech.fletching.gold',
  value: { gold: 75 },
  description: 'Fletching gold cost',
  version: 1,
  updatedAt: NOW,
  updatedBy: null,
};

const woodRateCost = {
  id: 'uuid-5',
  configKey: 'cost.resource.wood.gather_rate',
  value: { base: 0.75 },
  description: 'Wood gather rate',
  version: 1,
  updatedAt: NOW,
  updatedBy: null,
};

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('CostControlService', () => {
  let service: CostControlService;

  beforeEach(async () => {
    jest.resetAllMocks();

    // Re-wire $transaction after resetAllMocks clears the implementation
    mockPrisma.$transaction.mockImplementation(
      (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CostControlService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CostControlService>(CostControlService);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getAllCosts()
  // ─────────────────────────────────────────────────────────────────────────

  describe('getAllCosts()', () => {
    it('normal case — queries with startsWith:"cost." and orderBy:configKey asc', async () => {
      // Arrange
      mockPrisma.balanceConfig.findMany.mockResolvedValue([spearmanCost, knightCost]);

      // Act
      const result = await service.getAllCosts();

      // Assert
      expect(mockPrisma.balanceConfig.findMany).toHaveBeenCalledWith({
        where:   { configKey: { startsWith: 'cost.' } },
        orderBy: { configKey: 'asc' },
      });
      expect(result).toEqual([spearmanCost, knightCost]);
    });

    it('empty result — returns empty array without throwing', async () => {
      // Arrange
      mockPrisma.balanceConfig.findMany.mockResolvedValue([]);

      // Act
      const result = await service.getAllCosts();

      // Assert
      expect(result).toEqual([]);
    });

    it('filter excludes non-"cost." prefix — WHERE clause contains correct startsWith value', async () => {
      // Arrange
      mockPrisma.balanceConfig.findMany.mockResolvedValue([spearmanCost]);

      // Act
      await service.getAllCosts();

      // Assert — the filter value must be exactly 'cost.' not a partial or variant
      const callArg = mockPrisma.balanceConfig.findMany.mock.calls[0][0];
      expect(callArg.where.configKey.startsWith).toBe('cost.');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getCost()
  // ─────────────────────────────────────────────────────────────────────────

  describe('getCost()', () => {
    it('normal case — returns the record when found by configKey', async () => {
      // Arrange
      mockPrisma.balanceConfig.findUnique.mockResolvedValue(spearmanCost);

      // Act
      const result = await service.getCost('cost.unit.spearman.wood');

      // Assert
      expect(mockPrisma.balanceConfig.findUnique).toHaveBeenCalledWith({
        where: { configKey: 'cost.unit.spearman.wood' },
      });
      expect(result).toEqual(spearmanCost);
    });

    it('not found — throws NotFoundException with configKey in message', async () => {
      // Arrange
      mockPrisma.balanceConfig.findUnique.mockResolvedValue(null);

      // Act + Assert
      await expect(service.getCost('cost.unknown.key')).rejects.toThrow(NotFoundException);
      await expect(service.getCost('cost.unknown.key')).rejects.toThrow('cost.unknown.key');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // updateCost()
  // ─────────────────────────────────────────────────────────────────────────

  describe('updateCost()', () => {
    it('existing record — increments version by 1 in the upsert update path', async () => {
      // Arrange — existing version = 3
      mockPrisma.balanceConfig.findUnique.mockResolvedValue(spearmanCost);
      mockPrisma.balanceConfig.upsert.mockResolvedValue({ ...spearmanCost, version: 4 });

      const dto = {
        configKey: 'cost.unit.spearman.wood',
        value: { wood: 60 },
        description: 'Updated cost',
        updatedBy: 'designer@kowgame.com',
      };

      // Act
      await service.updateCost(dto);

      // Assert
      expect(mockPrisma.balanceConfig.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where:  { configKey: 'cost.unit.spearman.wood' },
          update: expect.objectContaining({ version: 4 }),
          create: expect.objectContaining({ version: 1 }),
        }),
      );
    });

    it('new record — starts at version=1 in both update and create paths', async () => {
      // Arrange — record does not yet exist
      mockPrisma.balanceConfig.findUnique.mockResolvedValue(null);
      mockPrisma.balanceConfig.upsert.mockResolvedValue({ ...knightCost, version: 1 });

      const dto = { configKey: 'cost.unit.knight.food', value: { food: 120 } };

      // Act
      await service.updateCost(dto);

      // Assert — when existing is null, nextVersion = 1
      const upsertArg = mockPrisma.balanceConfig.upsert.mock.calls[0][0];
      expect(upsertArg.update.version).toBe(1);
      expect(upsertArg.create.version).toBe(1);
    });

    it('calls findUnique once and upsert once per invocation', async () => {
      // Arrange
      mockPrisma.balanceConfig.findUnique.mockResolvedValue(spearmanCost);
      mockPrisma.balanceConfig.upsert.mockResolvedValue(spearmanCost);

      // Act
      await service.updateCost({ configKey: 'cost.unit.spearman.wood', value: { wood: 50 } });

      // Assert
      expect(mockPrisma.balanceConfig.findUnique).toHaveBeenCalledTimes(1);
      expect(mockPrisma.balanceConfig.upsert).toHaveBeenCalledTimes(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // bulkUpdateCosts()
  // IMPORTANT: service calls $transaction(async (tx) => { ... }) with a
  // callback — mockTx.balanceConfig methods must be set up for inner calls.
  // ─────────────────────────────────────────────────────────────────────────

  describe('bulkUpdateCosts()', () => {
    it('normal case — wraps all upserts inside a single $transaction callback', async () => {
      // Arrange — tx client has the same records as the outer mock
      mockTx.balanceConfig.findUnique
        .mockResolvedValueOnce(spearmanCost)   // existing version=3 → update to 4
        .mockResolvedValueOnce(null);           // new record → create with version=1
      mockTx.balanceConfig.upsert
        .mockResolvedValueOnce({ ...spearmanCost, version: 4 })
        .mockResolvedValueOnce({ ...knightCost, version: 1 });

      const updates = [
        { configKey: 'cost.unit.spearman.wood', value: { wood: 55 } },
        { configKey: 'cost.unit.knight.food',   value: { food: 130 } },
      ];

      // Act
      const results = await service.bulkUpdateCosts(updates);

      // Assert — $transaction called once with a function (not an array)
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(typeof mockPrisma.$transaction.mock.calls[0][0]).toBe('function');

      // Both upserts executed inside the transaction
      expect(mockTx.balanceConfig.upsert).toHaveBeenCalledTimes(2);
      expect(results).toHaveLength(2);
    });

    it('version logic inside transaction — increments existing, starts at 1 for new', async () => {
      // Arrange
      mockTx.balanceConfig.findUnique.mockResolvedValueOnce(spearmanCost); // version=3
      mockTx.balanceConfig.upsert.mockResolvedValueOnce({ ...spearmanCost, version: 4 });

      // Act
      await service.bulkUpdateCosts([{ configKey: 'cost.unit.spearman.wood', value: { wood: 60 } }]);

      // Assert
      const upsertArg = mockTx.balanceConfig.upsert.mock.calls[0][0];
      expect(upsertArg.update.version).toBe(4); // existing version+1
      expect(upsertArg.create.version).toBe(1);
    });

    it('empty updates array — calls $transaction once and returns empty results', async () => {
      // Act
      const results = await service.bulkUpdateCosts([]);

      // Assert
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(results).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getEconomySnapshot()
  // ─────────────────────────────────────────────────────────────────────────

  describe('getEconomySnapshot()', () => {
    it('normal case — categorises records into the four snapshot buckets', async () => {
      // Arrange — one record per bucket
      mockPrisma.balanceConfig.findMany.mockResolvedValue([
        spearmanCost,   // cost.unit.*
        barracksCost,   // cost.building.*
        fletchingCost,  // cost.tech.*
        woodRateCost,   // cost.resource.*
      ]);

      // Act
      const snapshot = await service.getEconomySnapshot();

      // Assert
      expect(snapshot.unitCosts).toContainEqual(spearmanCost);
      expect(snapshot.buildingCosts).toContainEqual(barracksCost);
      expect(snapshot.techCosts).toContainEqual(fletchingCost);
      expect(snapshot.resourceRates).toContainEqual(woodRateCost);
    });

    it('empty costs table — all four buckets are empty arrays', async () => {
      // Arrange
      mockPrisma.balanceConfig.findMany.mockResolvedValue([]);

      // Act
      const snapshot = await service.getEconomySnapshot();

      // Assert
      expect(snapshot.unitCosts).toEqual([]);
      expect(snapshot.buildingCosts).toEqual([]);
      expect(snapshot.techCosts).toEqual([]);
      expect(snapshot.resourceRates).toEqual([]);
    });

    it('returns an object with exactly the four expected bucket keys', async () => {
      // Arrange
      mockPrisma.balanceConfig.findMany.mockResolvedValue([]);

      // Act
      const snapshot = await service.getEconomySnapshot();

      // Assert
      expect(Object.keys(snapshot).sort()).toEqual(
        ['buildingCosts', 'resourceRates', 'techCosts', 'unitCosts'].sort(),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // simulateCostChange()
  // ─────────────────────────────────────────────────────────────────────────

  describe('simulateCostChange()', () => {
    it('normal case — returns projected values without writing to the database', async () => {
      // Arrange
      const ageRecord = {
        ...spearmanCost,
        configKey: 'cost.mongols.age1.spearman',
        value: { wood: 100 },
      };
      mockPrisma.balanceConfig.findMany.mockResolvedValue([ageRecord]);

      // Act
      const report = await service.simulateCostChange({
        civId: 'mongols',
        age: 1,
        resourceMultiplier: 2,
      });

      // Assert — projected value doubled, original unchanged
      expect(report.affectedConfigs[0].original).toEqual({ wood: 100 });
      expect(report.affectedConfigs[0].simulated).toEqual({ wood: 200 });
      // Must not write anything
      expect(mockPrisma.balanceConfig.upsert).not.toHaveBeenCalled();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('no matching configs — returns empty affectedConfigs and "not found" summary', async () => {
      // Arrange
      mockPrisma.balanceConfig.findMany.mockResolvedValue([]);

      // Act
      const report = await service.simulateCostChange({
        civId: 'unknownciv',
        age: 3,
        resourceMultiplier: 1.5,
      });

      // Assert
      expect(report.affectedConfigs).toHaveLength(0);
      expect(report.summary).toContain('No cost configs found');
    });

    it('report includes civId, age, and resourceMultiplier from input', async () => {
      // Arrange
      mockPrisma.balanceConfig.findMany.mockResolvedValue([]);

      // Act
      const report = await service.simulateCostChange({
        civId: 'french',
        age: 2,
        resourceMultiplier: 0.8,
      });

      // Assert
      expect(report.civId).toBe('french');
      expect(report.age).toBe(2);
      expect(report.resourceMultiplier).toBe(0.8);
    });

    it('multiplier=1 — simulated values equal originals (identity transform)', async () => {
      // Arrange
      const ageRecord = {
        ...spearmanCost,
        configKey: 'cost.english.age2.longbowman',
        value: { food: 60, gold: 20 },
      };
      mockPrisma.balanceConfig.findMany.mockResolvedValue([ageRecord]);

      // Act
      const report = await service.simulateCostChange({
        civId: 'english',
        age: 2,
        resourceMultiplier: 1,
      });

      // Assert
      expect(report.affectedConfigs[0].simulated).toEqual({ food: 60, gold: 20 });
    });

    it('nested object value — multiplier applied recursively to all numeric leaves', async () => {
      // Arrange
      const ageRecord = {
        ...spearmanCost,
        configKey: 'cost.mongols.age1.khan',
        value: { food: 100, gold: 50, bonuses: { dmg: 10 } },
      };
      mockPrisma.balanceConfig.findMany.mockResolvedValue([ageRecord]);

      // Act
      const report = await service.simulateCostChange({
        civId: 'mongols',
        age: 1,
        resourceMultiplier: 2,
      });

      // Assert
      expect(report.affectedConfigs[0].simulated).toEqual({
        food: 200,
        gold: 100,
        bonuses: { dmg: 20 },
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getCostHistory()
  // ─────────────────────────────────────────────────────────────────────────

  describe('getCostHistory()', () => {
    it('normal case — returns CostHistoryRecord shape (configKey, version, updatedAt, updatedBy)', async () => {
      // Arrange
      const historyRecord = {
        configKey: 'cost.unit.spearman.wood',
        version: 3,
        updatedAt: NOW,
        updatedBy: 'admin@kowgame.com',
      };
      mockPrisma.balanceConfig.findUnique.mockResolvedValue(historyRecord);

      // Act
      const result = await service.getCostHistory('cost.unit.spearman.wood');

      // Assert
      expect(result).toMatchObject({
        configKey: 'cost.unit.spearman.wood',
        version: 3,
        updatedAt: NOW,
        updatedBy: 'admin@kowgame.com',
      });
    });

    it('not found — throws NotFoundException with configKey in message', async () => {
      // Arrange
      mockPrisma.balanceConfig.findUnique.mockResolvedValue(null);

      // Act + Assert
      await expect(service.getCostHistory('cost.ghost.key')).rejects.toThrow(NotFoundException);
      await expect(service.getCostHistory('cost.ghost.key')).rejects.toThrow('cost.ghost.key');
    });

    it('calls findUnique with the select projection (not a full record fetch)', async () => {
      // Arrange
      mockPrisma.balanceConfig.findUnique.mockResolvedValue({
        configKey: 'cost.unit.spearman.wood',
        version: 3,
        updatedAt: NOW,
        updatedBy: null,
      });

      // Act
      await service.getCostHistory('cost.unit.spearman.wood');

      // Assert — the call must include a select clause narrowing to history fields
      const callArg = mockPrisma.balanceConfig.findUnique.mock.calls[0][0];
      expect(callArg).toHaveProperty('select');
      expect(callArg.select).toMatchObject({
        configKey: true,
        version:   true,
        updatedAt: true,
        updatedBy: true,
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // exportCostSheet()
  // ─────────────────────────────────────────────────────────────────────────

  describe('exportCostSheet()', () => {
    it('normal case — returns CSV string with correct header row', async () => {
      // Arrange
      mockPrisma.balanceConfig.findMany.mockResolvedValue([spearmanCost]);

      // Act
      const csv = await service.exportCostSheet();

      // Assert
      const lines = csv.split('\n');
      expect(lines[0]).toBe('configKey,value,description,version,updatedAt,updatedBy');
    });

    it('one record — produces exactly two lines (header + data row)', async () => {
      // Arrange
      mockPrisma.balanceConfig.findMany.mockResolvedValue([spearmanCost]);

      // Act
      const csv = await service.exportCostSheet();
      const lines = csv.split('\n');

      // Assert
      expect(lines).toHaveLength(2);
      expect(lines[1]).toContain('cost.unit.spearman.wood');
    });

    it('no records — returns only the header row (one line)', async () => {
      // Arrange
      mockPrisma.balanceConfig.findMany.mockResolvedValue([]);

      // Act
      const csv = await service.exportCostSheet();
      const lines = csv.split('\n');

      // Assert
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain('configKey');
    });

    it('description with comma — wraps field in double-quotes', async () => {
      // Arrange
      const recordWithComma = { ...spearmanCost, description: 'Wood, Gold, Food' };
      mockPrisma.balanceConfig.findMany.mockResolvedValue([recordWithComma]);

      // Act
      const csv = await service.exportCostSheet();

      // Assert
      expect(csv).toContain('"Wood, Gold, Food"');
    });

    it('description with embedded double-quote — escaped as ""', async () => {
      // Arrange
      const recordWithQuote = { ...spearmanCost, description: 'He said "hello"' };
      mockPrisma.balanceConfig.findMany.mockResolvedValue([recordWithQuote]);

      // Act
      const csv = await service.exportCostSheet();

      // Assert — CSV escaping doubles the internal quote
      expect(csv).toContain('"He said ""hello"""');
    });

    it('multiple records — produces header + N data rows', async () => {
      // Arrange
      mockPrisma.balanceConfig.findMany.mockResolvedValue([spearmanCost, knightCost, barracksCost]);

      // Act
      const csv = await service.exportCostSheet();
      const lines = csv.split('\n');

      // Assert
      expect(lines).toHaveLength(4); // 1 header + 3 data
    });
  });
});
