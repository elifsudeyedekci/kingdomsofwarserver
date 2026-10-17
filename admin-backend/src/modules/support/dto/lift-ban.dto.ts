import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class LiftBanDto {
  @ApiProperty({ example: 'admin-uuid-1' })
  @IsString()
  liftedBy: string;

  @ApiPropertyOptional({ example: 'Appeal accepted after manual review.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  liftNote?: string;
}
