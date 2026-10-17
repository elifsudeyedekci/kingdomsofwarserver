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

/** DTO for creating a new GameMap master-data entry. */
export class CreateGameMapDto {
  /** Stable string identifier used as the primary key (e.g. "arabia"). */
  @ApiProperty({ example: 'arabia' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  mapId: string;

  /** Localization key for the map's display name. */
  @ApiProperty({ example: 'map.arabia.name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  nameKey: string;

  /**
   * JSON blob with all map-specific data: size, playerCount,
   * terrainData, thumbnailUrl, isActive, etc.
   */
  @ApiProperty({
    example: {
      size: 'large',
      playerCount: 8,
      terrainData: {},
      thumbnailUrl: 'https://cdn.example.com/maps/arabia.png',
      isActive: true,
    },
  })
  data: Record<string, unknown>;

  /** Number of players supported by this map (2–8). */
  @ApiProperty({ example: 8, minimum: 2, maximum: 8 })
  @IsNumber()
  @Min(2)
  @Max(8)
  playerCount: number;

  /** Optional CDN URL for the map thumbnail image. */
  @ApiPropertyOptional({ example: 'https://cdn.example.com/maps/arabia.png' })
  @IsOptional()
  @IsString()
  thumbnailUrl?: string;
}
