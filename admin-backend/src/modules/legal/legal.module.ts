import { PrivacyModule } from '../privacy/privacy.module';
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { LegalController } from './legal.controller';
import { LegalService } from './legal.service';

@Module({
  imports:     [DatabaseModule, PrivacyModule],
  controllers: [LegalController],
  providers:   [LegalService],
  exports:     [LegalService],
})
export class LegalModule {}
