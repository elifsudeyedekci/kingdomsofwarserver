import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * DTO for creating or updating a single localization key.
 * Maps to LocalizationKey model: key + language uniquely identify a record.
 * The "locale" concept in the design doc corresponds to the "language" field in schema.prisma.
 */
export class UpsertLocalizationKeyDto {
  @ApiProperty({ example: 'ui.main_menu.play_button', description: 'The localization key identifier' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  key: string;

  @ApiProperty({ example: 'tr', description: 'BCP-47 locale / language code (maps to the language field in DB)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  locale: string;

  @ApiProperty({ example: 'Oyna', description: 'Translated string value' })
  @IsString()
  @IsNotEmpty()
  value: string;

  @ApiPropertyOptional({ example: 'ui', description: 'Namespace grouping (default: game)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  namespace?: string;
}
