import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RedisCacheInterceptor } from '../../common/interceptors/cache.interceptor';
import { CacheTTL } from '../../common/decorators/cache-ttl.decorator';
import { TournamentService } from './tournament.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentStatusDto } from './dto/update-tournament-status.dto';
import { TournamentQueryDto } from './dto/tournament-query.dto';
import { LeaderboardQueryDto } from './dto/leaderboard-query.dto';
import { UpsertLeaderboardEntryDto } from './dto/upsert-leaderboard-entry.dto';
import { RecordPromotionResultDto } from './dto/record-promotion-result.dto';

@ApiTags('tournament')
@ApiBearerAuth()
@Controller('tournament')
export class TournamentController {
  constructor(private readonly service: TournamentService) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Tournaments
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * GET /tournament
   * Returns a paginated list of tournaments.
   * Optional query param `status` filters by tournament status.
   * Response: { data, total, page, limit }
   */
  @Get()
  @UseInterceptors(RedisCacheInterceptor)
  @ApiOperation({ summary: 'List tournaments with optional status filter' })
  async getTournaments(@Query() query: TournamentQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const result = await this.service.getTournaments({
      page,
      limit,
      status: query.status,
    });
    return { data: result.items, total: result.total, page, limit };
  }

  /**
   * GET /tournament/:id
   * Returns a single tournament by ID.
   */
  @Get(':id')
  @UseInterceptors(RedisCacheInterceptor)
  @ApiOperation({ summary: 'Get tournament by ID' })
  getTournamentById(@Param('id') id: string) {
    return this.service.getTournamentById(id);
  }

  /**
   * POST /tournament
   * Creates a new tournament.
   */
  @Post()
  @ApiOperation({ summary: 'Create a new tournament' })
  createTournament(@Body() dto: CreateTournamentDto) {
    return this.service.createTournament(dto);
  }

  /**
   * PATCH /tournament/:id/status
   * Transitions tournament to a new status.
   */
  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update tournament status (e.g. upcoming → active)' })
  updateTournamentStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTournamentStatusDto,
  ) {
    return this.service.updateTournamentStatus(id, dto.status);
  }

  /**
   * PATCH /tournament/:id/start
   * Convenience route — transitions tournament to 'active'.
   */
  @Patch(':id/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start a tournament (transitions status to active)' })
  startTournament(@Param('id') id: string) {
    return this.service.updateTournamentStatus(id, 'active');
  }

  /**
   * PATCH /tournament/:id/complete
   * Convenience route — transitions tournament to 'completed'.
   */
  @Patch(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete a tournament (transitions status to completed)' })
  completeTournament(@Param('id') id: string) {
    return this.service.updateTournamentStatus(id, 'completed');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Leaderboard
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * GET /tournament/leaderboard
   * Returns paginated leaderboard entries for a given type and optional season.
   * Response: { data, total, page, limit }
   */
  @Get('leaderboard/entries')
  @UseInterceptors(RedisCacheInterceptor)
  @CacheTTL(300)
  @ApiOperation({ summary: 'Get leaderboard entries by type and optional season' })
  async getLeaderboard(@Query() query: LeaderboardQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 100;
    const result = await this.service.getLeaderboard({
      type: query.type,
      seasonId: query.seasonId,
      page,
      limit,
    });
    return { data: result.items, total: result.total, page, limit };
  }

  /**
   * POST /tournament/leaderboard
   * Creates or updates a leaderboard entry for the given user/type/season.
   */
  @Post('leaderboard/entries')
  @ApiOperation({ summary: 'Upsert a leaderboard entry' })
  upsertLeaderboardEntry(@Body() dto: UpsertLeaderboardEntryDto) {
    return this.service.upsertLeaderboardEntry(dto);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Promotion Series
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * GET /tournament/promotion/:userId
   * Returns the active promotion series for a user, or null if none.
   */
  @Get('promotion/:userId')
  @UseInterceptors(RedisCacheInterceptor)
  @ApiOperation({ summary: 'Get active promotion series for a user' })
  getPromotionSeries(@Param('userId') userId: string) {
    return this.service.getPromotionSeries(userId);
  }

  /**
   * POST /tournament/promotion/:userId/result
   * Records a promotion match result (win or loss) for the user's active series.
   */
  @Post('promotion/:userId/result')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record a promotion series match result' })
  recordPromotionResult(
    @Param('userId') userId: string,
    @Body() dto: RecordPromotionResultDto,
  ) {
    return this.service.recordPromotionResult(userId, dto);
  }
}
