import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { GatewayModule } from '../../gateway/gateway.module';
import { MatchService } from './match.service';
import { MatchController } from './match.controller';

@Module({
  imports: [DatabaseModule, GatewayModule],
  controllers: [MatchController],
  providers: [MatchService],
  exports: [MatchService],
})
export class MatchModule {}
