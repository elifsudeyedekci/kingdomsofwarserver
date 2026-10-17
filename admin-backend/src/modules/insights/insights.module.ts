import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { GrantsModule } from '../grants/grants.module';
import { SessionModule } from '../session/session.module';
import { InsightsController } from './insights.controller';
import { InsightsService } from './insights.service';

@Module({ imports: [DatabaseModule, SessionModule, GrantsModule], controllers: [InsightsController], providers: [InsightsService], exports: [InsightsService] })
export class InsightsModule {}
