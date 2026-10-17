/**
 * Story Type  : Logic (service methods, state transitions)
 * Output      : tests/unit/clan/  (mirrors src path convention)
 * Gate Level  : BLOCKING — automated unit tests must pass before merge
 */

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ClanService } from './clan.service';
import { PrismaService } from '../../database/prisma.service';

// ─── Shared mock builder ───────────────────────────────────────────────────

/**
 * Returns a fresh mock "transaction client" (tx) that mirrors the subset
 * of Prisma models used inside $transaction callbacks in ClanService.
 */
function makeTxMock() {
  return {
    clan: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    clanMember: {
      create: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    playerProfile: {
      updateMany: jest.fn(),
    },
  };
}

// Top-level tx mock — recreated via jest.resetAllMocks() + reassignment in beforeEach
let tx = makeTxMock();

const mockPrisma: any = {
  clan: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  clanMember: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
    delete: jest.fn(),
  },
  clanWar: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
  },
  playerProfile: {
    updateMany: jest.fn(),
  },
  // ClanService uses callback-style transactions: $transaction(async (tx) => { ... })
  $transaction: jest.fn(),
};

// ─── Fixtures ──────────────────────────────────────────────────────────────

const CLAN_ID = 'clan-001';
const LEADER_ID = 'user-leader';
const MEMBER_ID = 'user-member';

const fakeClan = {
  id: CLAN_ID,
  name: 'Iron Legion',
  tag: 'IRL',
  description: 'Test clan',
  logoUrl: null,
  leaderId: LEADER_ID,
  gold: 0,
  points: 1000,
  isOpen: true,
  minMmr: 0,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  _count: { members: 1 },
};

const fakeMember = {
  id: 'cm-001',
  clanId: CLAN_ID,
  userId: MEMBER_ID,
  role: 'member',
  joinedAt: new Date('2026-01-02'),
};

// ─── Suite ─────────────────────────────────────────────────────────────────

