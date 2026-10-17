import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { RewardsController } from './rewards.controller';
import { RewardsService } from './rewards.service';

@Module({ imports: [DatabaseModule], controllers: [RewardsController], providers: [RewardsService], exports: [RewardsService] })
export class RewardsModule {}
