import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Request } from '@nestjs/common';
import { PlayerApi } from '../../common/decorators/player-api.decorator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MatchmakingService, QueueRequest, ResultReport } from './matchmaking.service';

interface AuthRequest { user: { id: string } }

/** Server-authoritative queue: the client submits a request and vetoes, the server pairs by rating, picks the map and creates the match. */
@ApiTags('matchmaking')
@ApiBearerAuth()
@PlayerApi()
@Controller('matchmaking')
export class MatchmakingController {
  constructor(private readonly service: MatchmakingService) {}

  @Post('enqueue')
  @ApiOperation({ summary: 'Join a queue (queueId such as ranked_1v1, casual_2v2)' })
  enqueue(@Request() req: AuthRequest, @Body() body: QueueRequest) { return this.service.enqueue(req.user.id, body); }

  @Post('match/:matchId/report')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Report the result of a finished match (winners + final state hash); recorded when every player agrees' })
  report(@Request() req: AuthRequest, @Param('matchId') matchId: string, @Body() body: ResultReport) { return this.service.reportResult(req.user.id, matchId, { winnerUserIds: body.winnerUserIds ?? [], durationTicks: body.durationTicks, dataHash: body.dataHash, contentHash: typeof body.contentHash === 'string' ? body.contentHash.slice(0, 80) : undefined }); }

  @Get(':ticketId')
  @ApiOperation({ summary: 'Poll a ticket: the match when found, null while waiting' })
  async poll(@Request() req: AuthRequest, @Param('ticketId') ticketId: string) { return { match: await this.service.poll(req.user.id, ticketId) }; }

  @Post(':ticketId/veto')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit map vetoes (4 in 1v1/team queues, 1 in free-for-all)' })
  veto(@Request() req: AuthRequest, @Param('ticketId') ticketId: string, @Body() body: { mapIds: string[] }) { return { ok: this.service.submitVeto(req.user.id, ticketId, body.mapIds ?? []) }; }

  @Delete(':ticketId')
  @ApiOperation({ summary: 'Leave the queue' })
  cancel(@Request() req: AuthRequest, @Param('ticketId') ticketId: string) { return { ok: this.service.cancel(req.user.id, ticketId) }; }
}
