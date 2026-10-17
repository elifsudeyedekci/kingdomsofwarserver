import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsArray, ValidateNested, IsInt, IsBoolean, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { MatchMode } from '@prisma/client';

export class MatchPlayerSlotDto {
  @ApiProperty()
  @IsString()
  userId: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  slot: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(3)
  teamId: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  civId?: string;
}

export class CreateMatchDto {
  @ApiProperty({ enum: MatchMode })
  @IsEnum(MatchMode)
  mode: MatchMode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mapId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  seed?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional({ type: [MatchPlayerSlotDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MatchPlayerSlotDto)
  players?: MatchPlayerSlotDto[];
}
