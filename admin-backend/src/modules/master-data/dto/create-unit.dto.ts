import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  Max,
  MaxLength,
} from 'class-validator';

/** DTO for creating a new Unit master-data entry. */
export class CreateUnitDto {
  /** Stable string identifier used as the primary key (e.g. "longbowman"). */
  @ApiProperty({ example: 'longbowman' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  unitId: string;

  /** Localization key for the unit's display name. */
  @ApiProperty({ example: 'unit.longbowman.name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  nameKey: string;

  /** Optional civilization this unit belongs to. Null = shared / universal. */
  @ApiPropertyOptional({ example: 'english' })
  @IsOptional()
  @IsString()
  civId?: string;

  /**
   * JSON blob with all unit data: baseStats, upgrades, cost, trainTime,
   * age, and any other unit-specific fields.
   */
  @ApiProperty({
    example: {
      baseStats: { hp: 70, attack: 12, armor: 2, speed: 1.12 },
      upgrades: {},
      cost: { food: 60, gold: 20 },
      trainTime: 22,
      age: 2,
    },
  })
  data: Record<string, unknown>;

  /**
   * Age tier when this unit becomes available (1 = Dark, 2 = Feudal,
   * 3 = Castle, 4 = Imperial).
   */
  @ApiProperty({ example: 2, minimum: 1, maximum: 4 })
  @IsNumber()
  @Min(1)
  @Max(4)
  age: number;
}
