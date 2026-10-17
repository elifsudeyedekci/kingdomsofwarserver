import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** DTO for creating or updating a single cost configuration entry. */
export class UpdateCostDto {
  @ApiProperty({ example: 'cost.unit.spearman.wood' })
  @IsString()
  configKey: string;

  @ApiProperty({
    description: 'JSON value — any primitive, object, or array',
    example: { wood: 50, food: 60 },
  })
  @IsNotEmpty()
  value: any;

  @ApiPropertyOptional({ example: 'Spearman wood cost after Age I rebalance' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'admin@kingdomsofwar.com' })
  @IsOptional()
  @IsString()
  updatedBy?: string;
}
