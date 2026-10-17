import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsDateString,
  Min,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class GrantItemDto {
  @ApiProperty({ example: 'a1b2c3d4-...', description: 'Target player userId (UUID)' })
  @IsUUID()
  userId: string;

  @ApiProperty({ example: 'skin', description: 'Item category / type' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  itemType: string;

  @ApiProperty({ example: 'skin_knight_gold', description: 'Unique item identifier within its type' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  itemId: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ example: 'event_reward', description: 'Acquisition source label' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  source?: string;
}
