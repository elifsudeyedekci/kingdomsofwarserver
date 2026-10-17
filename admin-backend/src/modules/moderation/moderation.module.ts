import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { GatewayModule } from '../../gateway/gateway.module';
import { SessionModule } from '../session/session.module';
import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';

@Module({ imports: [DatabaseModule, GatewayModule, SessionModule], controllers: [ModerationController], providers: [ModerationService], exports: [ModerationService] })
export class ModerationModule {}
