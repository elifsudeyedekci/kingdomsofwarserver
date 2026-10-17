import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { GatewayModule } from '../../gateway/gateway.module';
import { ModerationModule } from '../moderation/moderation.module';
import { SessionModule } from '../session/session.module';
import { CheatWatchController, IntegrityController } from './cheatwatch.controller';
import { CheatWatchService } from './cheatwatch.service';

@Module({ imports: [DatabaseModule, GatewayModule, ModerationModule, SessionModule], controllers: [CheatWatchController, IntegrityController], providers: [CheatWatchService], exports: [CheatWatchService] })
export class CheatWatchModule {}
