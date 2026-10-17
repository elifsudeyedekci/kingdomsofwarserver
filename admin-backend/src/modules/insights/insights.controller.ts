import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InsightsService } from './insights.service';

/** Read-only player intelligence for the panel: list, full player file, global summary. Role access: ROUTE_POLICY['insights']. */
@ApiTags('insights')
@ApiBearerAuth()
@Controller('insights')
export class InsightsController {
  constructor(private readonly service: InsightsService) {}

  @Get('summary') @ApiOperation({ summary: 'Totals: players, online now, DAU/WAU/MAU, hours played, revenue, platforms, versions, civ picks' })
  summary() { return this.service.summary(); }

  @Get('players') @ApiOperation({ summary: 'Search / filter / sort every player (hours played, matches, MMR, last seen, platform, banned, payer, online)' })
  players(@Query('q') q?: string, @Query('sort') sort?: string, @Query('dir') dir?: string, @Query('page') page?: string, @Query('limit') limit?: string, @Query('platform') platform?: string,
          @Query('banned') banned?: string, @Query('online') online?: string, @Query('payer') payer?: string, @Query('minHours') minHours?: string, @Query('guest') guest?: string) {
    const b = (v?: string) => (v === undefined ? undefined : v === 'true' || v === '1');
    return this.service.players({ q, sort, dir: dir === 'asc' ? 'asc' : 'desc', page: page ? Number(page) : 1, limit: limit ? Number(limit) : 25, platform, banned: b(banned), online: b(online), payer: b(payer), minHours: minHours ? Number(minHours) : undefined, guest: b(guest) });
  }

  @Get('players/:id') @ApiOperation({ summary: 'The complete file of one player: play time, sessions, matches, economy, purchases, devices/IPs, linked accounts, moderation' })
  player(@Param('id') id: string) { return this.service.player(id); }
}
