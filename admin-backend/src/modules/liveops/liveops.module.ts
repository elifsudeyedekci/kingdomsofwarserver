import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { LiveOpsController } from './liveops.controller';
import { LiveOpsService } from './liveops.service';

@Module({
  imports:     [DatabaseModule],
  controllers: [LiveOpsController],
  providers:   [LiveOpsService],
  exports:     [LiveOpsService],
})
export class LiveOpsModule {}
