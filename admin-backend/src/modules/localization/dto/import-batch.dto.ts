import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/**
 * A single key-value record inside a batch import payload.
 */
export class LocalizationRecordDto {
  @ApiProperty({ example: 'ui.main_menu.play_button', description: 'The localization key identifier' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  key: string;

  @ApiProperty({ example: 'Oyna', description: 'Translated string value' })
  @IsString()
  @IsNotEmpty()
  value: string;
}

/**
 * DTO for bulk-importing localization strings for a single locale.
 * Each record is upserted (created or updated) atomically.
 */
export class ImportBatchDto {
  @ApiProperty({ example: 'tr', description: 'Target locale / language code' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  locale: string;

  @ApiProperty({
    type: [LocalizationRecordDto],
    description: 'Array of key-value pairs to import',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LocalizationRecordDto)
  records: LocalizationRecordDto[];
}
