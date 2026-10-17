import { IsArray, IsDate, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class AbTestVariant {
  @ApiProperty()
  @IsString()
  variantId: string;

  @ApiProperty({ description: 'Fractional weight (0–1); all variants must sum to 1.0' })
  @IsNumber()
  weight: number;
}

export class CreateAbTestDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ type: [AbTestVariant] })
  @IsArray()
  variants: AbTestVariant[];

  @ApiPropertyOptional({ default: 0.1, minimum: 0, maximum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  targetPct?: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  metric: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startAt?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endAt?: Date;
}
