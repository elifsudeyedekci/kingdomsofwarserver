import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '../../database/database.module';
import { AdminSessionService } from './admin-session.service';

/** Panel session store + token verification, shared by the HTTP strategy, the WebSocket gateway and the admin-auth controller. */
@Module({
  imports: [DatabaseModule, JwtModule.register({})],
  providers: [AdminSessionService],
  exports: [AdminSessionService],
})
export class AdminSessionModule {}
