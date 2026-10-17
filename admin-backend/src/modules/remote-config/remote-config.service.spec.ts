/**
 * Story Type  : Logic (service-layer CRUD, flag evaluation, A/B variant hashing)
 * Output      : src/modules/remote-config/
 * Gate Level  : BLOCKING
 *
 * Covered methods
 *   getFeatureFlags()               — returns ordered array
 *   getFeatureFlag(key)             — happy path + NotFoundException
 *   createFeatureFlag(dto)          — default value=false; correct shape
 *   updateFeatureFlag(key, dto)     — guard + partial update
 *   deleteFeatureFlag(key)          — guard + delete call
 *   isEnabled(key)                  — true / false / missing-flag=false
 *   getAbTests(activeOnly)          — all vs. status='active' filter
 *   getAbTest(name)                 — happy path + NotFoundException
 *   createAbTest(dto)               — default status='draft', targetPct=0.1
 *   updateAbTest(name, data)        — guard + update passthrough
 *   getVariantForUser(name, userId) — deterministic hash; draft→null; no-variants→null
 *   getConfigs(environment?)        — env filter and no-filter paths
 *   getConfig(key)                  — happy path + NotFoundException
 *   upsertConfig(dto)               — default environment='production'
 *   deleteConfig(id)                — deletes by id
 *   getSettings()                   — ordered array
 *   getSetting(key)                 — findUnique passthrough (may return null)
 *   setSetting(key, value, by)      — upsert shape
 *   deleteSetting(key)              — delete call
 *   getClientConfig(env)            — merges remoteConfig + featureFlag into bundle
 *
 * Mock scope : featureFlag, abTest, remoteConfig, systemSetting prisma models.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { RemoteConfigService } from './remote-config.service';
import { PrismaService } from '../../database/prisma.service';

// ---------------------------------------------------------------------------
// Prisma mock — only the models that remote-config.service.ts actually uses
// ---------------------------------------------------------------------------

const mockPrisma: any = {
  featureFlag: {
    findMany:   jest.fn(),
    findUnique: jest.fn(),
    create:     jest.fn(),
    update:     jest.fn(),
    delete:     jest.fn(),
  },
  abTest: {
    findMany:   jest.fn(),
    findUnique: jest.fn(),
    create:     jest.fn(),
    update:     jest.fn(),
  },
  remoteConfig: {
    findMany:   jest.fn(),
    findUnique: jest.fn(),
    upsert:     jest.fn(),
    delete:     jest.fn(),
  },
  systemSetting: {
    findMany:   jest.fn(),
    findUnique: jest.fn(),
    upsert:     jest.fn(),
    delete:     jest.fn(),
  },
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = new Date('2026-06-14T00:00:00.000Z');

const flagFixture = {
  id: 'flag-uuid-1',
  key: 'new-matchmaking-ui',
  value: true,
  description: 'Enables the redesigned matchmaking screen',
  updatedBy: 'admin-1',
  createdAt: NOW,
  updatedAt: NOW,
};

const abTestFixture = {
  id: 'ab-uuid-1',
  name: 'onboarding-v2',
  description: 'Tests new onboarding flow',
  variants: [
    { variantId: 'control',   weight: 0.5 },
    { variantId: 'treatment', weight: 0.5 },
  ],
  targetPct: 0.1,
  metric: 'day1_retention',
  status: 'active',
  startAt: NOW,
  endAt: undefined,
  result: null,
  createdAt: NOW,
  updatedAt: NOW,
};

const remoteConfigFixture = {
  id: 'cfg-uuid-1',
  key: 'max_lobby_size',
  value: 8,
  environment: 'production',
  description: 'Maximum players per lobby',
  updatedBy: 'admin-1',
  createdAt: NOW,
  updatedAt: NOW,
};

const settingFixture = {
  id: 'set-uuid-1',
  key: 'maintenance_mode',
  value: false,
  updatedBy: 'ops-1',
  createdAt: NOW,
  updatedAt: NOW,
};

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('RemoteConfigService', () => {
  let service: RemoteConfigService;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RemoteConfigService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<RemoteConfigService>(RemoteConfigService);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getFeatureFlags()
  // ─────────────────────────────────────────────────────────────────────────

  describe('getFeatureFlags()', () => {
    it('normal case — returns array ordered by key asc', async () => {
      // Arrange
      mockPrisma.featureFlag.findMany.mockResolvedValue([flagFixture]);

      // Act
      const result = await service.getFeatureFlags();

      // Assert
      expect(mockPrisma.featureFlag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { key: 'asc' } }),
      );
      expect(result).toEqual([flagFixture]);
    });

    it('empty store — returns empty array without throwing', async () => {
      // Arrange
      mockPrisma.featureFlag.findMany.mockResolvedValue([]);

      // Act
      const result = await service.getFeatureFlags();

      // Assert
      expect(result).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getFeatureFlag()
  // ─────────────────────────────────────────────────────────────────────────

  describe('getFeatureFlag()', () => {
    it('normal case — returns the flag when found by key', async () => {
      // Arrange
      mockPrisma.featureFlag.findUnique.mockResolvedValue(flagFixture);

      // Act
      const result = await service.getFeatureFlag('new-matchmaking-ui');

      // Assert
      expect(result).toEqual(flagFixture);
      expect(mockPrisma.featureFlag.findUnique).toHaveBeenCalledWith({
        where: { key: 'new-matchmaking-ui' },
      });
    });

    it('not found — throws NotFoundException with key in message', async () => {
      // Arrange
      mockPrisma.featureFlag.findUnique.mockResolvedValue(null);

      // Act + Assert
      await expect(service.getFeatureFlag('ghost-flag')).rejects.toThrow(NotFoundException);
      await expect(service.getFeatureFlag('ghost-flag')).rejects.toThrow('ghost-flag');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // createFeatureFlag()
  // ─────────────────────────────────────────────────────────────────────────

  describe('createFeatureFlag()', () => {
    it('value provided — passes value through to Prisma create', async () => {
      // Arrange
      mockPrisma.featureFlag.create.mockResolvedValue(flagFixture);
      const dto = {
        key: 'new-matchmaking-ui',
        value: true,
        description: 'Enables the redesigned matchmaking screen',
        updatedBy: 'admin-1',
      };

      // Act
      const result = await service.createFeatureFlag(dto);

      // Assert
      expect(mockPrisma.featureFlag.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ key: 'new-matchmaking-ui', value: true }),
      });
      expect(result).toEqual(flagFixture);
    });

    it('value absent — defaults to false in Prisma create', async () => {
      // Arrange
      mockPrisma.featureFlag.create.mockResolvedValue({ ...flagFixture, value: false });
      const dto = { key: 'experimental-feature' };

      // Act
      await service.createFeatureFlag(dto);

      // Assert
      const createArg = mockPrisma.featureFlag.create.mock.calls[0][0];
      expect(createArg.data.value).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // updateFeatureFlag()
  // ─────────────────────────────────────────────────────────────────────────

  describe('updateFeatureFlag()', () => {
    it('normal case — calls getFeatureFlag guard then issues update', async () => {
      // Arrange
      mockPrisma.featureFlag.findUnique.mockResolvedValue(flagFixture);
      mockPrisma.featureFlag.update.mockResolvedValue({ ...flagFixture, value: false });

      // Act
      await service.updateFeatureFlag('new-matchmaking-ui', { value: false });

      // Assert
      expect(mockPrisma.featureFlag.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { key: 'new-matchmaking-ui' } }),
      );
    });

    it('missing flag — throws NotFoundException, never calls update', async () => {
      // Arrange
      mockPrisma.featureFlag.findUnique.mockResolvedValue(null);

      // Act + Assert
      await expect(service.updateFeatureFlag('ghost-flag', { value: true })).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.featureFlag.update).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // deleteFeatureFlag()
  // ─────────────────────────────────────────────────────────────────────────

  describe('deleteFeatureFlag()', () => {
    it('normal case — calls getFeatureFlag guard then deletes', async () => {
      // Arrange
      mockPrisma.featureFlag.findUnique.mockResolvedValue(flagFixture);
      mockPrisma.featureFlag.delete.mockResolvedValue(flagFixture);

      // Act
      await service.deleteFeatureFlag('new-matchmaking-ui');

      // Assert
      expect(mockPrisma.featureFlag.delete).toHaveBeenCalledWith({
        where: { key: 'new-matchmaking-ui' },
      });
    });

    it('missing flag — throws NotFoundException, never calls delete', async () => {
      // Arrange
      mockPrisma.featureFlag.findUnique.mockResolvedValue(null);

      // Act + Assert
      await expect(service.deleteFeatureFlag('ghost-flag')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.featureFlag.delete).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // isEnabled()
  // ─────────────────────────────────────────────────────────────────────────

  describe('isEnabled()', () => {
    it('flag value true — returns true', async () => {
      // Arrange
      mockPrisma.featureFlag.findUnique.mockResolvedValue({ key: 'my-flag', value: true });

      // Act + Assert
      await expect(service.isEnabled('my-flag')).resolves.toBe(true);
    });

    it('flag value false — returns false', async () => {
      // Arrange
      mockPrisma.featureFlag.findUnique.mockResolvedValue({ key: 'my-flag', value: false });

      // Act + Assert
      await expect(service.isEnabled('my-flag')).resolves.toBe(false);
    });

    it('flag does not exist — returns false (safe default)', async () => {
      // Arrange
      mockPrisma.featureFlag.findUnique.mockResolvedValue(null);

      // Act + Assert
      await expect(service.isEnabled('nonexistent-flag')).resolves.toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getAbTests()
  // ─────────────────────────────────────────────────────────────────────────

  describe('getAbTests()', () => {
    it('activeOnly=true — passes status:"active" filter to Prisma', async () => {
      // Arrange
      mockPrisma.abTest.findMany.mockResolvedValue([abTestFixture]);

      // Act
      await service.getAbTests(true);

      // Assert
      expect(mockPrisma.abTest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'active' } }),
      );
    });

    it('no activeOnly arg — passes empty where to Prisma (all tests)', async () => {
      // Arrange
      mockPrisma.abTest.findMany.mockResolvedValue([abTestFixture]);

      // Act
      await service.getAbTests();

      // Assert
      expect(mockPrisma.abTest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getAbTest()
  // ─────────────────────────────────────────────────────────────────────────

  describe('getAbTest()', () => {
    it('normal case — returns the test when found', async () => {
      // Arrange
      mockPrisma.abTest.findUnique.mockResolvedValue(abTestFixture);

      // Act
      const result = await service.getAbTest('onboarding-v2');

      // Assert
      expect(result).toEqual(abTestFixture);
    });

    it('not found — throws NotFoundException with name in message', async () => {
      // Arrange
      mockPrisma.abTest.findUnique.mockResolvedValue(null);

      // Act + Assert
      await expect(service.getAbTest('ghost-test')).rejects.toThrow(NotFoundException);
      await expect(service.getAbTest('ghost-test')).rejects.toThrow('ghost-test');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // createAbTest()
  // ─────────────────────────────────────────────────────────────────────────

  describe('createAbTest()', () => {
    it('normal case — creates with status="draft" and default targetPct=0.1', async () => {
      // Arrange
      mockPrisma.abTest.create.mockResolvedValue({ ...abTestFixture, status: 'draft' });
      const dto = {
        name: 'onboarding-v2',
        description: 'Tests new onboarding flow',
        variants: [{ variantId: 'control', weight: 0.5 }, { variantId: 'treatment', weight: 0.5 }],
        metric: 'day1_retention',
        startAt: NOW,
        endAt: undefined,
      };

      // Act
      await service.createAbTest(dto);

      // Assert
      const createArg = mockPrisma.abTest.create.mock.calls[0][0];
      expect(createArg.data.status).toBe('draft');
      expect(createArg.data.targetPct).toBe(0.1);
    });

    it('targetPct provided — passes caller value through instead of default', async () => {
      // Arrange
      mockPrisma.abTest.create.mockResolvedValue(abTestFixture);
      const dto = {
        name: 'mini-test',
        description: '',
        variants: [],
        metric: 'ctr',
        targetPct: 0.05,
        startAt: NOW,
        endAt: undefined,
      };

      // Act
      await service.createAbTest(dto);

      // Assert
      const createArg = mockPrisma.abTest.create.mock.calls[0][0];
      expect(createArg.data.targetPct).toBe(0.05);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // updateAbTest()
  // ─────────────────────────────────────────────────────────────────────────

  describe('updateAbTest()', () => {
    it('normal case — guards via getAbTest then passes data to Prisma update', async () => {
      // Arrange
      mockPrisma.abTest.findUnique.mockResolvedValue(abTestFixture);
      mockPrisma.abTest.update.mockResolvedValue({ ...abTestFixture, status: 'completed' });

      // Act
      await service.updateAbTest('onboarding-v2', { status: 'completed' });

      // Assert
      expect(mockPrisma.abTest.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { name: 'onboarding-v2' } }),
      );
    });

    it('missing test — throws NotFoundException, never calls update', async () => {
      // Arrange
      mockPrisma.abTest.findUnique.mockResolvedValue(null);

      // Act + Assert
      await expect(service.updateAbTest('ghost-test', { status: 'active' })).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.abTest.update).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getVariantForUser()
  // ─────────────────────────────────────────────────────────────────────────

  describe('getVariantForUser()', () => {
    it('normal case — returns a variant from the defined set (deterministic)', async () => {
      // Arrange
      mockPrisma.abTest.findUnique.mockResolvedValue(abTestFixture);

      // Act
      const first  = await service.getVariantForUser('onboarding-v2', 'stable-user-abc');
      mockPrisma.abTest.findUnique.mockResolvedValue(abTestFixture);
      const second = await service.getVariantForUser('onboarding-v2', 'stable-user-abc');

      // Assert — same userId always lands in the same variant
      expect(first).toBe(second);
      expect(['control', 'treatment']).toContain(first);
    });

    it('test status is not "active" — returns null', async () => {
      // Arrange
      mockPrisma.abTest.findUnique.mockResolvedValue({ ...abTestFixture, status: 'draft' });

      // Act + Assert
      await expect(service.getVariantForUser('onboarding-v2', 'user-1')).resolves.toBeNull();
    });

    it('test has no variants — returns null', async () => {
      // Arrange
      mockPrisma.abTest.findUnique.mockResolvedValue({ ...abTestFixture, variants: [] });

      // Act + Assert
      await expect(service.getVariantForUser('onboarding-v2', 'user-1')).resolves.toBeNull();
    });

    it('test not found — throws NotFoundException', async () => {
      // Arrange
      mockPrisma.abTest.findUnique.mockResolvedValue(null);

      // Act + Assert
      await expect(service.getVariantForUser('ghost-test', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('different userIds produce a distribution across variants', async () => {
      // Arrange — 100-user sample should hit both variants given uniform hash distribution
      mockPrisma.abTest.findUnique.mockResolvedValue(abTestFixture);

      const variants = new Set<string>();
      for (let i = 0; i < 100; i++) {
        mockPrisma.abTest.findUnique.mockResolvedValue(abTestFixture);
        const v = await service.getVariantForUser('onboarding-v2', `user-${i}`);
        if (v) variants.add(v);
      }

      // Assert — with 100 users and 50/50 weights both variants should appear
      expect(variants.size).toBeGreaterThan(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getConfigs()
  // ─────────────────────────────────────────────────────────────────────────

  describe('getConfigs()', () => {
    it('environment provided — passes environment filter to Prisma', async () => {
      // Arrange
      mockPrisma.remoteConfig.findMany.mockResolvedValue([remoteConfigFixture]);

      // Act
      await service.getConfigs('staging');

      // Assert
      expect(mockPrisma.remoteConfig.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { environment: 'staging' } }),
      );
    });

    it('no environment — passes empty where to Prisma (all environments)', async () => {
      // Arrange
      mockPrisma.remoteConfig.findMany.mockResolvedValue([remoteConfigFixture]);

      // Act
      await service.getConfigs();

      // Assert
      expect(mockPrisma.remoteConfig.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getConfig()
  // ─────────────────────────────────────────────────────────────────────────

  describe('getConfig()', () => {
    it('normal case — returns the config when found by key', async () => {
      // Arrange
      mockPrisma.remoteConfig.findUnique.mockResolvedValue(remoteConfigFixture);

      // Act
      const result = await service.getConfig('max_lobby_size');

      // Assert
      expect(result).toEqual(remoteConfigFixture);
      expect(mockPrisma.remoteConfig.findUnique).toHaveBeenCalledWith({
        where: { key: 'max_lobby_size' },
      });
    });

    it('not found — throws NotFoundException with key in message', async () => {
      // Arrange
      mockPrisma.remoteConfig.findUnique.mockResolvedValue(null);

      // Act + Assert
      await expect(service.getConfig('ghost_key')).rejects.toThrow(NotFoundException);
      await expect(service.getConfig('ghost_key')).rejects.toThrow('ghost_key');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // upsertConfig()
  // ─────────────────────────────────────────────────────────────────────────

  describe('upsertConfig()', () => {
    it('normal case — calls upsert with correct where and data shape', async () => {
      // Arrange
      mockPrisma.remoteConfig.upsert.mockResolvedValue(remoteConfigFixture);
      const dto = {
        key: 'max_lobby_size',
        value: 8,
        environment: 'production',
        description: 'Maximum players per lobby',
        updatedBy: 'admin-1',
      };

      // Act
      const result = await service.upsertConfig(dto);

      // Assert
      expect(mockPrisma.remoteConfig.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { key: 'max_lobby_size' } }),
      );
      expect(result).toEqual(remoteConfigFixture);
    });

    it('environment absent — defaults to "production" in both create and update', async () => {
      // Arrange
      mockPrisma.remoteConfig.upsert.mockResolvedValue(remoteConfigFixture);
      const dto = { key: 'some_key', value: 42 };

      // Act
      await service.upsertConfig(dto);

      // Assert
      const upsertArg = mockPrisma.remoteConfig.upsert.mock.calls[0][0];
      expect(upsertArg.create.environment).toBe('production');
      expect(upsertArg.update.environment).toBe('production');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // deleteConfig()
  // ─────────────────────────────────────────────────────────────────────────

  describe('deleteConfig()', () => {
    it('normal case — calls Prisma delete with the provided id', async () => {
      // Arrange
      mockPrisma.remoteConfig.delete.mockResolvedValue(remoteConfigFixture);

      // Act
      await service.deleteConfig('cfg-uuid-1');

      // Assert
      expect(mockPrisma.remoteConfig.delete).toHaveBeenCalledWith({
        where: { id: 'cfg-uuid-1' },
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getSettings() / getSetting() / setSetting() / deleteSetting()
  // ─────────────────────────────────────────────────────────────────────────

  describe('getSettings()', () => {
    it('normal case — returns array ordered by key asc', async () => {
      // Arrange
      mockPrisma.systemSetting.findMany.mockResolvedValue([settingFixture]);

      // Act
      const result = await service.getSettings();

      // Assert
      expect(mockPrisma.systemSetting.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { key: 'asc' } }),
      );
      expect(result).toEqual([settingFixture]);
    });
  });

  describe('getSetting()', () => {
    it('normal case — passes key to findUnique and returns result', async () => {
      // Arrange
      mockPrisma.systemSetting.findUnique.mockResolvedValue(settingFixture);

      // Act
      const result = await service.getSetting('maintenance_mode');

      // Assert
      expect(mockPrisma.systemSetting.findUnique).toHaveBeenCalledWith({
        where: { key: 'maintenance_mode' },
      });
      expect(result).toEqual(settingFixture);
    });

    it('missing key — returns null (no NotFoundException — callers check the result)', async () => {
      // Arrange
      mockPrisma.systemSetting.findUnique.mockResolvedValue(null);

      // Act
      const result = await service.getSetting('nonexistent');

      // Assert — service does NOT throw; null is valid
      expect(result).toBeNull();
    });
  });

  describe('setSetting()', () => {
    it('normal case — calls upsert with correct key, value, and updatedBy', async () => {
      // Arrange
      mockPrisma.systemSetting.upsert.mockResolvedValue(settingFixture);

      // Act
      await service.setSetting('maintenance_mode', false, 'ops-1');

      // Assert
      expect(mockPrisma.systemSetting.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where:  { key: 'maintenance_mode' },
          create: expect.objectContaining({ key: 'maintenance_mode', value: false, updatedBy: 'ops-1' }),
          update: expect.objectContaining({ value: false, updatedBy: 'ops-1' }),
        }),
      );
    });
  });

  describe('deleteSetting()', () => {
    it('normal case — calls Prisma delete with the provided key', async () => {
      // Arrange
      mockPrisma.systemSetting.delete.mockResolvedValue(settingFixture);

      // Act
      await service.deleteSetting('maintenance_mode');

      // Assert
      expect(mockPrisma.systemSetting.delete).toHaveBeenCalledWith({
        where: { key: 'maintenance_mode' },
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getClientConfig()
  // ─────────────────────────────────────────────────────────────────────────

  describe('getClientConfig()', () => {
    it('normal case — merges active flags and environment configs into bundle', async () => {
      // Arrange
      mockPrisma.remoteConfig.findMany.mockResolvedValue([
        { key: 'max_lobby_size', value: 8, environment: 'production' },
      ]);
      mockPrisma.featureFlag.findMany.mockResolvedValue([
        { key: 'new-matchmaking-ui', value: true },
      ]);

      // Act
      const result = await service.getClientConfig('production');

      // Assert
      expect(result.environment).toBe('production');
      expect(result.configs).toEqual({ max_lobby_size: 8 });
      expect(result.flags).toEqual({ 'new-matchmaking-ui': true });
    });

    it('empty store — returns empty configs and flags maps', async () => {
      // Arrange
      mockPrisma.remoteConfig.findMany.mockResolvedValue([]);
      mockPrisma.featureFlag.findMany.mockResolvedValue([]);

      // Act
      const result = await service.getClientConfig('production');

      // Assert
      expect(result.configs).toEqual({});
      expect(result.flags).toEqual({});
    });

    it('default environment — defaults to "production" when no arg is passed', async () => {
      // Arrange
      mockPrisma.remoteConfig.findMany.mockResolvedValue([]);
      mockPrisma.featureFlag.findMany.mockResolvedValue([]);

      // Act
      const result = await service.getClientConfig();

      // Assert
      expect(result.environment).toBe('production');
    });

    it('only flags set to true appear in the flags map', async () => {
      // Arrange — featureFlag.findMany is called with where:{ value: true }
      // so Prisma only returns enabled flags; verify the service passes that filter
      mockPrisma.remoteConfig.findMany.mockResolvedValue([]);
      mockPrisma.featureFlag.findMany.mockResolvedValue([
        { key: 'enabled-feature', value: true },
      ]);

      // Act
      const result = await service.getClientConfig('production');

      // Assert
      const flagQuery = mockPrisma.featureFlag.findMany.mock.calls[0][0];
      expect(flagQuery.where).toEqual({ value: true });
      expect(result.flags['enabled-feature']).toBe(true);
    });
  });
});
