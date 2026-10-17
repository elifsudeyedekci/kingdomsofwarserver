import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLandmarkDto {
  @ApiProperty({ example: 'the_white_tower' })
  @IsString()
  @IsNotEmpty()
  landmarkId: string;

  @ApiProperty({ example: 'landmark_white_tower_name' })
  @IsString()
  @IsNotEmpty()
  nameKey: string;

  @ApiPropertyOptional({ example: 'english' })
  @IsOptional()
  @IsString()
  civId?: string;

  @ApiProperty({ description: 'Full landmark data blob (abilities, bonuses, requirements, etc.)' })
  @IsNotEmpty()
  data: Record<string, unknown>;
}
