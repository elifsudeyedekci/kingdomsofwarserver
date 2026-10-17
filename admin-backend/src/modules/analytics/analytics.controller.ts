import { PlayerApi } from '../../common/decorators/player-api.decorator';
import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { TrackEventDto } from './dto/track-event.dto';
import { QueryEventsDto } from './dto/query-events.dto';
import { RevenueReportDto } from './dto/revenue-report.dto';

/**
 * AnalyticsController
 * Admin-facing analytics endpoints for the Kingdoms of War dashboard.
 * All routes require a valid JWT bearer token.
 *
 * Routes:
 *   POST   /analytics/event           — track an analytics event
 *   GET    /analytics/events          — paginated, filtered event list
 *   GET    /analytics/dashboard       — DAU / registrations / event count for a day
 *   GET    /analytics/retention       — D1/D7/D30 cohort retention rates
 *   GET    /analytics/matches         — match statistics (duration, map, civ win rate)
 *   GET    /analytics/revenue         — daily revenue breakdown by date range
 *   GET    /analytics/top-events      — most-triggered event types
 *   GET    /analytics/journey/:userId — last 50 events for a user
 *   GET    /analytics/summary         — aggregated summary stats for dashboard page
 *   GET    /analytics/dau-trend       — daily active users for the last N days
 *   GET    /analytics/civ-picks       — civilization pick rates from match history
 *   GET    /analytics/match-stats     — alias for /analytics/matches
 */
@ApiTags('analytics')
@ApiBearerAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  // ---------------------------------------------------------------------------
  // POST /analytics/event
  // ---------------------------------------------------------------------------
  @PlayerApi()
  @Post('event')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Track an analytics event (eventType, userId, sessionId, data)' })
  trackEvent(@Body() dto: TrackEventDto) {
    return this.service.trackEvent(dto);
  }

  // ---------------------------------------------------------------------------
  // GET /analytics/events
  // ---------------------------------------------------------------------------
  @Get('events')
  @ApiOperation({ summary: 'Get paginated analytics events with optional filters' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'eventType', required: false, type: String, example: 'match_started' })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String, example: '2026-01-01' })
  @ApiQuery({ name: 'endDate', required: false, type: String, example: '2026-12-31' })
  getEvents(@Query() dto: QueryEventsDto) {
    return this.service.getEvents(dto);
  }

  // ---------------------------------------------------------------------------
  // GET /analytics/dashboard
  // ---------------------------------------------------------------------------
  @Get('dashboard')
  @ApiOperation({ summary: 'Daily dashboard stats: DAU, new registrations, total events, active sessions' })
  @ApiQuery({
    name: 'date',
    required: false,
    type: String,
    example: '2026-06-13',
    description: 'Target date (ISO 8601). Defaults to today.',
  })
  getDashboardStats(@Query('date') date?: string) {
    return this.service.getDashboardStats(date);
  }

  // ---------------------------------------------------------------------------
  // GET /analytics/retention
  // ---------------------------------------------------------------------------
  @Get('retention')
  @ApiOperation({ summary: 'D1/D7/D30 cohort retention rates for the last N days' })
  @ApiQuery({
    name: 'days',
    required: false,
    type: Number,
    example: 30,
    description: 'Number of past days to include in the cohort window (default 30, max 90)',
  })
  getRetentionMetrics(
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    return this.service.getRetentionMetrics(Math.min(days, 90));
  }

  // ---------------------------------------------------------------------------
  // GET /analytics/matches
  // ---------------------------------------------------------------------------
  @Get('matches')
  @ApiOperation({
    summary: 'Match statistics: avg duration, most-played maps, per-civ win rates',
  })
  getMatchStats() {
    return this.service.getMatchStats();
  }

  // ---------------------------------------------------------------------------
  // GET /analytics/revenue
  // ---------------------------------------------------------------------------
  @Get('revenue')
  @ApiOperation({ summary: 'Daily revenue breakdown for a date range (verified purchases only)' })
  @ApiQuery({ name: 'startDate', required: true, type: String, example: '2026-01-01' })
  @ApiQuery({ name: 'endDate', required: true, type: String, example: '2026-01-31' })
  getRevenueReport(@Query() dto: RevenueReportDto) {
    return this.service.getRevenueReport(dto.startDate, dto.endDate);
  }

  // ---------------------------------------------------------------------------
  // GET /analytics/top-events
  // ---------------------------------------------------------------------------
  @Get('top-events')
  @ApiOperation({ summary: 'Top N most-triggered event types by count' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 10,
    description: 'Max results to return (default 10, max 100)',
  })
  getTopEvents(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.service.getTopEvents(Math.min(limit, 100));
  }

  // ---------------------------------------------------------------------------
  // GET /analytics/journey/:userId
  // ---------------------------------------------------------------------------
  @Get('journey/:userId')
  @ApiOperation({ summary: 'Get the last 50 analytics events for a user (chronological order)' })
  @ApiParam({ name: 'userId', description: 'Target player user ID (UUID)' })
  getUserJourney(@Param('userId') userId: string) {
    return this.service.getUserJourney(userId);
  }

  // ---------------------------------------------------------------------------
  // GET /analytics/summary
  // ---------------------------------------------------------------------------
  @Get('summary')
  @ApiOperation({ summary: 'Aggregated summary stats for analytics dashboard' })
  getDashboardSummary() {
    return this.service.getDashboardSummary();
  }

  // ---------------------------------------------------------------------------
  // GET /analytics/dau-trend
  // ---------------------------------------------------------------------------
  @Get('dau-trend')
  @ApiOperation({ summary: 'Daily Active Users trend for last N days' })
  @ApiQuery({ name: 'days', required: false, type: Number, example: 30, description: 'Number of days to look back (default 30, max 90)' })
  getDauTrend(
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    return this.service.getDauTrend(Math.min(days, 90));
  }

  // ---------------------------------------------------------------------------
  // GET /analytics/civ-picks
  // ---------------------------------------------------------------------------
  @Get('civ-picks')
  @ApiOperation({ summary: 'Civilization pick rates from match history' })
  getCivPicks() {
    return this.service.getCivPicks();
  }

  // ---------------------------------------------------------------------------
  // GET /analytics/match-stats  (alias for /analytics/matches)
  // ---------------------------------------------------------------------------
  @Get('match-stats')
  @ApiOperation({ summary: 'Alias for /analytics/matches — match statistics (duration, maps, civ win rates)' })
  getMatchStatsAlias() {
    return this.service.getMatchStats();
  }
}
