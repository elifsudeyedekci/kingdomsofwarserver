import { CheatWatchModule } from '../cheatwatch/cheatwatch.module';
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { MatchModule } from '../match/match.module';
import { MatchmakingController } from './matchmaking.controller';
import { MatchmakingService } from './matchmaking.service';

@Module({
  imports: [CheatWatchModule, DatabaseModule, MatchModule],
  controllers: [MatchmakingController],
  providers: [MatchmakingService],
  exports: [MatchmakingService],
})
export class MatchmakingModule {}
