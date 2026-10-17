import { PlayerApi } from '../../common/decorators/player-api.decorator';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { LeaderboardService } from './leaderboard.service';
import { PaginationDto } from './dto/get-leaderboard.dto';
import { UpdateScoreDto } from './dto/update-score.dto';
import { RedisCacheInterceptor } from '../../common/interceptors/cache.interceptor';
import { CacheTTL } from '../../common/decorators/cache-ttl.decorator';

@ApiTags('leaderboard')
@ApiBearerAuth()
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly service: LeaderboardService) {}

  // GET /leaderboard
  @PlayerApi()
  @Get()
  @UseInterceptors(RedisCacheInterceptor)
  @CacheTTL(300)
  @ApiOperation({ summary: 'Global all-time leaderboard (score desc, paginated)' })
  getGlobalLeaderboard(@Query() pagination: PaginationDto) {
    return this.service.getGlobalLeaderboard(pagination.page, pagination.limit);
  }

  // GET /leaderboard/season/:seasonId
  @PlayerApi()
  @Get('season/:seasonId')
  @UseInterceptors(RedisCacheInterceptor)
  @CacheTTL(300)
  @ApiOperation({ summary: 'Per-season leaderboard (score desc, paginated)' })
  @ApiParam({ name: 'seasonId', description: 'Season UUID' })
  getSeasonLeaderboard(
    @Param('seasonId', ParseUUIDPipe) seasonId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.service.getSeasonLeaderboard(seasonId, pagination.page, pagination.limit);
  }

  // GET /leaderboard/top/:n
  @PlayerApi()
  @Get('top/:n')
  @UseInterceptors(RedisCacheInterceptor)
  @CacheTTL(300)
  @ApiOperation({ summary: 'Fixed top-N snapshot (global or per-season)' })
  @ApiParam({ name: 'n', description: 'Number of entries to return', example: 10 })
  @ApiQuery({ name: 'seasonId', required: false, description: 'Season UUID — omit for global' })
  getTopN(
    @Param('n', ParseIntPipe) n: number,
    @Query('seasonId') seasonId?: string,
  ) {
    return this.service.getTopN(n, seasonId);
  }

  // GET /leaderboard/player/:userId/rank
  @PlayerApi()
  @Get('player/:userId/rank')
  @UseInterceptors(RedisCacheInterceptor)
  @CacheTTL(300)
  @ApiOperation({ summary: "Player's rank position in global or season leaderboard" })
  @ApiParam({ name: 'userId', description: 'Player user UUID' })
  @ApiQuery({ name: 'seasonId', required: false, description: 'Season UUID — omit for global' })
  getPlayerRank(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('seasonId') seasonId?: string,
  ) {
    return this.service.getPlayerRank(userId, seasonId);
  }

  // GET /leaderboard/player/:userId/around
  @PlayerApi()
  @Get('player/:userId/around')
  @UseInterceptors(RedisCacheInterceptor)
  @CacheTTL(300)
  @ApiOperation({ summary: 'Players above and below a given player (window size n)' })
  @ApiParam({ name: 'userId', description: 'Player user UUID' })
  @ApiQuery({ name: 'n', required: false, description: 'Window size (default 10)' })
  @ApiQuery({ name: 'seasonId', required: false, description: 'Season UUID — omit for global' })
  getAroundPlayer(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('n') rawN?: string,
    @Query('seasonId') seasonId?: string,
  ) {
    const n = rawN ? Math.max(2, parseInt(rawN, 10)) : 10;
    return this.service.getAroundPlayer(userId, n, seasonId);
  }

  // POST /leaderboard/score
  @Post('score')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Upsert player score (score is additive — never decreases)',
    description:
      'Adds `score` delta to the existing entry. If no entry exists one is created. ' +
      'Omit `seasonId` to update the global leaderboard.',
  })
  updatePlayerScore(@Body() dto: UpdateScoreDto) {
    return this.service.updatePlayerScore(
      dto.userId,
      dto.seasonId ?? null,
      dto.score,
      dto.metadata,
    );
  }

  // DELETE /leaderboard/season/:seasonId/reset
  @Delete('season/:seasonId/reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Admin: delete all entries for a season (irreversible)',
    description:
      'Removes every LeaderboardEntry with the given seasonId. ' +
      'Returns the number of deleted rows.',
  })
  @ApiParam({ name: 'seasonId', description: 'Season UUID to reset' })
  resetSeasonLeaderboard(
    @Param('seasonId', ParseUUIDPipe) seasonId: string,
  ) {
    return this.service.resetSeasonLeaderboard(seasonId);
  }
}