describe('ClanService', () => {
  let service: ClanService;

  beforeEach(async () => {
    jest.resetAllMocks();

    // Rebuild tx mock after resetAllMocks wipes the previous fns
    tx = makeTxMock();

    // Default: $transaction executes the callback with the tx mock
    mockPrisma.$transaction.mockImplementation((cb: (tx: any) => Promise<any>) =>
      cb(tx),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClanService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ClanService>(ClanService);
  });

  // ─── getClanById ─────────────────────────────────────────────────────────

  describe('getClanById()', () => {
    it('returns the clan when found', async () => {
      // Arrange
      mockPrisma.clan.findUnique.mockResolvedValue(fakeClan);

      // Act
      const result = await service.getClanById(CLAN_ID);

      // Assert
      expect(result).toEqual(fakeClan);
      expect(mockPrisma.clan.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: CLAN_ID } }),
      );
    });

    it('throws NotFoundException when clan does not exist', async () => {
      // Arrange
      mockPrisma.clan.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getClanById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException with descriptive message containing the id', async () => {
      // Arrange
      mockPrisma.clan.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getClanById('bad-id')).rejects.toThrow(
        'Clan not found: bad-id',
      );
    });
  });

  // ─── createClan ──────────────────────────────────────────────────────────

  describe('createClan()', () => {
    const createDto: any = {
      name: 'Iron Legion',
      tag: 'irl',          // lowercase — service must uppercase it
      description: 'Test',
      logoUrl: null,
      isOpen: true,
      minMmr: 0,
    };

    it('creates the clan inside a transaction and returns it', async () => {
      // Arrange
      const createdClan = { ...fakeClan, tag: 'IRL' };
      tx.clan.create.mockResolvedValue(createdClan);
      tx.playerProfile.updateMany.mockResolvedValue({ count: 1 });

      // Act
      const result = await service.createClan(LEADER_ID, createDto);

      // Assert
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(result).toEqual(createdClan);
    });

    it('uppercases the tag before persisting', async () => {
      // Arrange
      tx.clan.create.mockResolvedValue(fakeClan);
      tx.playerProfile.updateMany.mockResolvedValue({ count: 1 });

      // Act
      await service.createClan(LEADER_ID, createDto);

      // Assert — the data passed to tx.clan.create must have tag in upper case
      expect(tx.clan.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tag: 'IRL' }),
        }),
      );
    });

    it('adds the leader as a member with role "leader" inside the same create call', async () => {
      // Arrange
      tx.clan.create.mockResolvedValue(fakeClan);
      tx.playerProfile.updateMany.mockResolvedValue({ count: 1 });

      // Act
      await service.createClan(LEADER_ID, createDto);

      // Assert
      expect(tx.clan.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            leaderId: LEADER_ID,
            members: { create: { userId: LEADER_ID, role: 'leader' } },
          }),
        }),
      );
    });

    it('updates the leader PlayerProfile with the new clanId after creation', async () => {
      // Arrange
      const createdClan = { ...fakeClan };
      tx.clan.create.mockResolvedValue(createdClan);
      tx.playerProfile.updateMany.mockResolvedValue({ count: 1 });

      // Act
      await service.createClan(LEADER_ID, createDto);

      // Assert
      expect(tx.playerProfile.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: LEADER_ID },
          data: { clanId: createdClan.id },
        }),
      );
    });

    it('defaults isOpen to true when not provided in dto', async () => {
      // Arrange
      const dtoWithoutIsOpen: any = { name: 'X', tag: 'xx', description: '' };
      tx.clan.create.mockResolvedValue(fakeClan);
      tx.playerProfile.updateMany.mockResolvedValue({ count: 1 });

      // Act
      await service.createClan(LEADER_ID, dtoWithoutIsOpen);

      // Assert
      expect(tx.clan.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isOpen: true }),
        }),
      );
    });

    it('defaults minMmr to 0 when not provided in dto', async () => {
      // Arrange
      const dtoWithoutMmr: any = { name: 'X', tag: 'xx', description: '' };
      tx.clan.create.mockResolvedValue(fakeClan);
      tx.playerProfile.updateMany.mockResolvedValue({ count: 1 });

      // Act
      await service.createClan(LEADER_ID, dtoWithoutMmr);

      // Assert
      expect(tx.clan.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ minMmr: 0 }),
        }),
      );
    });
  });

  // ─── addMember ───────────────────────────────────────────────────────────

  describe('addMember()', () => {
    const addDto: any = { userId: MEMBER_ID, role: 'member' };

    beforeEach(() => {
      // Default: clan exists
      mockPrisma.clan.findUnique.mockResolvedValue(fakeClan);
    });

    it('throws NotFoundException when clan does not exist', async () => {
      // Arrange
      mockPrisma.clan.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.addMember('no-clan', addDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException when user is already a member', async () => {
      // Arrange — findUnique on clanMember returns existing record
      mockPrisma.clanMember.findUnique.mockResolvedValue(fakeMember);

      // Act & Assert
      await expect(service.addMember(CLAN_ID, addDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws ConflictException with "already a member" message', async () => {
      // Arrange
      mockPrisma.clanMember.findUnique.mockResolvedValue(fakeMember);

      // Act & Assert
      await expect(service.addMember(CLAN_ID, addDto)).rejects.toThrow(
        'User is already a member of this clan',
      );
    });

    it('throws BadRequestException when clan has reached the 50-member cap', async () => {
      // Arrange
      mockPrisma.clanMember.findUnique.mockResolvedValue(null); // not already a member
      mockPrisma.clanMember.count.mockResolvedValue(50);        // at cap

      // Act & Assert
      await expect(service.addMember(CLAN_ID, addDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('creates member record and updates PlayerProfile when all checks pass', async () => {
      // Arrange
      mockPrisma.clanMember.findUnique.mockResolvedValue(null);
      mockPrisma.clanMember.count.mockResolvedValue(10);
      tx.clanMember.create.mockResolvedValue(fakeMember);
      tx.playerProfile.updateMany.mockResolvedValue({ count: 1 });

      // Act
      const result = await service.addMember(CLAN_ID, addDto);

      // Assert
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.clanMember.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ clanId: CLAN_ID, userId: MEMBER_ID }),
        }),
      );
      expect(result).toEqual(fakeMember);
    });

    it('defaults role to "member" when dto.role is omitted', async () => {
      // Arrange
      const dtoNoRole: any = { userId: MEMBER_ID };
      mockPrisma.clanMember.findUnique.mockResolvedValue(null);
      mockPrisma.clanMember.count.mockResolvedValue(1);
      tx.clanMember.create.mockResolvedValue(fakeMember);
      tx.playerProfile.updateMany.mockResolvedValue({ count: 1 });

      // Act
      await service.addMember(CLAN_ID, dtoNoRole);

      // Assert
      expect(tx.clanMember.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ role: 'member' }),
        }),
      );
    });

    it('does not exceed cap — member count of 49 is accepted', async () => {
      // Arrange
      mockPrisma.clanMember.findUnique.mockResolvedValue(null);
      mockPrisma.clanMember.count.mockResolvedValue(49); // one below cap
      tx.clanMember.create.mockResolvedValue(fakeMember);
      tx.playerProfile.updateMany.mockResolvedValue({ count: 1 });

      // Act & Assert — must not throw
      await expect(service.addMember(CLAN_ID, addDto)).resolves.not.toThrow();
    });
  });

  // ─── removeMember ────────────────────────────────────────────────────────

  describe('removeMember()', () => {
    it('throws NotFoundException when the member record does not exist', async () => {
      // Arrange
      mockPrisma.clanMember.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.removeMember(CLAN_ID, MEMBER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException with "Member not found" message', async () => {
      // Arrange
      mockPrisma.clanMember.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.removeMember(CLAN_ID, MEMBER_ID)).rejects.toThrow(
        'Member not found in this clan',
      );
    });

    it('deletes the clanMember record when member exists', async () => {
      // Arrange
      mockPrisma.clanMember.findUnique.mockResolvedValue(fakeMember);
      tx.clanMember.delete.mockResolvedValue(fakeMember);
      tx.playerProfile.updateMany.mockResolvedValue({ count: 1 });

      // Act
      await service.removeMember(CLAN_ID, MEMBER_ID);

      // Assert
      expect(tx.clanMember.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { clanId_userId: { clanId: CLAN_ID, userId: MEMBER_ID } },
        }),
      );
    });

    it('clears clanId on the PlayerProfile after member deletion', async () => {
      // Arrange
      mockPrisma.clanMember.findUnique.mockResolvedValue(fakeMember);
      tx.clanMember.delete.mockResolvedValue(fakeMember);
      tx.playerProfile.updateMany.mockResolvedValue({ count: 1 });

      // Act
      await service.removeMember(CLAN_ID, MEMBER_ID);

      // Assert
      expect(tx.playerProfile.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: MEMBER_ID, clanId: CLAN_ID },
          data: { clanId: null },
        }),
      );
    });

    it('executes delete and profile update inside a single transaction', async () => {
      // Arrange
      mockPrisma.clanMember.findUnique.mockResolvedValue(fakeMember);
      tx.clanMember.delete.mockResolvedValue(fakeMember);
      tx.playerProfile.updateMany.mockResolvedValue({ count: 1 });

      // Act
      await service.removeMember(CLAN_ID, MEMBER_ID);

      // Assert
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  // ─── disbandClan ─────────────────────────────────────────────────────────

  describe('disbandClan()', () => {
    it('throws NotFoundException when clan does not exist', async () => {
      // Arrange
      mockPrisma.clan.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.disbandClan('no-clan')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('clears clanId on all member PlayerProfiles before deleting members', async () => {
      // Arrange
      mockPrisma.clan.findUnique.mockResolvedValue(fakeClan);
      const members = [{ userId: LEADER_ID }, { userId: MEMBER_ID }];
      tx.clanMember.findMany.mockResolvedValue(members);
      tx.playerProfile.updateMany.mockResolvedValue({ count: 2 });
      tx.clanMember.deleteMany.mockResolvedValue({ count: 2 });
      tx.clan.delete.mockResolvedValue(fakeClan);

      // Act
      await service.disbandClan(CLAN_ID);

      // Assert
      expect(tx.playerProfile.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: { in: [LEADER_ID, MEMBER_ID] } },
          data: { clanId: null },
        }),
      );
    });

    it('deletes all ClanMember records for the clan', async () => {
      // Arrange
      mockPrisma.clan.findUnique.mockResolvedValue(fakeClan);
      tx.clanMember.findMany.mockResolvedValue([{ userId: LEADER_ID }]);
      tx.playerProfile.updateMany.mockResolvedValue({ count: 1 });
      tx.clanMember.deleteMany.mockResolvedValue({ count: 1 });
      tx.clan.delete.mockResolvedValue(fakeClan);

      // Act
      await service.disbandClan(CLAN_ID);

      // Assert
      expect(tx.clanMember.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { clanId: CLAN_ID } }),
      );
    });

    it('deletes the Clan record last', async () => {
      // Arrange
      mockPrisma.clan.findUnique.mockResolvedValue(fakeClan);
      tx.clanMember.findMany.mockResolvedValue([{ userId: LEADER_ID }]);
      tx.playerProfile.updateMany.mockResolvedValue({ count: 1 });
      tx.clanMember.deleteMany.mockResolvedValue({ count: 1 });
      tx.clan.delete.mockResolvedValue(fakeClan);

      // Act
      await service.disbandClan(CLAN_ID);

      // Assert
      expect(tx.clan.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: CLAN_ID } }),
      );
    });

    it('executes the full disband sequence inside a single transaction', async () => {
      // Arrange
      mockPrisma.clan.findUnique.mockResolvedValue(fakeClan);
      tx.clanMember.findMany.mockResolvedValue([{ userId: LEADER_ID }]);
      tx.playerProfile.updateMany.mockResolvedValue({ count: 1 });
      tx.clanMember.deleteMany.mockResolvedValue({ count: 1 });
      tx.clan.delete.mockResolvedValue(fakeClan);

      // Act
      await service.disbandClan(CLAN_ID);

      // Assert
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('handles a clan with zero members without throwing', async () => {
      // Arrange — edge case: clan exists but has no members (should not crash)
      mockPrisma.clan.findUnique.mockResolvedValue(fakeClan);
      tx.clanMember.findMany.mockResolvedValue([]);           // no members
      tx.playerProfile.updateMany.mockResolvedValue({ count: 0 });
      tx.clanMember.deleteMany.mockResolvedValue({ count: 0 });
      tx.clan.delete.mockResolvedValue(fakeClan);

      // Act & Assert
      await expect(service.disbandClan(CLAN_ID)).resolves.not.toThrow();
    });

    it('removes the Clan record (no status field — disband is a hard delete)', async () => {
      // Arrange — guard against accidental "set status = disbanded" interpretation;
      // the service performs an irreversible delete, not a soft-delete.
      mockPrisma.clan.findUnique.mockResolvedValue(fakeClan);
      tx.clanMember.findMany.mockResolvedValue([{ userId: LEADER_ID }]);
      tx.playerProfile.updateMany.mockResolvedValue({ count: 1 });
      tx.clanMember.deleteMany.mockResolvedValue({ count: 1 });
      tx.clan.delete.mockResolvedValue(fakeClan);

      // Act
      await service.disbandClan(CLAN_ID);

      // Assert — clan.update (soft-delete) must NOT be called; clan.delete must be.
      expect(tx.clan.update).not.toHaveBeenCalled();
      expect(tx.clan.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: CLAN_ID } }),
      );
    });
  });

  // ─── getClans ────────────────────────────────────────────────────────────

  describe('getClans()', () => {
    it('returns paginated clans with total count', async () => {
      // Arrange
      mockPrisma.clan.findMany.mockResolvedValue([fakeClan]);
      mockPrisma.clan.count.mockResolvedValue(1);

      // Act
      const result = await service.getClans(1, 10);

      // Assert
      expect(result).toEqual({ items: [fakeClan], total: 1, page: 1, limit: 10 });
    });

    it('applies search filter to both name and tag fields', async () => {
      // Arrange
      mockPrisma.clan.findMany.mockResolvedValue([fakeClan]);
      mockPrisma.clan.count.mockResolvedValue(1);

      // Act
      await service.getClans(1, 10, 'iron');

      // Assert — both findMany and count must receive the OR where clause
      const expectedWhere = {
        OR: [
          { name: { contains: 'iron', mode: 'insensitive' } },
          { tag: { contains: 'iron', mode: 'insensitive' } },
        ],
      };
      expect(mockPrisma.clan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
      expect(mockPrisma.clan.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
    });

    it('uses empty where clause when search is omitted', async () => {
      // Arrange
      mockPrisma.clan.findMany.mockResolvedValue([]);
      mockPrisma.clan.count.mockResolvedValue(0);

      // Act
      await service.getClans(2, 5);

      // Assert — no OR filter
      expect(mockPrisma.clan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it('calculates skip correctly for page > 1', async () => {
      // Arrange
      mockPrisma.clan.findMany.mockResolvedValue([]);
      mockPrisma.clan.count.mockResolvedValue(0);

      // Act
      await service.getClans(3, 10);

      // Assert — page 3, limit 10 → skip 20
      expect(mockPrisma.clan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });
  });

  // ─── updateClan ──────────────────────────────────────────────────────────

  describe('updateClan()', () => {
    it('throws NotFoundException when the clan does not exist', async () => {
      // Arrange
      mockPrisma.clan.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.updateClan('no-clan', {} as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns the updated clan on success', async () => {
      // Arrange
      const updatedClan = { ...fakeClan, description: 'New description' };
      mockPrisma.clan.findUnique.mockResolvedValue(fakeClan);
      mockPrisma.clan.update.mockResolvedValue(updatedClan);

      // Act
      const result = await service.updateClan(CLAN_ID, { description: 'New description' } as any);

      // Assert
      expect(result).toEqual(updatedClan);
    });

    it('passes only permitted mutable fields to clan.update', async () => {
      // Arrange
      mockPrisma.clan.findUnique.mockResolvedValue(fakeClan);
      mockPrisma.clan.update.mockResolvedValue(fakeClan);
      const dto: any = { description: 'Updated', isOpen: false, minMmr: 500, logoUrl: 'http://img' };

      // Act
      await service.updateClan(CLAN_ID, dto);

      // Assert — immutable fields (name, tag, leaderId) must not appear in data
      expect(mockPrisma.clan.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: CLAN_ID },
          data: { description: 'Updated', isOpen: false, minMmr: 500, logoUrl: 'http://img' },
        }),
      );
    });
  });

  // ─── getMembers ──────────────────────────────────────────────────────────

  describe('getMembers()', () => {
    it('throws NotFoundException when the clan does not exist', async () => {
      // Arrange
      mockPrisma.clan.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getMembers('no-clan')).rejects.toThrow(NotFoundException);
    });

    it('returns all member records for the clan ordered by role then joinedAt', async () => {
      // Arrange
      const members = [fakeMember, { ...fakeMember, id: 'cm-002', role: 'officer' }];
      mockPrisma.clan.findUnique.mockResolvedValue(fakeClan);
      mockPrisma.clanMember.findMany.mockResolvedValue(members);

      // Act
      const result = await service.getMembers(CLAN_ID);

      // Assert
      expect(result).toEqual(members);
      expect(mockPrisma.clanMember.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { clanId: CLAN_ID },
          orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
        }),
      );
    });
  });

  // ─── promoteMember ───────────────────────────────────────────────────────

  describe('promoteMember()', () => {
    it('throws NotFoundException when the member does not exist', async () => {
      // Arrange
      mockPrisma.clanMember.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.promoteMember(CLAN_ID, MEMBER_ID, { role: 'officer' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException with "Member not found" when member is missing', async () => {
      // Arrange
      mockPrisma.clanMember.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.promoteMember(CLAN_ID, MEMBER_ID, { role: 'officer' }),
      ).rejects.toThrow('Member not found in this clan');
    });

    it('updates role directly (no transaction) when promoting to a non-leader role', async () => {
      // Arrange
      mockPrisma.clanMember.findUnique.mockResolvedValue(fakeMember);
      mockPrisma.clanMember.update.mockResolvedValue({ ...fakeMember, role: 'officer' });

      // Act
      const result = await service.promoteMember(CLAN_ID, MEMBER_ID, { role: 'officer' });

      // Assert — no transaction needed for non-leader promotions
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockPrisma.clanMember.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { clanId_userId: { clanId: CLAN_ID, userId: MEMBER_ID } },
          data: { role: 'officer' },
        }),
      );
      expect(result).toMatchObject({ role: 'officer' });
    });

    it('demotes old leader to officer when promoting a new leader', async () => {
      // Arrange
      mockPrisma.clanMember.findUnique.mockResolvedValue(fakeMember);
      mockPrisma.clan.findUnique.mockResolvedValue(fakeClan); // getClanById inside promoteMember
      tx.clanMember.updateMany.mockResolvedValue({ count: 1 });
      tx.clanMember.update.mockResolvedValue({ ...fakeMember, role: 'leader' });
      tx.clan.update.mockResolvedValue({ ...fakeClan, leaderId: MEMBER_ID });

      // Act
      await service.promoteMember(CLAN_ID, MEMBER_ID, { role: 'leader' });

      // Assert — old leader (LEADER_ID) must be demoted to officer
      expect(tx.clanMember.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { clanId: CLAN_ID, userId: LEADER_ID },
          data: { role: 'officer' },
        }),
      );
    });

    it('updates Clan.leaderId to the new leader when promoting', async () => {
      // Arrange
      mockPrisma.clanMember.findUnique.mockResolvedValue(fakeMember);
      mockPrisma.clan.findUnique.mockResolvedValue(fakeClan);
      tx.clanMember.updateMany.mockResolvedValue({ count: 1 });
      tx.clanMember.update.mockResolvedValue({ ...fakeMember, role: 'leader' });
      tx.clan.update.mockResolvedValue({ ...fakeClan, leaderId: MEMBER_ID });

      // Act
      await service.promoteMember(CLAN_ID, MEMBER_ID, { role: 'leader' });

      // Assert — clan.leaderId must point to the newly promoted member
      expect(tx.clan.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: CLAN_ID },
          data: { leaderId: MEMBER_ID },
        }),
      );
    });

    it('executes leader transfer inside a single transaction', async () => {
      // Arrange
      mockPrisma.clanMember.findUnique.mockResolvedValue(fakeMember);
      mockPrisma.clan.findUnique.mockResolvedValue(fakeClan);
      tx.clanMember.updateMany.mockResolvedValue({ count: 1 });
      tx.clanMember.update.mockResolvedValue({ ...fakeMember, role: 'leader' });
      tx.clan.update.mockResolvedValue({ ...fakeClan, leaderId: MEMBER_ID });

      // Act
      await service.promoteMember(CLAN_ID, MEMBER_ID, { role: 'leader' });

      // Assert
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('edge case: promoting a member to the role they already hold (non-leader) still succeeds', async () => {
      // Arrange — member is already an officer; re-promoting to officer is a no-op but valid
      const officerMember = { ...fakeMember, role: 'officer' };
      mockPrisma.clanMember.findUnique.mockResolvedValue(officerMember);
      mockPrisma.clanMember.update.mockResolvedValue(officerMember);

      // Act & Assert — service has no idempotency guard; must not throw
      await expect(
        service.promoteMember(CLAN_ID, MEMBER_ID, { role: 'officer' }),
      ).resolves.not.toThrow();
    });
  });

  // ─── getClanWars ─────────────────────────────────────────────────────────

  describe('getClanWars()', () => {
    it('throws NotFoundException when the clan does not exist', async () => {
      // Arrange
      mockPrisma.clan.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getClanWars('no-clan')).rejects.toThrow(NotFoundException);
    });

    it('returns wars where the clan is either the initiator or the opponent', async () => {
      // Arrange
      const war = {
        id: 'war-001',
        clanId: CLAN_ID,
        opponentId: 'clan-002',
        status: 'active',
        startedAt: new Date(),
        endedAt: null,
      };
      mockPrisma.clan.findUnique.mockResolvedValue(fakeClan);
      mockPrisma.clanWar.findMany.mockResolvedValue([war]);

      // Act
      const result = await service.getClanWars(CLAN_ID);

      // Assert
      expect(result).toEqual([war]);
      expect(mockPrisma.clanWar.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [{ clanId: CLAN_ID }, { opponentId: CLAN_ID }],
          },
          orderBy: { startedAt: 'desc' },
        }),
      );
    });

    it('returns an empty array when the clan has no wars', async () => {
      // Arrange
      mockPrisma.clan.findUnique.mockResolvedValue(fakeClan);
      mockPrisma.clanWar.findMany.mockResolvedValue([]);

      // Act
      const result = await service.getClanWars(CLAN_ID);

      // Assert
      expect(result).toEqual([]);
    });
  });

  // ─── createClanWar ───────────────────────────────────────────────────────

  describe('createClanWar()', () => {
    const OPPONENT_ID = 'clan-002';

    const fakeOpponent = {
      ...fakeClan,
      id: OPPONENT_ID,
      name: 'Stone Guard',
      tag: 'STG',
      leaderId: 'user-other-leader',
    };

    const warDto: any = { clanId: CLAN_ID, opponentId: OPPONENT_ID };

    beforeEach(() => {
      // Default: both clans exist, no active war
      mockPrisma.clan.findUnique.mockImplementation((args: any) => {
        if (args.where.id === CLAN_ID) return Promise.resolve(fakeClan);
        if (args.where.id === OPPONENT_ID) return Promise.resolve(fakeOpponent);
        return Promise.resolve(null);
      });
      mockPrisma.clanWar.findFirst.mockResolvedValue(null);
    });

    it('throws BadRequestException when a clan declares war on itself', async () => {
      // Act & Assert
      await expect(
        service.createClanWar({ clanId: CLAN_ID, opponentId: CLAN_ID }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException with "cannot declare war on itself" message', async () => {
      // Act & Assert
      await expect(
        service.createClanWar({ clanId: CLAN_ID, opponentId: CLAN_ID }),
      ).rejects.toThrow('A clan cannot declare war on itself');
    });

    it('throws NotFoundException when either clan does not exist', async () => {
      // Arrange — override: initiating clan missing
      mockPrisma.clan.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.createClanWar(warDto)).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when an active war already exists between the two clans', async () => {
      // Arrange
      mockPrisma.clanWar.findFirst.mockResolvedValue({
        id: 'war-existing',
        clanId: CLAN_ID,
        opponentId: OPPONENT_ID,
        status: 'active',
      });

      // Act & Assert
      await expect(service.createClanWar(warDto)).rejects.toThrow(ConflictException);
    });

    it('creates a war with status "active" and returns the record', async () => {
      // Arrange
      const createdWar = {
        id: 'war-001',
        clanId: CLAN_ID,
        opponentId: OPPONENT_ID,
        status: 'active',
        startedAt: new Date(),
        endedAt: null,
      };
      mockPrisma.clanWar.create.mockResolvedValue(createdWar);

      // Act
      const result = await service.createClanWar(warDto);

      // Assert
      expect(result).toEqual(createdWar);
      expect(mockPrisma.clanWar.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            clanId: CLAN_ID,
            opponentId: OPPONENT_ID,
            status: 'active',
          }),
        }),
      );
    });

    it('converts endedAt ISO string to a Date object when provided', async () => {
      // Arrange
      const endIso = '2026-12-31T23:59:59.000Z';
      const dtoWithEnd: any = { ...warDto, endedAt: endIso };
      mockPrisma.clanWar.create.mockResolvedValue({ id: 'war-002', status: 'active' });

      // Act
      await service.createClanWar(dtoWithEnd);

      // Assert
      expect(mockPrisma.clanWar.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ endedAt: new Date(endIso) }),
        }),
      );
    });

    it('edge case: also detects an active war when the opponent is listed as clanId (reverse order)', async () => {
      // Arrange — existing war has the clans in reverse order
      mockPrisma.clanWar.findFirst.mockResolvedValue({
        id: 'war-reverse',
        clanId: OPPONENT_ID,
        opponentId: CLAN_ID,
        status: 'active',
      });

      // Act & Assert — ConflictException must fire regardless of war direction
      await expect(service.createClanWar(warDto)).rejects.toThrow(ConflictException);
    });
  });
});
