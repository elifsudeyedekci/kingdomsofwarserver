import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { LiveController, LiveAdminController } from './live.controller';
import { LiveService } from './live.service';

@Module({ imports: [DatabaseModule], controllers: [LiveController, LiveAdminController], providers: [LiveService], exports: [LiveService] })
export class LiveModule {}
