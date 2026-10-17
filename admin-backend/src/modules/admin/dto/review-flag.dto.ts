import { IsString, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum FlagDecision {
  false_positive = 'false_positive',
  actioned = 'actioned',
  reviewed = 'reviewed',
}

export class ReviewFlagDto {
  @ApiProperty({ enum: FlagDecision, description: 'Outcome of the anti-cheat flag review' })
  @IsEnum(FlagDecision)
  decision: FlagDecision;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reviewNote?: string;
}
