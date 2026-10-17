import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsOptional,
  MaxLength,
} from 'class-validator';

/** DTO for creating a new Civilization master-data entry. */
export class CreateCivilizationDto {
  /** Stable string identifier used as the primary key (e.g. "english", "mongols"). */
  @ApiProperty({ example: 'english' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  civId: string;

  /** Localization key for the civilization's display name. */
  @ApiProperty({ example: 'civ.english.name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  nameKey: string;

  /**
   * Free-form JSON blob holding bonuses, unique units, unique buildings,
   * landmark IDs, and any other civilization-specific data.
   */
  @ApiProperty({
    example: {
      bonuses: [],
      uniqueUnits: ['longbowman'],
      uniqueBuildings: ['council_hall'],
      landmarkIds: ['abbey_of_kings'],
    },
  })
  data: Record<string, unknown>;

  /** Optional array of landmark IDs associated with this civilization. */
  @ApiPropertyOptional({ example: ['abbey_of_kings', 'berkshire_palace'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  landmarkIds?: string[];
}
