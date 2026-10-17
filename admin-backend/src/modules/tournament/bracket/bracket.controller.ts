import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { BracketService } from './bracket.service';
import { RecordMatchResultDto } from './dto/bracket.dto';

@Controller('tournaments/:tournamentId/bracket')
export class BracketController {
  constructor(private readonly brackets: BracketService) {}

  @Post('generate')
  generate(@Param('tournamentId') tournamentId: string, @Body() body: { participantIds: string[] }) {
    return this.brackets.generateBracket(tournamentId, body.participantIds);
  }

  @Get()
  get(@Param('tournamentId') tournamentId: string) {
    return this.brackets.getBracket(tournamentId);
  }

  @Post('matches/:matchId/result')
  recordResult(
    @Param('tournamentId') tournamentId: string,
    @Param('matchId') matchId: string,
    @Body() dto: RecordMatchResultDto,
  ) {
    return this.brackets.recordMatchResult(tournamentId, matchId, dto.winnerId, dto.score);
  }
}
