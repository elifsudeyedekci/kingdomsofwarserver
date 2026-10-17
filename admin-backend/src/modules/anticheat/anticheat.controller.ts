import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { AnticheatService } from './anticheat.service';
import { FlagPlayerDto } from './dto/flag-player.dto';
import { ReviewFlagDto } from './dto/review-flag.dto';
import { BanPlayerDto } from './dto/ban-player.dto';
import { MatchDataDto } from './dto/auto-flag-check.dto';

@ApiTags('anticheat')
@ApiBearerAuth()
@Controller('anticheat')
export class AnticheatController {
  constructor(private readonly service: AnticheatService) {}

  // ─── FLAGS ────────────────────────────────────────────────────────────────

  @Get('flags')
  @ApiOperation({ summary: 'Paginated anti-cheat flag list with optional filters' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['pending', 'reviewed'],
    description: '"pending" → unreviewed flags; "reviewed" → reviewed flags',
  })
  @ApiQuery({
    name: 'severity',
    required: false,
    enum: ['low', 'medium', 'high', 'critical'],
  })
  getFlags(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: 'pending' | 'reviewed',
    @Query('severity') severity?: string,
  ) {
    return this.service.getFlags(page, Math.min(limit, 100), status, severity);
  }

  @Get('flags/:id')
  @ApiOperation({ summary: 'Get a single anti-cheat flag by id' })
  @ApiParam({ name: 'id', description: 'AntiCheatFlag UUID' })
  getFlagById(@Param('id') id: string) {
    return this.service.getFlagById(id);
  }

  @Post('flags')
  @ApiOperation({ summary: 'Manually flag a player for suspicious activity' })
  flagPlayer(@Body() dto: FlagPlayerDto) {
    return this.service.flagPlayer(dto);
  }

  @Patch('flags/:id/review')
  @ApiOperation({ summary: 'Review or dismiss an anti-cheat flag' })
  @ApiParam({ name: 'id', description: 'AntiCheatFlag UUID' })
  reviewFlag(@Param('id') id: string, @Body() dto: ReviewFlagDto) {
    return this.service.reviewFlag(id, dto);
  }

  // ─── BANS ────────────────────────────────────────────────────────────────

  @Get('bans')
  @ApiOperation({ summary: 'Paginated list of currently active bans' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  getActiveBans(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.service.getActiveBans(page, Math.min(limit, 100));
  }

  @Post('bans')
  @ApiOperation({ summary: 'Issue a ban against a player' })
  banPlayer(@Body() dto: BanPlayerDto) {
    return this.service.banPlayer(dto);
  }

  @Delete('bans/:banId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lift (deactivate) an existing ban' })
  @ApiParam({ name: 'banId', description: 'Ban UUID' })
  liftBan(@Param('banId') banId: string) {
    return this.service.liftBan(banId);
  }

  // ─── PLAYER-SCOPED ────────────────────────────────────────────────────────

  @Get('players/:userId/flags')
  @ApiOperation({ summary: 'Get all anti-cheat flags for a specific player' })
  @ApiParam({ name: 'userId', description: 'User UUID' })
  getPlayerFlags(@Param('userId') userId: string) {
    return this.service.getPlayerFlags(userId);
  }

  @Get('players/:userId/bans')
  @ApiOperation({ summary: 'Get full ban history for a specific player' })
  @ApiParam({ name: 'userId', description: 'User UUID' })
  getBanHistory(@Param('userId') userId: string) {
    return this.service.getBanHistory(userId);
  }

  @Post('players/:userId/auto-check')
  @ApiOperation({
    summary: 'Run automatic heuristic check on post-match data',
    description:
      'Flags the player automatically if winRate > 0.95 or avgCommandsPerSecond > 20.',
  })
  @ApiParam({ name: 'userId', description: 'User UUID' })
  autoFlagCheck(
    @Param('userId') userId: string,
    @Body() dto: MatchDataDto,
  ) {
    return this.service.autoFlagCheck(userId, dto);
  }
}
