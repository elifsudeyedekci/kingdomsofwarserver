import { ModerationModule } from '../moderation/moderation.module';
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';

@Module({
  imports: [DatabaseModule, ModerationModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
