import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class LeaderboardQueryDto {
  @ApiProperty({ example: 'ranked_1v1', description: 'Leaderboard type key' })
  @IsString()
  type: string;

  @ApiPropertyOptional({ example: 'season-uuid-1' })
  @IsOptional()
  @IsString()
  seasonId?: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ example: 100, default: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  @Type(() => Number)
  limit?: number = 100;
}
