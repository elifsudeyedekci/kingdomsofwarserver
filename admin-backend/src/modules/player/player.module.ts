import { PrivacyModule } from '../privacy/privacy.module';
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { GatewayModule } from '../../gateway/gateway.module';
import { PlayerService } from './player.service';
import { PlayerController } from './player.controller';

@Module({
  imports: [DatabaseModule, GatewayModule, PrivacyModule],
  controllers: [PlayerController],
  providers: [PlayerService],
  exports: [PlayerService],
})
export class PlayerModule {}
