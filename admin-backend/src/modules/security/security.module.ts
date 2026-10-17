import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { GatewayModule } from '../../gateway/gateway.module';
import { AdminSessionModule } from '../admin-auth/admin-session.module';
import { SecurityController } from './security.controller';
import { SecurityMiddleware } from './security.middleware';
import { SecurityService } from './security.service';

@Global()
@Module({
  imports: [DatabaseModule, GatewayModule, AdminSessionModule],
  controllers: [SecurityController],
  providers: [SecurityService, SecurityMiddleware],
  exports: [SecurityService],
})
export class SecurityModule implements NestModule {
  configure(consumer: MiddlewareConsumer) { consumer.apply(SecurityMiddleware).forRoutes('*'); }
}
