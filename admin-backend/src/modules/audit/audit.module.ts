import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuditController } from './audit.controller';

@Module({ imports: [DatabaseModule], controllers: [AuditController] })
export class AuditModule {}
