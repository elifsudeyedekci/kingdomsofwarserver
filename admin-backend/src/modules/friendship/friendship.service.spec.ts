import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { FriendshipStatus } from '@prisma/client';
import { FriendshipService } from './friendship.service';
import { PrismaService } from '../../database/prisma.service';

// ---------------------------------------------------------------------------
// Story Type : Logic
// Output     : src/modules/friendship/friendship.service.spec.ts
// Gate Level : BLOCKING
// ---------------------------------------------------------------------------

const mockPrisma: any = {
  friendship: {
    findMany:  jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create:    jest.fn(),
    delete:    jest.fn(),
    deleteMany: jest.fn(),
    count:     jest.fn(),
    upsert:    jest.fn(),
  },
  friendRequest: {
    findMany:  jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create:    jest.fn(),
    delete:    jest.fn(),
    deleteMany: jest.fn(),
  },
  $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
};

describe('FriendshipService', () => {
  let service: FriendshipService;

  beforeEach(async () => {
    jest.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FriendshipService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<FriendshipService>(FriendshipService);
  });

  // -------------------------------------------------------------------------
  // sendFriendRequest
  // -------------------------------------------------------------------------
  describe('sendFriendRequest()', () => {
    const FROM = 'user-aaa';
    const TO   = 'user-bbb';

    it('throws BadRequestException when sender and receiver are the same user', async () => {
      // Arrange — no Prisma calls expected; guard fires first
      // Act + Assert
      await expect(service.sendFriendRequest(FROM, FROM)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrisma.friendship.findFirst).not.toHaveBeenCalled();
    });

    it('throws ConflictException when an accepted friendship already exists', async () => {
      // Arrange
      mockPrisma.friendship.findFirst.mockResolvedValueOnce({
        id: 'fs-1',
        requesterId: FROM,
        receiverId: TO,
        status: FriendshipStatus.accepted,
      });

      // Act + Assert
      await expect(service.sendFriendRequest(FROM, TO)).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrisma.friendRequest.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException when a pending request already exists in either direction', async () => {
      // Arrange — first findFirst (accepted check) returns null; second (pending check) returns row
      mockPrisma.friendship.findFirst.mockResolvedValueOnce(null);
      mockPrisma.friendRequest.findFirst.mockResolvedValueOnce({
        id: 'fr-1',
        fromPlayerId: TO,
        toPlayerId: FROM,
        status: 'pending',
      });

      // Act + Assert
      await expect(service.sendFriendRequest(FROM, TO)).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrisma.friendRequest.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException when sender or receiver has a block record', async () => {
      // Arrange — accepted check null, pending check null, block check returns row
      mockPrisma.friendship.findFirst
        .mockResolvedValueOnce(null)   // accepted friendship
        .mockResolvedValueOnce({       // blocked friendship
          id: 'fs-block',
          requesterId: TO,
          receiverId: FROM,
          status: FriendshipStatus.blocked,
        });
      mockPrisma.friendRequest.findFirst.mockResolvedValueOnce(null);

      // Act + Assert
      await expect(service.sendFriendRequest(FROM, TO)).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrisma.friendRequest.create).not.toHaveBeenCalled();
    });

    it('creates and returns the friend request when all guards pass', async () => {
      // Arrange
      const created = { id: 'fr-new', fromPlayerId: FROM, toPlayerId: TO, status: 'pending' };
      mockPrisma.friendship.findFirst.mockResolvedValue(null);   // accepted + blocked both null
      mockPrisma.friendRequest.findFirst.mockResolvedValue(null);
      mockPrisma.friendRequest.create.mockResolvedValue(created);

      // Act
      const result = await service.sendFriendRequest(FROM, TO);

      // Assert
      expect(result).toEqual(created);
      expect(mockPrisma.friendRequest.create).toHaveBeenCalledWith({
        data: { fromPlayerId: FROM, toPlayerId: TO, status: 'pending' },
      });
    });
  });

  // -------------------------------------------------------------------------
  // acceptFriendRequest
  // -------------------------------------------------------------------------
  describe('acceptFriendRequest()', () => {
    const REQUEST_ID = 'fr-req-1';
    const RECEIVER   = 'user-bbb';
    const SENDER     = 'user-aaa';

    const pendingRequest = {
      id: REQUEST_ID,
      fromPlayerId: SENDER,
      toPlayerId: RECEIVER,
      status: 'pending',
    };

    it('throws NotFoundException when the request does not exist', async () => {
      // Arrange
      mockPrisma.friendRequest.findUnique.mockResolvedValue(null);

      // Act + Assert
      await expect(service.acceptFriendRequest(REQUEST_ID, RECEIVER)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when the request is not in pending status', async () => {
      // Arrange
      mockPrisma.friendRequest.findUnique.mockResolvedValue({
        ...pendingRequest,
        status: 'declined',
      });

      // Act + Assert
      await expect(service.acceptFriendRequest(REQUEST_ID, RECEIVER)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when the caller is not the receiver', async () => {
      // Arrange
      mockPrisma.friendRequest.findUnique.mockResolvedValue(pendingRequest);

      // Act + Assert — SENDER tries to accept their own outgoing request
      await expect(service.acceptFriendRequest(REQUEST_ID, SENDER)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('creates a Friendship with status accepted and returns it', async () => {
      // Arrange
      const friendship = {
        id: 'fs-new',
        requesterId: SENDER,
        receiverId: RECEIVER,
        status: FriendshipStatus.accepted,
        createdAt: new Date(),
      };
      mockPrisma.friendRequest.findUnique.mockResolvedValue(pendingRequest);
      // $transaction resolves ops in order: [friendship.create, friendRequest.delete]
      mockPrisma.$transaction.mockResolvedValue([friendship, { id: REQUEST_ID }]);

      // Act
      const result = await service.acceptFriendRequest(REQUEST_ID, RECEIVER);

      // Assert
      expect(result.status).toBe(FriendshipStatus.accepted);
      expect(result.requesterId).toBe(SENDER);
      expect(result.receiverId).toBe(RECEIVER);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // declineRequest
  // -------------------------------------------------------------------------
  describe('declineRequest()', () => {
    const REQUEST_ID = 'fr-req-2';
    const SENDER     = 'user-aaa';
    const RECEIVER   = 'user-bbb';
    const STRANGER   = 'user-zzz';

    const pendingRequest = {
      id: REQUEST_ID,
      fromPlayerId: SENDER,
      toPlayerId: RECEIVER,
      status: 'pending',
    };

    it('throws NotFoundException when the request does not exist', async () => {
      // Arrange
      mockPrisma.friendRequest.findUnique.mockResolvedValue(null);

      // Act + Assert
      await expect(service.declineRequest(REQUEST_ID, RECEIVER)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when the caller is not a participant', async () => {
      // Arrange
      mockPrisma.friendRequest.findUnique.mockResolvedValue(pendingRequest);

      // Act + Assert
      await expect(service.declineRequest(REQUEST_ID, STRANGER)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrisma.friendRequest.delete).not.toHaveBeenCalled();
    });

    it('deletes the request and returns success message when called by the receiver', async () => {
      // Arrange
      mockPrisma.friendRequest.findUnique.mockResolvedValue(pendingRequest);
      mockPrisma.friendRequest.delete.mockResolvedValue(pendingRequest);

      // Act
      const result = await service.declineRequest(REQUEST_ID, RECEIVER);

      // Assert
      expect(result).toEqual({ message: 'Friend request declined.' });
      expect(mockPrisma.friendRequest.delete).toHaveBeenCalledWith({
        where: { id: REQUEST_ID },
      });
    });

    it('deletes the request and returns success message when called by the sender', async () => {
      // Arrange
      mockPrisma.friendRequest.findUnique.mockResolvedValue(pendingRequest);
      mockPrisma.friendRequest.delete.mockResolvedValue(pendingRequest);

      // Act
      const result = await service.declineRequest(REQUEST_ID, SENDER);

      // Assert
      expect(result).toEqual({ message: 'Friend request declined.' });
      expect(mockPrisma.friendRequest.delete).toHaveBeenCalledWith({
        where: { id: REQUEST_ID },
      });
    });
  });

  // -------------------------------------------------------------------------
  // removeFriend
  // -------------------------------------------------------------------------
  describe('removeFriend()', () => {
    const USER_ID   = 'user-aaa';
    const FRIEND_ID = 'user-bbb';

    const friendship = {
      id: 'fs-abc',
      requesterId: USER_ID,
      receiverId: FRIEND_ID,
      status: FriendshipStatus.accepted,
    };

    it('throws NotFoundException when no accepted friendship exists', async () => {
      // Arrange
      mockPrisma.friendship.findFirst.mockResolvedValue(null);

      // Act + Assert
      await expect(service.removeFriend(USER_ID, FRIEND_ID)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.friendship.delete).not.toHaveBeenCalled();
    });

    it('deletes the friendship row and returns success message', async () => {
      // Arrange
      mockPrisma.friendship.findFirst.mockResolvedValue(friendship);
      mockPrisma.friendship.delete.mockResolvedValue(friendship);

      // Act
      const result = await service.removeFriend(USER_ID, FRIEND_ID);

      // Assert
      expect(result).toEqual({ message: 'Friend removed successfully.' });
      expect(mockPrisma.friendship.delete).toHaveBeenCalledWith({
        where: { id: friendship.id },
      });
    });

    it('removes the friendship regardless of which side initiated it (reverse direction)', async () => {
      // Arrange — friendship stored with FRIEND_ID as requester
      const reverseFriendship = {
        ...friendship,
        requesterId: FRIEND_ID,
        receiverId: USER_ID,
      };
      mockPrisma.friendship.findFirst.mockResolvedValue(reverseFriendship);
      mockPrisma.friendship.delete.mockResolvedValue(reverseFriendship);

      // Act
      const result = await service.removeFriend(USER_ID, FRIEND_ID);

      // Assert
      expect(result).toEqual({ message: 'Friend removed successfully.' });
      expect(mockPrisma.friendship.delete).toHaveBeenCalledWith({
        where: { id: reverseFriendship.id },
      });
    });
  });

  // -------------------------------------------------------------------------
  // getFriends
  // -------------------------------------------------------------------------
  describe('getFriends()', () => {
    const USER_ID = 'user-aaa';

    it('returns an empty array when the user has no accepted friends', async () => {
      // Arrange
      mockPrisma.friendship.findMany.mockResolvedValue([]);

      // Act
      const result = await service.getFriends(USER_ID);

      // Assert
      expect(result).toEqual([]);
    });

    it('returns normalised friend objects with the "other" user in each row', async () => {
      // Arrange
      const requesterProfile = { id: USER_ID, profile: { username: 'alpha', displayName: 'Alpha', avatarUrl: null, level: 10, mmr: 1200, currentRank: 'Gold' } };
      const receiverProfile  = { id: 'user-bbb', profile: { username: 'beta', displayName: 'Beta', avatarUrl: null, level: 5, mmr: 900, currentRank: 'Silver' } };

      const friendships = [
        {
          id: 'fs-1',
          requesterId: USER_ID,
          receiverId: 'user-bbb',
          status: FriendshipStatus.accepted,
          createdAt: new Date('2026-01-01'),
          requester: requesterProfile,
          receiver: receiverProfile,
        },
      ];
      mockPrisma.friendship.findMany.mockResolvedValue(friendships);

      // Act
      const result = await service.getFriends(USER_ID);

      // Assert — when USER_ID is requester, the returned "user" must be the receiver
      expect(result).toHaveLength(1);
      expect(result[0]!.friendshipId).toBe('fs-1');
      expect(result[0]!.user.id).toBe('user-bbb');
      expect(result[0]!.user.profile!.username).toBe('beta');
    });

    it('returns the requester as the friend when the user is the receiver side', async () => {
      // Arrange — USER_ID is on the receiver side of the stored row
      const senderProfile   = { id: 'user-zzz', profile: { username: 'zeta', displayName: 'Zeta', avatarUrl: null, level: 20, mmr: 1500, currentRank: 'Diamond' } };
      const receiverProfile = { id: USER_ID, profile: { username: 'alpha', displayName: 'Alpha', avatarUrl: null, level: 10, mmr: 1200, currentRank: 'Gold' } };

      const friendships = [
        {
          id: 'fs-2',
          requesterId: 'user-zzz',
          receiverId: USER_ID,
          status: FriendshipStatus.accepted,
          createdAt: new Date('2026-02-01'),
          requester: senderProfile,
          receiver: receiverProfile,
        },
      ];
      mockPrisma.friendship.findMany.mockResolvedValue(friendships);

      // Act
      const result = await service.getFriends(USER_ID);

      // Assert — when USER_ID is receiver, the returned "user" must be the requester
      expect(result).toHaveLength(1);
      expect(result[0]!.user.id).toBe('user-zzz');
      expect(result[0]!.user.profile!.username).toBe('zeta');
    });

    it('queries only accepted friendships where userId appears on either side', async () => {
      // Arrange
      mockPrisma.friendship.findMany.mockResolvedValue([]);

      // Act
      await service.getFriends(USER_ID);

      // Assert — verify the where clause shape passed to Prisma
      expect(mockPrisma.friendship.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: FriendshipStatus.accepted,
            OR: expect.arrayContaining([
              { requesterId: USER_ID },
              { receiverId: USER_ID },
            ]),
          }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // getPendingRequests
  // -------------------------------------------------------------------------
  describe('getPendingRequests()', () => {
    const USER_ID = 'user-aaa';
    const OTHER_ID = 'user-bbb';

    it('returns an empty array when there are no pending requests in either direction', async () => {
      // Arrange
      mockPrisma.friendRequest.findMany.mockResolvedValue([]);

      // Act
      const result = await service.getPendingRequests(USER_ID);

      // Assert
      expect(result).toEqual([]);
    });

    it('returns sent requests with direction "sent" and received requests with direction "received"', async () => {
      // Arrange
      const sentRequest = {
        id: 'fr-sent-1',
        fromPlayerId: USER_ID,
        toPlayerId: OTHER_ID,
        status: 'pending',
        createdAt: new Date('2026-01-10T10:00:00Z'),
      };
      const receivedRequest = {
        id: 'fr-recv-1',
        fromPlayerId: OTHER_ID,
        toPlayerId: USER_ID,
        status: 'pending',
        createdAt: new Date('2026-01-11T10:00:00Z'),
      };
      mockPrisma.friendRequest.findMany.mockResolvedValue([sentRequest, receivedRequest]);

      // Act
      const result = await service.getPendingRequests(USER_ID);

      // Assert
      const sent = result.find((r: any) => r.requestId === 'fr-sent-1');
      const received = result.find((r: any) => r.requestId === 'fr-recv-1');
      expect(sent?.direction).toBe('sent');
      expect(received?.direction).toBe('received');
    });
  });

  // -------------------------------------------------------------------------
  // blockUser
  // -------------------------------------------------------------------------
  describe('blockUser()', () => {
    const BLOCKER_ID = 'user-aaa';
    const TARGET_ID = 'user-bbb';

    it('throws BadRequestException when a user attempts to block themselves', async () => {
      // Arrange — guard fires before any Prisma calls
      // Act + Assert
      await expect(service.blockUser(BLOCKER_ID, BLOCKER_ID)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrisma.friendRequest.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.friendship.upsert).not.toHaveBeenCalled();
    });

    it('deletes any pending friend requests between the two users before creating the block', async () => {
      // Arrange
      mockPrisma.friendRequest.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.friendship.upsert.mockResolvedValue({
        id: 'fs-block-1',
        requesterId: BLOCKER_ID,
        receiverId: TARGET_ID,
        status: FriendshipStatus.blocked,
      });

      // Act
      await service.blockUser(BLOCKER_ID, TARGET_ID);

      // Assert — deleteMany must be called before upsert
      expect(mockPrisma.friendRequest.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.friendship.upsert).toHaveBeenCalled();
    });

    it('creates a Friendship record with "blocked" status', async () => {
      // Arrange
      mockPrisma.friendRequest.deleteMany.mockResolvedValue({ count: 0 });
      const blockedRecord = {
        id: 'fs-block-2',
        requesterId: BLOCKER_ID,
        receiverId: TARGET_ID,
        status: FriendshipStatus.blocked,
      };
      mockPrisma.friendship.upsert.mockResolvedValue(blockedRecord);

      // Act
      const result = await service.blockUser(BLOCKER_ID, TARGET_ID);

      // Assert
      expect(result.status).toBe(FriendshipStatus.blocked);
      expect(mockPrisma.friendship.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ status: FriendshipStatus.blocked }),
          update: expect.objectContaining({ status: FriendshipStatus.blocked }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // getFriendCount
  // -------------------------------------------------------------------------
  describe('getFriendCount()', () => {
    const USER_ID = 'user-aaa';

    it('returns { count: 0 } when the user has no accepted friendships', async () => {
      // Arrange
      mockPrisma.friendship.count.mockResolvedValue(0);

      // Act
      const result = await service.getFriendCount(USER_ID);

      // Assert
      expect(result).toEqual({ count: 0 });
    });

    it('returns { count: N } matching the value returned by Prisma count', async () => {
      // Arrange
      mockPrisma.friendship.count.mockResolvedValue(7);

      // Act
      const result = await service.getFriendCount(USER_ID);

      // Assert
      expect(result).toEqual({ count: 7 });
    });

    it('queries Prisma with only "accepted" status and the user on either side', async () => {
      // Arrange
      mockPrisma.friendship.count.mockResolvedValue(3);

      // Act
      await service.getFriendCount(USER_ID);

      // Assert
      expect(mockPrisma.friendship.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: FriendshipStatus.accepted,
            OR: expect.arrayContaining([
              { requesterId: USER_ID },
              { receiverId: USER_ID },
            ]),
          }),
        }),
      );
    });
  });
});
