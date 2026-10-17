/**
 * FriendshipService
 *
 * Implements the social friendship system for Kingdoms of War.
 * Manages two Prisma models:
 *  - FriendRequest: pending/declined invitation records (friend_requests table)
 *  - Friendship:    accepted or blocked relationships (friendships table)
 *
 * Flow:
 *  sendFriendRequest  -> creates FriendRequest (status: 'pending')
 *  acceptFriendRequest -> creates Friendship (status: accepted) + deletes FriendRequest
 *  declineRequest     -> deletes FriendRequest
 *  removeFriend       -> deletes Friendship row(s) in both directions
 *  blockUser          -> upserts Friendship with status: blocked + removes any FriendRequest
 */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FriendshipStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class FriendshipService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the list of accepted friends for a given user.
   * Looks up Friendship rows where status = accepted and the user
   * appears on either side of the relationship.
   */
  async getFriends(userId: string) {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        status: FriendshipStatus.accepted,
        OR: [{ requesterId: userId }, { receiverId: userId }],
      },
      include: {
        requester: {
          select: {
            id: true,
            profile: {
              select: {
                username: true,
                displayName: true,
                avatarUrl: true,
                level: true,
                mmr: true,
                currentRank: true,
              },
            },
          },
        },
        receiver: {
          select: {
            id: true,
            profile: {
              select: {
                username: true,
                displayName: true,
                avatarUrl: true,
                level: true,
                mmr: true,
                currentRank: true,
              },
            },
          },
        },
      },
    });

    // Normalise: return the "other" user from each friendship row
    return friendships.map((f) => {
      const friend = f.requesterId === userId ? f.receiver : f.requester;
      return {
        friendshipId: f.id,
        createdAt: f.createdAt,
        user: friend,
      };
    });
  }

  /**
   * Returns all pending FriendRequest rows involving userId —
   * both sent (fromPlayerId) and received (toPlayerId).
   */
  async getPendingRequests(userId: string) {
    const requests = await this.prisma.friendRequest.findMany({
      where: {
        status: 'pending',
        OR: [{ fromPlayerId: userId }, { toPlayerId: userId }],
      },
      include: {
        fromPlayer: {
          select: {
            id: true,
            profile: {
              select: {
                username: true,
                displayName: true,
                avatarUrl: true,
                level: true,
              },
            },
          },
        },
        toPlayer: {
          select: {
            id: true,
            profile: {
              select: {
                username: true,
                displayName: true,
                avatarUrl: true,
                level: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return requests.map((r) => ({
      requestId: r.id,
      direction: r.fromPlayerId === userId ? 'sent' : 'received',
      status: r.status,
      createdAt: r.createdAt,
      from: r.fromPlayer,
      to: r.toPlayer,
    }));
  }

  /**
   * Sends a friend request from fromUserId to toUserId.
   *
   * Guards:
   *  - BadRequestException if the user tries to add themselves
   *  - ConflictException if a pending FriendRequest already exists (either direction)
   *  - ConflictException if an accepted Friendship already exists
   */
  async sendFriendRequest(fromUserId: string, toUserId: string) {
    if (fromUserId === toUserId) {
      throw new BadRequestException('You cannot send a friend request to yourself.');
    }

    // Check for an existing accepted friendship in either direction
    const existingFriendship = await this.prisma.friendship.findFirst({
      where: {
        status: FriendshipStatus.accepted,
        OR: [
          { requesterId: fromUserId, receiverId: toUserId },
          { requesterId: toUserId, receiverId: fromUserId },
        ],
      },
    });

    if (existingFriendship) {
      throw new ConflictException('You are already friends with this user.');
    }

    // Check for an existing pending request in either direction
    const existingRequest = await this.prisma.friendRequest.findFirst({
      where: {
        status: 'pending',
        OR: [
          { fromPlayerId: fromUserId, toPlayerId: toUserId },
          { fromPlayerId: toUserId, toPlayerId: fromUserId },
        ],
      },
    });

    if (existingRequest) {
      throw new ConflictException('A pending friend request already exists between these users.');
    }

    // Check if the target has blocked the sender
    const blocked = await this.prisma.friendship.findFirst({
      where: {
        status: FriendshipStatus.blocked,
        OR: [
          { requesterId: fromUserId, receiverId: toUserId },
          { requesterId: toUserId, receiverId: fromUserId },
        ],
      },
    });

    if (blocked) {
      throw new ConflictException('Unable to send friend request to this user.');
    }

    return this.prisma.friendRequest.create({
      data: {
        fromPlayerId: fromUserId,
        toPlayerId: toUserId,
        status: 'pending',
      },
    });
  }

  /**
   * Accepts a pending FriendRequest identified by requestId.
   * The userId must be the receiver (toPlayerId) of the request.
   *
   * On success:
   *  1. Deletes the FriendRequest row
   *  2. Creates a Friendship row with status: accepted
   */
  async acceptFriendRequest(requestId: string, userId: string) {
    const request = await this.prisma.friendRequest.findUnique({
      where: { id: requestId },
    });

    if (!request || request.status !== 'pending') {
      throw new NotFoundException('Friend request not found or is no longer pending.');
    }

    if (request.toPlayerId !== userId) {
      throw new BadRequestException('You can only accept requests addressed to you.');
    }

    // Use a transaction: delete the request and create the friendship atomically
    const [friendship] = await this.prisma.$transaction([
      this.prisma.friendship.create({
        data: {
          requesterId: request.fromPlayerId,
          receiverId: request.toPlayerId,
          status: FriendshipStatus.accepted,
        },
      }),
      this.prisma.friendRequest.delete({
        where: { id: requestId },
      }),
    ]);

    return friendship;
  }

  /**
   * Declines (deletes) a pending FriendRequest.
   * Both the sender (fromPlayerId) and the receiver (toPlayerId) may decline.
   */
  async declineRequest(requestId: string, userId: string) {
    const request = await this.prisma.friendRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('Friend request not found.');
    }

    if (request.fromPlayerId !== userId && request.toPlayerId !== userId) {
      throw new BadRequestException('You are not a participant in this friend request.');
    }

    await this.prisma.friendRequest.delete({ where: { id: requestId } });

    return { message: 'Friend request declined.' };
  }

  /**
   * Removes an accepted friendship between userId and friendId.
   * Deletes the Friendship row regardless of which side initiated it.
   */
  async removeFriend(userId: string, friendId: string) {
    const friendship = await this.prisma.friendship.findFirst({
      where: {
        status: FriendshipStatus.accepted,
        OR: [
          { requesterId: userId, receiverId: friendId },
          { requesterId: friendId, receiverId: userId },
        ],
      },
    });

    if (!friendship) {
      throw new NotFoundException('Friendship not found.');
    }

    await this.prisma.friendship.delete({ where: { id: friendship.id } });

    return { message: 'Friend removed successfully.' };
  }

  /**
   * Blocks a user.
   *
   * Steps:
   *  1. Remove any existing accepted or pending relationship (both tables)
   *  2. Upsert a Friendship row with status: blocked
   *
   * The block record uses (userId as requesterId, targetId as receiverId).
   */
  async blockUser(userId: string, targetId: string) {
    if (userId === targetId) {
      throw new BadRequestException('You cannot block yourself.');
    }

    // Delete any pending friend requests between the two users
    await this.prisma.friendRequest.deleteMany({
      where: {
        OR: [
          { fromPlayerId: userId, toPlayerId: targetId },
          { fromPlayerId: targetId, toPlayerId: userId },
        ],
      },
    });

    // A friendship row in the opposite direction would survive the unique (requester, receiver) pair: remove it, then upsert the block (idempotent)
    await this.prisma.friendship.deleteMany({ where: { requesterId: targetId, receiverId: userId } });

    const blocked = await this.prisma.friendship.upsert({
      where: { requesterId_receiverId: { requesterId: userId, receiverId: targetId } },
      create: { requesterId: userId, receiverId: targetId, status: FriendshipStatus.blocked },
      update: { status: FriendshipStatus.blocked },
    });

    return blocked;
  }

  /**
   * Returns only the count of accepted friends for a given user.
   * Lightweight query suitable for profile headers etc.
   */
  async getFriendCount(userId: string): Promise<{ count: number }> {
    const count = await this.prisma.friendship.count({
      where: {
        status: FriendshipStatus.accepted,
        OR: [{ requesterId: userId }, { receiverId: userId }],
      },
    });

    return { count };
  }
}
