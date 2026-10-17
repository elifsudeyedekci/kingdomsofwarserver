import { Body, Controller, Get, HttpCode, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { ModerationService } from './moderation.service';

class KickDto { @IsUUID() userId!: string; @IsString() @MaxLength(300) reason!: string; @IsOptional() @IsInt() @Min(1) @Max(1440) cooldownMinutes?: number }
class BanDto {
  @IsUUID() userId!: string;
  @IsIn(['temporary', 'permanent', 'ranked_only']) type!: 'temporary' | 'permanent' | 'ranked_only';
  @IsString() @MaxLength(300) reason!: string;
  @IsOptional() @IsInt() @Min(1) @Max(24 * 365 * 5) hours?: number;
  @IsOptional() @IsString() @MaxLength(2000) evidence?: string;
  @IsOptional() @IsString() @MaxLength(64) matchId?: string;
}
class UnbanDto { @IsUUID() userId!: string; @IsOptional() @IsString() @MaxLength(300) note?: string }
class MessageDto { @IsOptional() @IsUUID() userId?: string; @IsString() @MaxLength(80) title!: string; @IsString() @MaxLength(600) body!: string }
class UserDto { @IsUUID() userId!: string }
interface AdminReq { user: { id: string } }

/** Live player control. Role access: ROUTE_POLICY['moderation'] (support / moderator / developer). */
@ApiTags('moderation')
@ApiBearerAuth()
@Controller('moderation')
export class ModerationController {
  constructor(private readonly service: ModerationService) {}

  @Get('online') @ApiOperation({ summary: 'Players connected right now (state, platform, version, ip, time online)' })
  online() { return this.service.online(); }

  @Post('kick') @HttpCode(200) @ApiOperation({ summary: 'Throw a player out of the game right now (optional cool-down = short temporary ban)' })
  kick(@Req() req: AdminReq, @Body() dto: KickDto) { return this.service.kick(req.user.id, dto.userId, dto.reason, dto.cooldownMinutes); }

  @Post('ban') @HttpCode(200) @ApiOperation({ summary: 'Ban: temporary (hours), permanent, or ranked-only. The running game is closed at once.' })
  ban(@Req() req: AdminReq, @Body() dto: BanDto) { return this.service.ban(req.user.id, dto.userId, dto.type, dto.reason, dto.hours, dto.evidence, dto.matchId); }

  @Post('unban') @HttpCode(200) unban(@Req() req: AdminReq, @Body() dto: UnbanDto) { return this.service.unban(req.user.id, dto.userId, dto.note); }

  @Post('message') @HttpCode(200) @ApiOperation({ summary: 'Show a message in one player\'s game, or to everyone online (omit userId)' })
  message(@Req() req: AdminReq, @Body() dto: MessageDto) { return this.service.message(req.user.id, dto.userId, dto.title, dto.body); }

  @Post('force-logout') @HttpCode(200) forceLogout(@Req() req: AdminReq, @Body() dto: UserDto) { return this.service.forceLogout(req.user.id, dto.userId); }

  @Get('bans') @ApiOperation({ summary: 'All bans (active or all) with player names' })
  bans(@Query('active') active?: string, @Query('type') type?: string, @Query('q') q?: string, @Query('take') take?: string) { return this.service.bans({ active: active === undefined ? undefined : active === 'true', type, q, take: take ? Number(take) : undefined }); }

  @Get('history/:userId') history(@Param('userId') userId: string) { return this.service.history(userId); }
}
