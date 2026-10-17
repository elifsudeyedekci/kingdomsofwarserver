import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

// Implements: anticheat design spec — reviewFlag DTO
// AntiCheatFlag.reviewed is a boolean in the schema; we map reviewed→true, dismissed→reviewed+note

export enum ReviewDecision {
  reviewed = 'reviewed',
  dismissed = 'dismissed',
}

export class ReviewFlagDto {
  @ApiProperty({
    enum: ReviewDecision,
    description: '"reviewed" marks the flag as actioned; "dismissed" marks it as a false positive',
  })
  @IsEnum(ReviewDecision)
  decision: ReviewDecision;

  @ApiPropertyOptional({
    example: 'Confirmed via replay — definitive speed hack on tick 4200',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reviewNote?: string;

  @ApiProperty({
    description: 'Admin user ID performing the review',
    example: 'admin-uuid-here',
  })
  @IsString()
  reviewedBy: string;
}
