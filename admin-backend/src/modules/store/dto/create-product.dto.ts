import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @ApiPropertyOptional({ example: 'com.kowgame.gems_500' })
  @IsOptional()
  @IsString()
  skuAndroid?: string;

  @ApiPropertyOptional({ example: 'gems_500' })
  @IsOptional()
  @IsString()
  skuIos?: string;

  @ApiProperty({ example: 'store.gems_500.name' })
  @IsString()
  nameKey: string;

  @ApiPropertyOptional({ example: 'store.gems_500.desc' })
  @IsOptional()
  @IsString()
  descKey?: string;

  @ApiProperty({ example: 4.99 })
  @IsNumber()
  @Min(0)
  priceUsd: number;

  @ApiPropertyOptional({ example: { TR: 149.99 } })
  @IsOptional()
  @IsObject()
  localPrices?: Record<string, number>;

  @ApiProperty({ example: { gems: 500 } })
  @IsObject()
  contents: Record<string, any>;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isConsumable?: boolean;

  @ApiPropertyOptional({ example: 'vip' })
  @IsOptional()
  @IsString()
  segment?: string;

  @ApiPropertyOptional({ type: [String], example: [] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  countries?: string[];

  @ApiPropertyOptional({ example: '1.0.0' })
  @IsOptional()
  @IsString()
  minVersion?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sortOrder?: number;
}
