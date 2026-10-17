import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { BanType } from '@prisma/client';

// Implements: anticheat design spec — banPlayer DTO
// Uses the BanType enum from Prisma (temporary | permanent | ranked_only)

export class BanPlayerDto {
  @ApiProperty({ example: 'player-uuid-here' })
  @IsString()
  userId: string;

  @ApiProperty({ enum: BanType, example: BanType.temporary })
  @IsEnum(BanType)
  banType: BanType;

  @ApiPropertyOptional({
    description: 'Duration in days. Required when banType=temporary.',
    example: 7,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  durationDays?: number;

  @ApiProperty({ example: 'Confirmed speed hack — replay evidence attached' })
  @IsString()
  @MaxLength(500)
  reason: string;

  @ApiProperty({ description: 'Admin user ID issuing the ban', example: 'admin-uuid-here' })
  @IsString()
  bannedBy: string;

  @ApiPropertyOptional({ example: 'match-uuid-here' })
  @IsOptional()
  @IsString()
  matchId?: string;

  @ApiPropertyOptional({ example: 'replay_frame_4200.json' })
  @IsOptional()
  @IsString()
  evidence?: string;
}
