import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AdminAuthController, AdminsController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminSessionModule } from './admin-session.module';

@Module({
  imports: [DatabaseModule, AdminSessionModule],
  controllers: [AdminAuthController, AdminsController],
  providers: [AdminAuthService],
  exports: [AdminAuthService],
})
export class AdminAuthModule {}
