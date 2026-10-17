import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { PlayerApi } from '../../common/decorators/player-api.decorator';
import { CheatPolicy, CheatWatchService } from './cheatwatch.service';

class ResolveDto { @IsIn(['dismiss', 'warn', 'kick', 'ban_temp', 'ban_perm', 'ban_ranked', 'ban_device']) action!: 'dismiss' | 'warn' | 'kick' | 'ban_temp' | 'ban_perm' | 'ban_ranked' | 'ban_device'; @IsString() @MaxLength(400) note!: string; @IsOptional() @IsInt() @Min(1) @Max(24 * 365) hours?: number }
class RaiseDto { @IsUUID() userId!: string; @IsString() @MaxLength(400) note!: string; @IsOptional() @IsString() matchId?: string }
class DeviceBanDto { @IsOptional() @IsString() @MaxLength(80) deviceId?: string; @IsOptional() @IsString() @MaxLength(60) ip?: string; @IsString() @MaxLength(300) reason!: string; @IsOptional() @IsInt() @Min(1) hours?: number }
class ClientReportDto { @IsString() @MaxLength(40) type!: string; @IsOptional() @IsObject() detail?: Record<string, unknown>; @IsOptional() @IsString() @MaxLength(64) matchId?: string; @IsOptional() @IsString() @MaxLength(80) deviceId?: string; @IsOptional() @IsString() @MaxLength(32) appVersion?: string; @IsOptional() @IsString() @MaxLength(16) platform?: string }
interface AdminReq { user: { id: string } }
interface PlayerReq { user: { id: string }; ip?: string }

/** Cheat centre for the panel. Role access: ROUTE_POLICY['cheatwatch'] (moderator / support / developer). */
@ApiTags('cheatwatch')
@ApiBearerAuth()
@Controller('cheatwatch')
export class CheatWatchController {
  constructor(private readonly service: CheatWatchService) {}

  @Get('stats') stats() { return this.service.stats(); }
  @Get('flags') @ApiOperation({ summary: 'Cheat findings (open / reviewed), newest first, with player name and online state' })
  flags(@Query('status') status?: string, @Query('severity') severity?: string, @Query('type') type?: string, @Query('userId') userId?: string, @Query('take') take?: string, @Query('before') before?: string) { return this.service.flags({ status, severity, type, userId, take: take ? Number(take) : undefined, before }); }
  @Get('flags/:id') @ApiOperation({ summary: 'One finding with its evidence, the player\'s other findings, sessions and active ban' })
  flag(@Param('id') id: string) { return this.service.flag(id); }
  @Post('flags/:id/resolve') @HttpCode(200) @ApiOperation({ summary: 'Decide: dismiss (false positive, lifts an automatic punishment), warn, kick, ban (temp / permanent / ranked-only / device)' })
  resolve(@Req() req: AdminReq, @Param('id') id: string, @Body() dto: ResolveDto) { return this.service.resolve(req.user.id, id, dto.action, dto.note, dto.hours); }
  @Post('raise') @HttpCode(200) raise(@Body() dto: RaiseDto) { return this.service.raise(dto.userId, 'manual', { note: dto.note }, { matchId: dto.matchId, source: 'moderator' }); }

  @Get('policy') @ApiOperation({ summary: 'Automatic enforcement rules (severity and punishment per cheat type)' })
  policy() { return this.service.getPolicy(); }
  @Put('policy') policySave(@Req() req: AdminReq, @Body() dto: Partial<CheatPolicy>) { return this.service.savePolicy(dto, req.user.id); }

  @Get('device-bans') deviceBans() { return this.service.deviceBans(); }
  @Post('device-bans') @HttpCode(200) @ApiOperation({ summary: 'Block a device id and/or IP address from creating or using accounts' })
  blockDevice(@Req() req: AdminReq, @Body() dto: DeviceBanDto) { return this.service.blockDevice(dto.deviceId, dto.ip, dto.reason, dto.hours ?? null, false, req.user.id); }
  @Delete('device-bans/:id') @HttpCode(200) unblock(@Param('id') id: string) { return this.service.unblockDevice(id); }
}

/** The game client's own protections report here (rate limited; only ever raises a flag). */
@ApiTags('cheatwatch')
@ApiBearerAuth()
@PlayerApi()
@Controller('integrity')
export class IntegrityController {
  constructor(private readonly service: CheatWatchService) {}

  @Post('report') @HttpCode(200) @Throttle({ default: { limit: 10, ttl: 60000 } })
  report(@Req() req: PlayerReq, @Body() dto: ClientReportDto) { return this.service.clientReport(req.user.id, dto.type, dto.detail ?? {}, { matchId: dto.matchId, ip: req.ip, deviceId: dto.deviceId, appVersion: dto.appVersion, platform: dto.platform }).then((r) => ({ ok: true, duplicate: r.duplicate })); }
}
