import { Module } from '@nestjs/common';
import { GrantsModule } from '../grants/grants.module';
import { PurchaseController } from './purchase.controller';
import { PurchaseService } from './purchase.service';
import { PurchaseValidator } from './purchase.validator';
import { StoreController } from './store.controller';
import { StoreService } from './store.service';

@Module({
  imports: [GrantsModule],
  controllers: [StoreController, PurchaseController],
  providers: [StoreService, PurchaseService, PurchaseValidator],
  exports: [StoreService, PurchaseService],
})
export class StoreModule {}
