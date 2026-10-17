import { Module } from '@nestjs/common';
import { AdminGateway } from './admin.gateway';
import { AdminSessionModule } from '../modules/admin-auth/admin-session.module';

@Module({
  imports: [AdminSessionModule],
  providers: [AdminGateway],
  exports: [AdminGateway],
})
export class GatewayModule {}
