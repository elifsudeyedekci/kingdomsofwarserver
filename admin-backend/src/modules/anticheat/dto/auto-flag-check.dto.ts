import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';

// Implements: anticheat design spec — autoFlagCheck DTO
// Heuristics: winRate > 0.95 OR avgCommandsPerSecond > 20 → auto flag

export class MatchDataDto {
  @ApiProperty({
    description: 'Win rate for the player in recent matches (0.0–1.0)',
    example: 0.97,
  })
  @IsNumber()
  @Min(0)
  @Max(1)
  winRate: number;

  @ApiProperty({
    description: 'Average commands issued per second during the match',
    example: 12.5,
  })
  @IsNumber()
  @Min(0)
  avgCommandsPerSecond: number;

  @ApiPropertyOptional({ example: 'match-uuid-here' })
  @IsOptional()
  @IsString()
  matchId?: string;
}
