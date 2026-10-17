import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { GatewayModule } from '../../gateway/gateway.module';
import { FraudController } from './fraud.controller';
import { FraudDetectionService } from './fraud.service';

@Module({
  imports: [DatabaseModule, GatewayModule],
  controllers: [FraudController],
  providers: [FraudDetectionService],
  exports: [FraudDetectionService],
})
export class FraudModule {}
