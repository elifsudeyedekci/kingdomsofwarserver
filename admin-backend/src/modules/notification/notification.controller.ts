import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Headers,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { BulkNotificationDto, SendNotificationDto } from './dto/send-notification.dto';
import { CreateMailCampaignDto, CreateSmsCampaignDto } from './dto/create-campaign.dto';
import { UpdatePreferenceDto } from './dto/update-preference.dto';

@ApiTags('notification')
@ApiBearerAuth()
@Controller('notification')
export class NotificationController {
  constructor(private readonly service: NotificationService) {}

  // ---------- In-game ----------

  @Post('send')
  @ApiOperation({ summary: 'Send an in-game notification to a user' })
  sendNotification(@Body() dto: SendNotificationDto) {
    return this.service.sendNotification(dto);
  }

  @Post('send-bulk')
  @ApiOperation({ summary: 'Send an in-game notification to multiple users' })
  sendBulkNotification(@Body() dto: BulkNotificationDto) {
    return this.service.sendBulkNotification(dto);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get notifications for a user' })
  @ApiQuery({ name: 'page',       required: false, type: Number })
  @ApiQuery({ name: 'limit',      required: false, type: Number })
  @ApiQuery({ name: 'unreadOnly', required: false, type: Boolean })
  getUserNotifications(
    @Param('userId') userId: string,
    @Query('page',       new DefaultValuePipe(1),     ParseIntPipe)  page: number,
    @Query('limit',      new DefaultValuePipe(20),    ParseIntPipe)  limit: number,
    @Query('unreadOnly', new DefaultValuePipe(false), ParseBoolPipe) unreadOnly: boolean,
  ) {
    return this.service.getUserNotifications(userId, page, Math.min(limit, 100), unreadOnly);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  markAsRead(@Param('id') id: string, @Body('userId') userId: string) {
    return this.service.markAsRead(id, userId);
  }

  @Patch('user/:userId/read-all')
  @ApiOperation({ summary: 'Mark all notifications as read for a user' })
  markAllAsRead(@Param('userId') userId: string) {
    return this.service.markAllAsRead(userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a notification' })
  deleteNotification(@Param('id') id: string, @Query('userId') userId: string) {
    return this.service.deleteNotification(id, userId);
  }

  @Get('user/:userId/unread-count')
  @ApiOperation({ summary: 'Get unread notification count for a user' })
  getUnreadCount(@Param('userId') userId: string) {
    return this.service.getUnreadCount(userId);
  }

  // ---------- Push Tokens ----------

  @Post('push-token')
  @ApiOperation({ summary: 'Register or update a device push token' })
  registerPushToken(@Body() body: { userId: string; deviceId: string; pushToken: string }) {
    return this.service.registerPushToken(body.userId, body.deviceId, body.pushToken);
  }

  // ---------- Mail Campaigns ----------

  @Get('campaigns/mail')
  @ApiOperation({ summary: 'List mail campaigns' })
  @ApiQuery({ name: 'page',   required: false, type: Number })
  @ApiQuery({ name: 'limit',  required: false, type: Number })
  @ApiQuery({ name: 'status', required: false })
  getMailCampaigns(
    @Query('page',  new DefaultValuePipe(1),  ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('status') status?: string,
  ) {
    return this.service.getMailCampaigns(page, Math.min(limit, 100), status);
  }

  @Post('campaigns/mail')
  @ApiOperation({ summary: 'Create a new mail campaign' })
  createMailCampaign(@Body() dto: CreateMailCampaignDto, @Headers('x-admin-id') adminId: string) {
    return this.service.createMailCampaign(dto, adminId);
  }

  @Post('campaigns/mail/:id/send')
  @ApiOperation({ summary: 'Send a mail campaign' })
  sendMailCampaign(@Param('id') id: string) {
    return this.service.sendMailCampaign(id);
  }

  // ---------- SMS Campaigns ----------

  @Get('campaigns/sms')
  @ApiOperation({ summary: 'List SMS campaigns' })
  @ApiQuery({ name: 'page',  required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getSmsCampaigns(
    @Query('page',  new DefaultValuePipe(1),  ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.service.getSmsCampaigns(page, Math.min(limit, 100));
  }

  @Post('campaigns/sms')
  @ApiOperation({ summary: 'Create a new SMS campaign' })
  createSmsCampaign(@Body() dto: CreateSmsCampaignDto, @Headers('x-admin-id') adminId: string) {
    return this.service.createSmsCampaign(dto, adminId);
  }

  @Post('campaigns/sms/:id/send')
  @ApiOperation({ summary: 'Send an SMS campaign' })
  sendSmsCampaign(@Param('id') id: string) {
    return this.service.sendSmsCampaign(id);
  }

  // ---------- Preferences ----------

  @Get('preferences/:userId')
  @ApiOperation({ summary: 'Get communication preferences for a user' })
  getPreferences(@Param('userId') userId: string) {
    return this.service.getPreferences(userId);
  }

  @Patch('preferences/:userId')
  @ApiOperation({ summary: 'Update communication preferences for a user' })
  updatePreferences(@Param('userId') userId: string, @Body() dto: UpdatePreferenceDto) {
    return this.service.updatePreferences(userId, dto);
  }
}
