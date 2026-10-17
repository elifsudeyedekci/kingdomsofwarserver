/**
 * DTOs for the Clan War system.
 *
 * Implements: Clan War System design spec
 * Models: ClanWar, ClanWarParticipant, ClanWarAttack (schema.prisma)
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsString,
  Max,
  Min,
} from 'class-validator';

// ─── Request DTOs ────────────────────────────────────────────────────────────

export class DeclareClanWarDto {
  @ApiProperty({ description: 'ID of the attacking (initiating) clan' })
  @IsString()
  attackingClanId: string;

  @ApiProperty({ description: 'ID of the defending clan' })
  @IsString()
  defendingClanId: string;

  @ApiProperty({ description: 'Scheduled start time (ISO 8601)' })
  @IsDateString()
  scheduledAt: string;
}

export class RecordWarAttackDto {
  @ApiProperty({ description: 'Clan war ID' })
  @IsString()
  warId: string;

  @ApiProperty({ description: 'User ID of the attacker (must be a war participant)' })
  @IsString()
  attackerId: string;

  @ApiProperty({ description: 'User ID of the defender (must be a war participant from the opposing clan)' })
  @IsString()
  defenderId: string;

  @ApiProperty({ description: 'Stars earned (0–3)', minimum: 0, maximum: 3 })
  @IsInt()
  @Min(0)
  @Max(3)
  stars: number;

  @ApiProperty({ description: 'Destruction percentage (0–100)', minimum: 0, maximum: 100 })
  @IsInt()
  @Min(0)
  @Max(100)
  destruction: number;
}

// ─── Response DTOs ───────────────────────────────────────────────────────────

export class ClanWarDTO {
  @ApiProperty()
  id: string;

  @ApiProperty({ description: 'Attacking clan ID (maps to clanId in schema)' })
  attackingClanId: string;

  @ApiProperty({ description: 'Defending clan ID (maps to opponentId in schema)' })
  defendingClanId: string;

  @ApiProperty({ enum: ['scheduled', 'active', 'ended'] })
  status: string;

  @ApiProperty()
  attackingClanScore: number;

  @ApiProperty()
  defendingClanScore: number;

  @ApiPropertyOptional()
  scheduledAt?: Date | null;

  @ApiPropertyOptional()
  startedAt?: Date | null;

  @ApiPropertyOptional()
  endedAt?: Date | null;

  @ApiPropertyOptional({ description: 'ID of the winning clan, null if draw or not yet ended' })
  winnerId?: string | null;
}

export class WarAttackDTO {
  @ApiProperty()
  id: string;

  @ApiProperty()
  warId: string;

  @ApiProperty()
  attackerId: string;

  @ApiProperty()
  defenderId: string;

  @ApiProperty({ minimum: 0, maximum: 3 })
  stars: number;

  @ApiProperty({ minimum: 0, maximum: 100 })
  destruction: number;

  @ApiProperty()
  createdAt: Date;
}

export class ClanWarResultDTO extends ClanWarDTO {
  @ApiProperty({ enum: ['attacking', 'defending', 'draw'] })
  winner: 'attacking' | 'defending' | 'draw';

  @ApiProperty({ description: 'War coins awarded to each winning clan member' })
  warCoinsAwarded: number;
}
