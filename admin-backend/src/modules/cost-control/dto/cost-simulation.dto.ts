import { IsNumber, IsString, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for simulating what happens when all cost configs for a given
 * civilisation and age are multiplied by a scalar factor.
 * No data is persisted — results are returned as a dry-run report.
 */
export class CostSimulationDto {
  @ApiProperty({ example: 'mongols', description: 'Civilisation identifier' })
  @IsString()
  civId: string;

  @ApiProperty({
    example: 2,
    description: 'Age bracket (1 = Dark Age, 2 = Feudal, 3 = Castle, 4 = Imperial)',
    minimum: 1,
    maximum: 4,
  })
  @IsNumber()
  @Min(1)
  @Max(4)
  age: number;

  @ApiProperty({
    example: 1.2,
    description: 'Multiplier applied to every cost in scope (0.1 = 90 % cheaper, 5.0 = 5× more expensive)',
    minimum: 0.1,
    maximum: 5.0,
  })
  @IsNumber()
  @Min(0.1)
  @Max(5.0)
  resourceMultiplier: number;
}
