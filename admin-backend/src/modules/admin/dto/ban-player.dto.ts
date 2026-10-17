import { IsString, IsEnum, IsOptional, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BanType } from '@prisma/client';

export class BanPlayerDto {
  @ApiProperty()
  @IsString()
  reason: string;

  @ApiProperty({ enum: BanType })
  @IsEnum(BanType)
  type: BanType;

  @ApiPropertyOptional({ description: 'Days, required when type=temporary' })
  @IsOptional()
  @IsInt()
  @Min(1)
  durationDays?: number;
}
