import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { ClanService } from './clan.service';
import { ClanController } from './clan.controller';
import { ClanWarService } from './war/clan-war.service';
import { ClanWarController } from './war/clan-war.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [ClanController, ClanWarController],
  providers: [ClanService, ClanWarService],
  exports: [ClanService, ClanWarService],
})
export class ClanModule {}
