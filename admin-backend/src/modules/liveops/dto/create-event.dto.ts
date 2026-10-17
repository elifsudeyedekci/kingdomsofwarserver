import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsDateString, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateLiveOpsEventDto {
  @ApiProperty()
  @IsString()
  titleKey: string;

  @ApiProperty()
  @IsString()
  descKey: string;

  @ApiProperty()
  @IsString()
  type: string;

  @ApiProperty()
  @IsDateString()
  startAt: Date;

  @ApiProperty()
  @IsDateString()
  endAt: Date;

  @ApiProperty()
  @IsObject()
  config: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  rewards?: any;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  segment?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  countries?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  minVersion?: string;
}
