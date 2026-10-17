import { NotFoundException } from '@nestjs/common';
import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { LiveOpsService } from './liveops.service';
import { CreateLiveOpsEventDto } from './dto/create-event.dto';
import { CreateQuestDto } from './dto/create-quest.dto';

@ApiTags('liveops')
@ApiBearerAuth()
@Controller('liveops')
export class LiveOpsController {
  constructor(private readonly service: LiveOpsService) {}

  // ---------- Season ----------

  @Get('season')
  @ApiOperation({ summary: 'List every season (newest first)' })
  listSeasons() { return this.service.listSeasons(); }

  @Get('battle-pass/stats/:seasonId')
  @ApiOperation({ summary: 'Battle pass numbers of a season (players, premium share, average level)' })
  bpStats(@Param('seasonId') seasonId: string) { return this.service.battlePassStats(seasonId); }

  @Get('season/active')
  @ApiOperation({ summary: 'Get the currently active season' })
  async getActiveSeason() {
    try { return await this.service.getActiveSeason(); } catch (e) { if (e instanceof NotFoundException) return null; throw e; }     // no active season is a normal state, not an error
  }

  @Get('season/:id')
  @ApiOperation({ summary: 'Get a season by ID' })
  getSeason(@Param('id') id: string) {
    return this.service.getSeason(id);
  }

  @Post('season')
  @ApiOperation({ summary: 'Create a new season' })
  createSeason(@Body() data: { number: number; name: string; startAt: Date; endAt: Date; bpMaxLevel?: number }) {
    return this.service.createSeason(data);
  }

  @Patch('season/:id/activate')
  @ApiOperation({ summary: 'Set a season as the active season' })
  setActiveSeason(@Param('id') id: string) {
    return this.service.setActiveSeason(id);
  }

  // ---------- Events ----------

  @Get('events/active')
  @ApiOperation({ summary: 'Get active events (optionally filtered by country and version)' })
  @ApiQuery({ name: 'country', required: false })
  @ApiQuery({ name: 'version', required: false })
  getActiveEvents(@Query('country') country?: string, @Query('version') version?: string) {
    return this.service.getActiveEvents(country, version);
  }

  @Get('events')
  @ApiOperation({ summary: 'List events with pagination' })
  @ApiQuery({ name: 'page',       required: false, type: Number })
  @ApiQuery({ name: 'limit',      required: false, type: Number })
  @ApiQuery({ name: 'activeOnly', required: false, type: Boolean })
  getEvents(
    @Query('page',       new DefaultValuePipe(1),     ParseIntPipe)  page: number,
    @Query('limit',      new DefaultValuePipe(20),    ParseIntPipe)  limit: number,
    @Query('activeOnly', new DefaultValuePipe(false), ParseBoolPipe) activeOnly: boolean,
  ) {
    return this.service.getEvents(page, Math.min(limit, 100), activeOnly);
  }

  @Post('events')
  @ApiOperation({ summary: 'Create a new LiveOps event' })
  createEvent(@Body() dto: CreateLiveOpsEventDto) {
    return this.service.createEvent(dto);
  }

  @Patch('events/:id')
  @ApiOperation({ summary: 'Update a LiveOps event' })
  updateEvent(@Param('id') id: string, @Body() data: any) {
    return this.service.updateEvent(id, data);
  }

  @Delete('events/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a LiveOps event' })
  async deleteEvent(@Param('id') id: string) {
    await this.service.deleteEvent(id);
  }

  // ---------- Battle Pass ----------

  @Get('battle-pass/:userId/:seasonId')
  @ApiOperation({ summary: 'Get battle pass state for a user in a season' })
  getBattlePass(@Param('userId') userId: string, @Param('seasonId') seasonId: string) {
    return this.service.getBattlePass(userId, seasonId);
  }

  @Post('battle-pass/:userId/:seasonId/xp')
  @ApiOperation({ summary: 'Grant XP to a user\'s battle pass' })
  grantBattlePassXp(
    @Param('userId')   userId: string,
    @Param('seasonId') seasonId: string,
    @Body('xp')        xp: number,
  ) {
    return this.service.grantBattlePassXp(userId, seasonId, xp);
  }

  @Post('battle-pass/:userId/:seasonId/premium')
  @ApiOperation({ summary: 'Purchase the premium battle pass for a user' })
  purchasePremiumPass(@Param('userId') userId: string, @Param('seasonId') seasonId: string) {
    return this.service.purchasePremiumPass(userId, seasonId);
  }

  // ---------- Quests ----------

  @Get('quests')
  @ApiOperation({ summary: 'List quest definitions' })
  @ApiQuery({ name: 'type',     required: false })
  @ApiQuery({ name: 'isActive', required: false })
  getQuests(@Query('type') type?: string, @Query('isActive') isActive?: string) {
    const active = isActive === undefined ? undefined : isActive === 'true';
    return this.service.getQuests(type, active);
  }

  @Post('quests')
  @ApiOperation({ summary: 'Create a new quest definition' })
  createQuest(@Body() dto: CreateQuestDto) {
    return this.service.createQuest(dto);
  }

  // ---------- Chests ----------

  @Get('chests')
  @ApiOperation({ summary: 'List all active chest definitions' })
  getChests() {
    return this.service.getChests();
  }
}
