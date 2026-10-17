/**
 * ClanWarController
 *
 * REST endpoints for the Clan War system in Kingdoms of War.
 * All routes are protected by Bearer authentication (global JwtAuthGuard).
 *
 * Implements: Clan War System design spec
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ClanWarService } from './clan-war.service';
import { DeclareClanWarDto, RecordWarAttackDto } from './dto/clan-war.dto';

@ApiTags('clan-wars')
@ApiBearerAuth()
@Controller('clans/wars')
export class ClanWarController {
  constructor(private readonly clanWarService: ClanWarService) {}

  // ─── Declare a new war ─────────────────────────────────────────────────────

  @Post()
  @ApiOperation({
    summary: 'Declare a new clan war',
    description:
      'Creates a war in "scheduled" status. Both clans must exist and must not ' +
      'already be in a scheduled or active war against each other.',
  })
  declareWar(@Body() dto: DeclareClanWarDto) {
    return this.clanWarService.declareWar(
      dto.attackingClanId,
      dto.defendingClanId,
      new Date(dto.scheduledAt),
    );
  }

  // ─── Start a scheduled war ─────────────────────────────────────────────────

  @Post(':warId/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Start a scheduled clan war',
    description:
      'Transitions war to "active", records startedAt, and selects up to 15 ' +
      'participants per clan ranked by MMR descending.',
  })
  startWar(@Param('warId') warId: string) {
    return this.clanWarService.startWar(warId);
  }

  // ─── Record an attack ──────────────────────────────────────────────────────

  @Post(':warId/attacks')
  @ApiOperation({
    summary: 'Record a war attack',
    description:
      'Each participant may attack up to 2 times per war. ' +
      'stars: 0–3, destruction: 0–100 (percentage).',
  })
  recordWarAttack(
    @Param('warId') warId: string,
    @Body() dto: RecordWarAttackDto,
  ) {
    return this.clanWarService.recordWarAttack(
      warId,
      dto.attackerId,
      dto.defenderId,
      dto.stars,
      dto.destruction,
    );
  }

  // ─── End a war ─────────────────────────────────────────────────────────────

  @Post(':warId/end')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'End an active clan war',
    description:
      'Calculates final scores (best attack per defender), determines winner ' +
      '(higher score; destruction is the tie-breaker), awards war coins to the ' +
      'winning clan members, and transitions status to "ended".',
  })
  endWar(@Param('warId') warId: string) {
    return this.clanWarService.endWar(warId);
  }

  // ─── Query war status ──────────────────────────────────────────────────────

  @Get(':warId')
  @ApiOperation({ summary: 'Get current status and scores of a war' })
  getWarStatus(@Param('warId') warId: string) {
    return this.clanWarService.getWarStatus(warId);
  }

  // ─── War history for a clan ────────────────────────────────────────────────

  @Get('clan/:clanId/history')
  @ApiOperation({ summary: 'Get paginated war history for a clan' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  getWarHistory(
    @Param('clanId') clanId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.clanWarService.getWarHistory(clanId, Number(page), Number(limit));
  }
}
