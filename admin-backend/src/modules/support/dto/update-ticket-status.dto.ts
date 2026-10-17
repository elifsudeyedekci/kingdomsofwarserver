import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { SupportTicketStatus } from '@prisma/client';

export class UpdateTicketStatusDto {
  @ApiProperty({ enum: SupportTicketStatus })
  @IsEnum(SupportTicketStatus)
  status: SupportTicketStatus;

  /**
   * Optionally assign an admin when changing status to in_progress.
   */
  @ApiPropertyOptional({ example: 'admin-uuid-1' })
  @IsOptional()
  @IsString()
  assignedTo?: string;
}
