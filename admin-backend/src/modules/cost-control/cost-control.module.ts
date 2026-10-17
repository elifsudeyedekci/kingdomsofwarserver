import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { CostControlController } from './cost-control.controller';
import { CostControlService } from './cost-control.service';

/**
 * Exposes admin endpoints for reading and adjusting live economy cost configs
 * stored in the shared BalanceConfig table (keys prefixed "cost.").
 */
@Module({
  imports: [DatabaseModule],
  controllers: [CostControlController],
  providers: [CostControlService],
  exports: [CostControlService],
})
export class CostControlModule {}
