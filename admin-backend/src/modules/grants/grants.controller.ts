import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsObject, IsOptional, IsString, IsUUID, Max, MaxLength, Min, IsArray } from 'class-validator';
import { PlayerApi } from '../../common/decorators/player-api.decorator';
import { GrantService, Rewards } from './grant.service';
import { GiftService, GiftTarget } from './gift.service';

class ApplyDto { @IsUUID() userId!: string; @IsObject() rewards!: Rewards; @IsString() @MaxLength(300) reason!: string }
class RevokeDto { @IsUUID() userId!: string; @IsUUID() inventoryId!: string; @IsOptional() @IsInt() @Min(1) qty?: number; @IsString() @MaxLength(300) reason!: string }
class TargetDto {
  @IsOptional() @IsArray() @IsUUID('all', { each: true }) userIds?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) usernames?: string[];
  @IsOptional() @IsBoolean() all?: boolean;
  @IsOptional() @IsString() platform?: string;
  @IsOptional() @IsInt() @Min(1) minLevel?: number;
  @IsOptional() @IsInt() @Min(1) activeWithinDays?: number;
  @IsOptional() @IsInt() @Min(1) inactiveForDays?: number;
  @IsOptional() @IsBoolean() hasPurchased?: boolean;
}
class GiftDto {
  @IsObject() target!: TargetDto;
  @IsObject() title!: Record<string, string>;
  @IsObject() body!: Record<string, string>;
  @IsObject() rewards!: Rewards;
  @IsOptional() @IsInt() @Min(1) @Max(365) expiresInDays?: number;
}
class PreviewDto { @IsObject() target!: TargetDto }
interface AdminReq { user: { id: string } }
interface PlayerReq { user: { id: string }; headers: Record<string, string | string[] | undefined> }

/** Giving things to players. Role access: ROUTE_POLICY['grants']. */
@ApiTags('grants')
@ApiBearerAuth()
@Controller('grants')
export class GrantsController {
  constructor(private readonly grants: GrantService, private readonly gifts: GiftService) {}

  @Post('apply') @HttpCode(200)
  @ApiOperation({ summary: 'Give a player resources/currency, items, packs (even paid ones, free), starting bonuses (resources / units for their games) or XP - immediately' })
  apply(@Req() req: AdminReq, @Body() dto: ApplyDto) { return this.grants.apply(dto.userId, dto.rewards, { source: 'admin_grant', reason: dto.reason, adminId: req.user.id }); }

  @Post('revoke-item') @HttpCode(200) revoke(@Req() req: AdminReq, @Body() dto: RevokeDto) { return this.grants.revokeItem(dto.userId, dto.inventoryId, dto.qty, req.user.id, dto.reason); }
  @Delete('bonus/:userId/:bonusId') @HttpCode(200) revokeBonus(@Param('userId') userId: string, @Param('bonusId') bonusId: string) { return this.grants.revokeBonus(userId, bonusId); }

  @Get('assets/:userId') assets(@Param('userId') userId: string) { return this.grants.assets(userId); }
  @Get('ledger/:userId') ledger(@Param('userId') userId: string, @Query('take') take?: string) { return this.grants.ledger(userId, take ? Number(take) : 100); }
  @Get('economy') @ApiOperation({ summary: 'Economy summary: circulation, flows by source, top holders, purchases' }) economy(@Query('days') days?: string) { return this.grants.economy(days ? Number(days) : 30); }
  @Get('catalog') catalog() { return this.grants.catalogOfPacks(); }

  @Post('gifts/preview') @HttpCode(200) preview(@Body() dto: PreviewDto) { return this.gifts.preview(dto.target as GiftTarget); }
  @Post('gifts') @HttpCode(200) @ApiOperation({ summary: 'Send a gift (mailbox item) to one player, a list, or a segment (everyone / platform / level / activity / buyers)' })
  send(@Req() req: AdminReq, @Body() dto: GiftDto) { return this.gifts.send(req.user.id, dto.target as GiftTarget, dto.title, dto.body, dto.rewards, dto.expiresInDays); }
  @Get('gifts') list(@Query('userId') userId?: string, @Query('status') status?: string, @Query('take') take?: string) { return this.gifts.list({ userId, status, take: take ? Number(take) : undefined }); }
  @Delete('gifts/:id') @HttpCode(200) cancel(@Param('id') id: string) { return this.gifts.cancel(id); }
}

/** What the game client uses: its mailbox, starting bonuses and owned packs. Everything is scoped to the signed-in player. */
@ApiTags('me')
@ApiBearerAuth()
@PlayerApi()
@Controller('me')
export class MeController {
  constructor(private readonly gifts: GiftService, private readonly grants: GrantService) {}

  @Get('gifts') list(@Req() req: PlayerReq, @Query('locale') locale = 'en') { return this.gifts.mine(req.user.id, String(locale).toLowerCase().slice(0, 5)); }
  @Post('gifts/:id/claim') @HttpCode(200) claim(@Req() req: PlayerReq, @Param('id') id: string) { return this.gifts.claim(req.user.id, id); }
  @Get('bonuses') bonuses(@Req() req: PlayerReq) { return this.gifts.bonuses(req.user.id); }
  @Post('bonuses/:id/use') @HttpCode(200) use(@Req() req: PlayerReq, @Param('id') id: string) { return this.gifts.useBonus(req.user.id, id); }
  @Get('ladder') ladder(@Req() req: PlayerReq, @Query('top') top?: string) { return this.gifts.ladder(req.user.id, top ? Number(top) : 100); }
  @Get('entitlements') entitlements(@Req() req: PlayerReq) { return this.gifts.entitlements(req.user.id); }
  @Get('wallet') async wallet(@Req() req: PlayerReq) { return (await this.grants.assets(req.user.id)).wallet; }
}
