import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min } from 'class-validator';

export class UpsertLeaderboardEntryDto {
  @ApiProperty({ example: 'user-uuid-1' })
  @IsString()
  userId: string;

  @ApiProperty({ example: 'ranked_1v1' })
  @IsString()
  type: string;

  @ApiPropertyOptional({ example: 'season-uuid-1' })
  @IsOptional()
  @IsString()
  seasonId?: string;

  @ApiProperty({ example: 1450 })
  @IsInt()
  @Min(0)
  score: number;

  @ApiPropertyOptional()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
