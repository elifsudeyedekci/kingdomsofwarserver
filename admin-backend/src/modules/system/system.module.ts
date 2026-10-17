import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { LiveModule } from '../live/live.module';
import { SessionModule } from '../session/session.module';
import { SystemController } from './system.controller';
import { SystemService } from './system.service';

@Module({ imports: [DatabaseModule, SessionModule, LiveModule], controllers: [SystemController], providers: [SystemService] })
export class SystemModule {}
