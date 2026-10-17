import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsDateString,
  Min,
  MaxLength,
} from 'class-validator';

export class AddItemDto {
  @ApiProperty({ example: 'skin', description: 'Item category / type (e.g. skin, icon, frame, emote)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  itemType: string;

  @ApiProperty({ example: 'skin_knight_gold', description: 'Unique item identifier within its type' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  itemId: string;

  @ApiPropertyOptional({ example: 1, description: 'Quantity to add; defaults to 1' })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.000Z', description: 'Expiry date (null = permanent)' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ example: 'purchase', description: 'Acquisition source label' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  source?: string;
}
