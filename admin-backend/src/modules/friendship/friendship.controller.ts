import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { BlockUserDto } from './dto/block-user.dto';
import { SendFriendRequestDto } from './dto/send-friend-request.dto';
import { FriendshipService } from './friendship.service';

@ApiTags('friendship')
@ApiBearerAuth()
@Controller('friendship')
export class FriendshipController {
  constructor(private readonly service: FriendshipService) {}

  /**
   * GET /friendship/:userId
   * Returns the accepted friend list for a user.
   */
  @Get(':userId')
  @ApiOperation({ summary: 'Get accepted friends for a user' })
  @ApiParam({ name: 'userId', description: 'Target user UUID' })
  @ApiResponse({ status: 200, description: 'List of accepted friends.' })
  @ApiResponse({ status: 400, description: 'Invalid UUID.' })
  getFriends(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.service.getFriends(userId);
  }

  /**
   * GET /friendship/:userId/pending
   * Returns all pending friend requests (sent and received) for a user.
   */
  @Get(':userId/pending')
  @ApiOperation({ summary: 'Get pending friend requests (sent + received) for a user' })
  @ApiParam({ name: 'userId', description: 'Target user UUID' })
  @ApiResponse({ status: 200, description: 'Pending friend requests.' })
  @ApiResponse({ status: 400, description: 'Invalid UUID.' })
  getPendingRequests(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.service.getPendingRequests(userId);
  }

  /**
   * POST /friendship/request
   * Sends a friend request from one user to another.
   */
  @Post('request')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Send a friend request' })
  @ApiResponse({ status: 201, description: 'Friend request created.' })
  @ApiResponse({ status: 400, description: 'Cannot send request to yourself.' })
  @ApiResponse({ status: 409, description: 'Request already exists or already friends.' })
  sendFriendRequest(@Body() dto: SendFriendRequestDto) {
    return this.service.sendFriendRequest(dto.fromUserId, dto.toUserId);
  }

  /**
   * POST /friendship/:requestId/accept
   * Accepts a pending friend request. The acting user ID is passed in the body.
   */
  @Post(':requestId/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept a pending friend request' })
  @ApiParam({ name: 'requestId', description: 'FriendRequest record UUID' })
  @ApiResponse({ status: 200, description: 'Friend request accepted; friendship created.' })
  @ApiResponse({ status: 400, description: 'Not the intended recipient.' })
  @ApiResponse({ status: 404, description: 'Friend request not found.' })
  acceptFriendRequest(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.service.acceptFriendRequest(requestId, userId);
  }

  /**
   * DELETE /friendship/:requestId
   * Declines (cancels) a pending friend request.
   * The acting user ID is passed as a query param or body field.
   */
  @Delete(':requestId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Decline or cancel a pending friend request' })
  @ApiParam({ name: 'requestId', description: 'FriendRequest record UUID' })
  @ApiResponse({ status: 200, description: 'Friend request declined.' })
  @ApiResponse({ status: 404, description: 'Friend request not found.' })
  declineRequest(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.service.declineRequest(requestId, userId);
  }

  /**
   * DELETE /friendship/:userId/remove/:friendId
   * Removes an accepted friendship between two users.
   */
  @Delete(':userId/remove/:friendId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove an accepted friend' })
  @ApiParam({ name: 'userId', description: 'User initiating the removal' })
  @ApiParam({ name: 'friendId', description: 'Friend user UUID to remove' })
  @ApiResponse({ status: 200, description: 'Friend removed.' })
  @ApiResponse({ status: 404, description: 'Friendship not found.' })
  removeFriend(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('friendId', ParseUUIDPipe) friendId: string,
  ) {
    return this.service.removeFriend(userId, friendId);
  }

  /**
   * POST /friendship/block
   * Blocks a user and removes any existing friendship or pending request.
   * Kept as a separate POST route to avoid route-collision with :requestId/accept.
   */
  @Post('block')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Block a user (removes existing friendship/requests)' })
  @ApiResponse({ status: 200, description: 'User blocked.' })
  @ApiResponse({ status: 400, description: 'Cannot block yourself.' })
  blockUser(@Body() dto: BlockUserDto) {
    return this.service.blockUser(dto.userId, dto.targetId);
  }

  /**
   * GET /friendship/:userId/count
   * Returns the number of accepted friends for a user.
   */
  @Get(':userId/count')
  @ApiOperation({ summary: 'Get accepted friend count for a user' })
  @ApiParam({ name: 'userId', description: 'Target user UUID' })
  @ApiResponse({ status: 200, description: 'Friend count.' })
  getFriendCount(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.service.getFriendCount(userId);
  }
}
