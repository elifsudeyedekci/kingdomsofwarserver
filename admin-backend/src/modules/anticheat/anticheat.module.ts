import { ModerationModule } from '../moderation/moderation.module';
import { Module } from '@nestjs/common';
import { AnticheatController } from './anticheat.controller';
import { AnticheatService } from './anticheat.service';

@Module({
  imports: [ModerationModule],
  controllers: [AnticheatController],
  providers: [AnticheatService],
  exports: [AnticheatService],
})
export class AnticheatModule {}
