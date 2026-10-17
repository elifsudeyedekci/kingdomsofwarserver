import { Module } from '@nestjs/common';
import { TournamentController } from './tournament.controller';
import { TournamentService } from './tournament.service';
import { BracketController } from './bracket/bracket.controller';
import { BracketService } from './bracket/bracket.service';
import { PrismaService } from '../../database/prisma.service';

@Module({
  imports: [],
  controllers: [TournamentController, BracketController],
  providers: [TournamentService, BracketService, PrismaService],
  exports: [TournamentService, BracketService],
})
export class TournamentModule {}
