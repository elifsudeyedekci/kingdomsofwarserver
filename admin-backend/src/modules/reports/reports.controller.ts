import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ReportsService, RevenueGroupBy } from './reports.service';

// Panel-facing period-based endpoints (overview, growth, matches-by-day, etc.)
// use a simple "30d" / "14d" string format parsed by the service.

// DTO: Revenue report query
class RevenueReportQueryDto {
  @ApiProperty({ example: '2026-01-01', description: 'Start date (inclusive)' })
  @Type(() => Date)
  @IsDate()
  startDate: Date;

  @ApiProperty({ example: '2026-12-31', description: 'End date (inclusive)' })
  @Type(() => Date)
  @IsDate()
  endDate: Date;

  @ApiProperty({
    enum: ['day', 'week', 'month'],
    default: 'day',
    required: false,
    description: 'Bucket granularity for grouping revenue',
  })
  @IsOptional()
  @IsEnum(['day', 'week', 'month'])
  groupBy?: RevenueGroupBy = 'day';
}

// DTO: Churn report query
class ChurnReportQueryDto {
  @ApiProperty({ example: 30, description: 'Inactivity threshold in days' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  days: number;

  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ example: 20, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}

// DTO: Top players query
class TopPlayersQueryDto {
  @ApiProperty({ example: 50, required: false, description: 'Number of players to return per list' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 50;
}

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  // GET /reports/player/:userId
  @Get('player/:userId')
  @ApiOperation({
    summary: 'Player profile report',
    description: 'Returns match history stats, win rate, favourite civ, and total playtime for a player.',
  })
  getPlayerReport(@Param('userId') userId: string) {
    return this.service.getPlayerReport(userId);
  }

  // GET /reports/match/:matchId
  @Get('match/:matchId')
  @ApiOperation({
    summary: 'Match detail report',
    description: 'Returns participants, duration, winner, victory type, and event summary for a match.',
  })
  getMatchReport(@Param('matchId') matchId: string) {
    return this.service.getMatchReport(matchId);
  }

  // GET /reports/revenue
  // Supports two call patterns:
  //   1. Panel dashboard: ?period=30d  → getRevenuePeriod()
  //   2. Analytics deep-dive: ?startDate=&endDate=&groupBy= → getGroupedRevenueReport()
  @Get('revenue')
  @ApiOperation({
    summary: 'Revenue report',
    description:
      'Pass ?period=Nd for a rolling window (panel dashboard) or ' +
      '?startDate=&endDate= for a fixed date range with optional groupBy.',
  })
  @ApiQuery({ name: 'period', required: false, example: '30d' })
  getRevenueReport(
    @Query('period') period?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('groupBy') groupBy?: string,
  ) {
    if (period) {
      return this.service.getRevenuePeriod(period);
    }
    // Fall through to the structured date-range variant
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 86_400_000);
    const end = endDate ? new Date(endDate) : new Date();
    return this.service.getGroupedRevenueReport(start, end, (groupBy as RevenueGroupBy) ?? 'day');
  }

  // GET /reports/churn?days=30&page=1&limit=20
  @Get('churn')
  @ApiOperation({
    summary: 'Churn report',
    description: 'Returns active players who have not logged in for at least N days.',
  })
  getChurnReport(@Query() query: ChurnReportQueryDto) {
    return this.service.getChurnReport(
      query.days,
      query.page ?? 1,
      query.limit ?? 20,
    );
  }

  // GET /reports/top-players?limit=50
  @Get('top-players')
  @ApiOperation({
    summary: 'Top players report',
    description: 'Returns the top players ranked by highest MMR and by most matches played.',
  })
  getTopPlayersReport(@Query() query: TopPlayersQueryDto) {
    return this.service.getTopPlayersReport(query.limit ?? 50);
  }

  // ─── Panel dashboard endpoints ────────────────────────────────────────────
  // These endpoints are called by the admin panel with a ?period=Nd query param.

  @Get('overview')
  @ApiOperation({ summary: 'Overview stats for a period (panel dashboard)' })
  @ApiQuery({ name: 'period', required: false, example: '30d' })
  getOverview(@Query('period') period = '30d') {
    return this.service.getOverview(period);
  }

  @Get('growth')
  @ApiOperation({ summary: 'Player registrations per day for a period' })
  @ApiQuery({ name: 'period', required: false, example: '30d' })
  getGrowth(@Query('period') period = '30d') {
    return this.service.getGrowth(period);
  }

  @Get('matches-by-day')
  @ApiOperation({ summary: 'Matches played per day for a period' })
  @ApiQuery({ name: 'period', required: false, example: '14d' })
  getMatchesByDay(@Query('period') period = '14d') {
    return this.service.getMatchesByDay(period);
  }

  @Get('civ-win-rates')
  @ApiOperation({ summary: 'Win rates per civilization (all-time)' })
  getCivWinRates() {
    return this.service.getCivWinRates();
  }

  @Get('retention')
  @ApiOperation({ summary: 'Player retention cohort data (D1 / D7 / D30)' })
  getRetention() {
    return this.service.getRetention();
  }

  @Get('civ-played')
  @ApiOperation({ summary: 'Civilization play-count totals (all-time)' })
  getCivPlayed() {
    return this.service.getCivPlayed();
  }

  @Get('maps-played')
  @ApiOperation({ summary: 'Map play-count totals (all-time)' })
  getMapsPlayed() {
    return this.service.getMapsPlayed();
  }
}
