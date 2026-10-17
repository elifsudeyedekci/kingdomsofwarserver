import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTechnologyDto {
  @ApiProperty({ example: 'heavy_maa' })
  @IsString()
  @IsNotEmpty()
  techId: string;

  @ApiProperty({ example: 'tech_heavy_maa_name' })
  @IsString()
  @IsNotEmpty()
  nameKey: string;

  @ApiPropertyOptional({ example: 'english' })
  @IsOptional()
  @IsString()
  civId?: string;

  @ApiProperty({ description: 'Full technology data blob (costs, effects, prerequisites, etc.)' })
  @IsNotEmpty()
  data: Record<string, unknown>;
}
