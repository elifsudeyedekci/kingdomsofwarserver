import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { GatewayModule } from '../../gateway/gateway.module';
import { SessionController } from './session.controller';
import { SessionService } from './session.service';

@Module({ imports: [DatabaseModule, GatewayModule], controllers: [SessionController], providers: [SessionService], exports: [SessionService] })
export class SessionModule {}
