import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateClanDto {
  @ApiProperty({ description: 'Unique clan name', maxLength: 50 })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name: string;

  @ApiProperty({ description: 'Unique clan tag (2-5 chars)', maxLength: 5 })
  @IsString()
  @MinLength(2)
  @MaxLength(5)
  tag: string;

  @ApiPropertyOptional({ description: 'Clan description', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'Clan logo URL' })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({ description: 'Whether the clan is open for anyone to join', default: true })
  @IsOptional()
  @IsBoolean()
  isOpen?: boolean;

  @ApiPropertyOptional({ description: 'Minimum MMR required to join', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  minMmr?: number;
}
