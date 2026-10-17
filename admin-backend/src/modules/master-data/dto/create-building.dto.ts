import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBuildingDto {
  @ApiProperty({ example: 'council_hall' })
  @IsString()
  @IsNotEmpty()
  buildingId: string;

  @ApiProperty({ example: 'building_council_hall_name' })
  @IsString()
  @IsNotEmpty()
  nameKey: string;

  @ApiPropertyOptional({ example: 'english' })
  @IsOptional()
  @IsString()
  civId?: string;

  @ApiProperty({ description: 'Full building data blob (stats, costs, requirements, etc.)' })
  @IsNotEmpty()
  data: Record<string, unknown>;
}
