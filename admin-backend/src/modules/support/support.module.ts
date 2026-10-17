import { PlayerSupportController } from './player-support.controller';
import { Module } from '@nestjs/common';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';
import { PrismaService } from '../../database/prisma.service';

@Module({
  imports: [],
  controllers: [SupportController, PlayerSupportController],
  providers: [SupportService, PrismaService],
  exports: [SupportService],
})
export class SupportModule {}
