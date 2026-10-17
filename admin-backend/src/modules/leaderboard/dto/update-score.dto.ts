import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class UpdateScoreDto {
  @ApiProperty({ description: 'Player user ID' })
  @IsUUID()
  userId: string;

  @ApiPropertyOptional({ description: 'Season ID — omit for global leaderboard' })
  @IsOptional()
  @IsUUID()
  seasonId?: string;

  @ApiProperty({ description: 'Score delta to add (must be positive)', minimum: 0 })
  @IsInt()
  @Min(0)
  score: number;

  @ApiPropertyOptional({ description: 'Extra JSON metadata to store alongside this entry' })
  @IsOptional()
  metadata?: Record<string, unknown>;
}
