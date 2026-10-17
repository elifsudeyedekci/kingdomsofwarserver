import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsObject,
  MaxLength,
} from 'class-validator';

// Implements: anticheat design spec — flagPlayer DTO
// Severity mirrors AntiCheatFlag.severity column (String in schema, constrained here)

export enum FlagSeverity {
  low = 'low',
  medium = 'medium',
  high = 'high',
  critical = 'critical',
}

export class FlagPlayerDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsString()
  userId: string;

  @ApiProperty({ example: 'speed_hack_detected' })
  @IsString()
  @MaxLength(100)
  reason: string;

  @ApiPropertyOptional({
    example: { matchId: 'abc', tickDelta: 42, recordedAt: '2026-06-13T10:00:00Z' },
    description: 'Arbitrary JSON evidence payload from the game server',
  })
  @IsOptional()
  @IsObject()
  evidence?: Record<string, unknown>;

  @ApiProperty({ enum: FlagSeverity, example: FlagSeverity.medium })
  @IsEnum(FlagSeverity)
  severity: FlagSeverity;

  @ApiPropertyOptional({ example: 'match-uuid-here' })
  @IsOptional()
  @IsString()
  matchId?: string;
}
