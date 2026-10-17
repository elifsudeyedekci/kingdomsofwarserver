import { Injectable, NotFoundException } from '@nestjs/common';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PrismaService } from '../../database/prisma.service';

// Implements: Backup management spec
// Manages Backup records in the database; actual file operations are handled
// by an external backup agent that calls updateBackupStatus() via webhook.

export type BackupType = 'full' | 'incremental';
export type BackupStatus = 'pending' | 'completed' | 'failed';

// DTO embedded here — no separate file needed per project conventions (no dto/ folder exists for backup)
export class TriggerBackupDto {
  @ApiProperty({ enum: ['full', 'incremental'], description: 'Backup type' })
  @IsEnum(['full', 'incremental'])
  type: BackupType;

  @ApiProperty({ required: false, description: 'Human-readable description for this backup' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateBackupStatusDto {
  @ApiProperty({ enum: ['pending', 'completed', 'failed'] })
  @IsEnum(['pending', 'completed', 'failed'])
  status: BackupStatus;

  @ApiProperty({
    required: false,
    description: 'Optional metadata: filePath, fileSize, checksum, error message, etc.',
  })
  @IsOptional()
  metadata?: {
    filePath?: string;
    fileSize?: number;
    checksum?: string;
    expiresAt?: string; // ISO date string
    error?: string;
  };
}

@Injectable()
export class BackupService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // List backups with pagination — newest first
  // ---------------------------------------------------------------------------
  async listBackups(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.backup.findMany({
        skip,
        take: limit,
        orderBy: { startedAt: 'desc' },
      }),
      this.prisma.backup.count(),
    ]);

    return { items, total, page, limit };
  }

  // ---------------------------------------------------------------------------
  // Get a single backup or throw 404
  // ---------------------------------------------------------------------------
  async getBackupById(id: string) {
    const backup = await this.prisma.backup.findUnique({ where: { id } });
    if (!backup) throw new NotFoundException(`Backup ${id} not found`);
    return backup;
  }

  // ---------------------------------------------------------------------------
  // Trigger a new backup — creates a record with status 'pending'
  // The external agent picks this up and calls updateBackupStatus() when done.
  // ---------------------------------------------------------------------------
  async triggerBackup(dto: TriggerBackupDto, createdBy?: string) {
    return this.prisma.backup.create({
      data: {
        type: dto.type,
        status: 'pending',
        createdBy: createdBy ?? null,
        startedAt: new Date(),
      },
    });
  }

  /** A finished (or failed) dump reported by the server's backup script. */
  async recordAgentBackup(b: { type?: string; status?: string; filePath?: string; fileSize?: number; checksum?: string; startedAt?: string; completedAt?: string; expiresAt?: string }) {
    const status = b.status === 'failed' ? 'failed' : 'completed';
    return this.prisma.backup.create({ data: { type: (b.type ?? 'full').slice(0, 20), status, filePath: b.filePath?.slice(0, 500), fileSize: Number.isFinite(b.fileSize) ? Math.round(b.fileSize as number) : undefined, checksum: b.checksum?.slice(0, 128), startedAt: b.startedAt ? new Date(b.startedAt) : new Date(), completedAt: b.completedAt ? new Date(b.completedAt) : new Date(), expiresAt: b.expiresAt ? new Date(b.expiresAt) : undefined, createdBy: 'backup-agent' } });
  }

  // ---------------------------------------------------------------------------
  // Webhook handler: transition pending → completed / failed
  // Accepts optional metadata (file path, size, checksum, expiry)
  // ---------------------------------------------------------------------------
  async updateBackupStatus(
    id: string,
    dto: UpdateBackupStatusDto,
  ) {
    await this.getBackupById(id); // throws NotFoundException if missing

    const data: Record<string, unknown> = { status: dto.status };

    if (dto.status === 'completed') {
      data.completedAt = new Date();
    }

    if (dto.metadata) {
      if (dto.metadata.filePath !== undefined) data.filePath = dto.metadata.filePath;
      if (dto.metadata.fileSize !== undefined) data.fileSize = dto.metadata.fileSize;
      if (dto.metadata.checksum !== undefined) data.checksum = dto.metadata.checksum;
      if (dto.metadata.expiresAt !== undefined) {
        data.expiresAt = new Date(dto.metadata.expiresAt);
      }
    }

    return this.prisma.backup.update({ where: { id }, data });
  }

  // ---------------------------------------------------------------------------
  // Delete a backup record (does NOT delete the physical file)
  // ---------------------------------------------------------------------------
  async deleteBackup(id: string) {
    await this.getBackupById(id); // throws NotFoundException if missing
    await this.prisma.backup.delete({ where: { id } });
    return { deleted: true, id };
  }

  // ---------------------------------------------------------------------------
  // Backup statistics: total count, last backup date, success rate
  // ---------------------------------------------------------------------------
  async getBackupStats() {
    const [total, completed, failed, lastBackup] = await Promise.all([
      this.prisma.backup.count(),
      this.prisma.backup.count({ where: { status: 'completed' } }),
      this.prisma.backup.count({ where: { status: 'failed' } }),
      this.prisma.backup.findFirst({
        orderBy: { startedAt: 'desc' },
        select: { startedAt: true, status: true, type: true },
      }),
    ]);

    const finished = completed + failed;
    const successRate = finished > 0 ? Math.round((completed / finished) * 10000) / 100 : null;

    return {
      total,
      completed,
      failed,
      pending: total - completed - failed,
      successRate, // percentage or null if no finished backups
      lastBackup: lastBackup ?? null,
    };
  }
}
