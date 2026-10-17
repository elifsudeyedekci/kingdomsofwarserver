import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { SessionModule } from '../session/session.module';
import { GrantsController, MeController } from './grants.controller';
import { GrantService } from './grant.service';
import { GiftService } from './gift.service';

@Module({ imports: [DatabaseModule, SessionModule], controllers: [GrantsController, MeController], providers: [GrantService, GiftService], exports: [GrantService, GiftService] })
export class GrantsModule {}
