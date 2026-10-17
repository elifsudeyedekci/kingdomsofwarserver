import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Headers, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { Public } from '../../common/decorators/public.decorator';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  BackupService,
  TriggerBackupDto,
  UpdateBackupStatusDto,
} from './backup.service';

// Pagination query DTO (local — no dto/ folder for backup module)
class BackupPaginationQueryDto {
  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ example: 20, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}

@ApiTags('backup')
@ApiBearerAuth()
@Controller('backup')
export class BackupController {
  constructor(private readonly service: BackupService) {}

  // GET /backup?page=1&limit=20
  @Get()
  @ApiOperation({
    summary: 'List backups',
    description: 'Returns a paginated list of all backup records, newest first.',
  })
  listBackups(@Query() query: BackupPaginationQueryDto) {
    return this.service.listBackups(query.page ?? 1, query.limit ?? 20);
  }

  // GET /backup/stats
  @Get('stats')
  @ApiOperation({
    summary: 'Backup statistics',
    description: 'Returns total count, completed/failed counts, success rate, and last backup info.',
  })
  getBackupStats() {
    return this.service.getBackupStats();
  }

  // GET /backup/:id
  @Get(':id')
  @ApiOperation({
    summary: 'Get backup by ID',
    description: 'Returns a single backup record. Throws 404 if not found.',
  })
  getBackupById(@Param('id') id: string) {
    return this.service.getBackupById(id);
  }

  // POST /backup
  @Post()
  @ApiOperation({
    summary: 'Trigger a manual backup',
    description:
      'Creates a backup record with status pending. ' +
      'The external backup agent picks it up and calls PATCH /backup/:id/status when done.',
  })
  triggerBackup(
    @Body() dto: TriggerBackupDto,
    @Query('createdBy') createdBy?: string,
  ) {
    return this.service.triggerBackup(dto, createdBy);
  }

  /**
   * The backup script on the server (deployment/backup.sh) reports each finished dump here. Authenticated by a long random token (BACKUP_AGENT_TOKEN, header x-agent-token);
   * the endpoint does not exist (404) while that variable is unset. It can only ADD a backup record - it cannot read or change anything else.
   */
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post('agent/report')
  async agentReport(@Headers('x-agent-token') token: string, @Body() body: { type?: string; status?: string; filePath?: string; fileSize?: number; checksum?: string; startedAt?: string; completedAt?: string; expiresAt?: string }) {
    const expected = process.env.BACKUP_AGENT_TOKEN;
    if (!expected || expected.length < 32) throw new NotFoundException();
    const a = Buffer.from(String(token ?? '')), b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new UnauthorizedException();
    return this.service.recordAgentBackup(body);
  }

  // PATCH /backup/:id/status  — webhook endpoint for the backup agent
  @Patch(':id/status')
  @ApiOperation({
    summary: 'Update backup status (webhook)',
    description:
      'Transitions a backup from pending → completed or failed. ' +
      'Called by the external backup agent after execution.',
  })
  updateBackupStatus(
    @Param('id') id: string,
    @Body() dto: UpdateBackupStatusDto,
  ) {
    return this.service.updateBackupStatus(id, dto);
  }

  // DELETE /backup/:id
  @Delete(':id')
  @ApiOperation({
    summary: 'Delete backup record',
    description:
      'Removes the backup metadata record from the database. ' +
      'Does NOT delete the physical backup file.',
  })
  deleteBackup(@Param('id') id: string) {
    return this.service.deleteBackup(id);
  }
}
