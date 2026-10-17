import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewReportDto {
  @ApiProperty({ example: 'admin-uuid-1' })
  @IsString()
  reviewedBy: string;

  @ApiProperty({ example: 'reviewed' })
  @IsString()
  status: string;

  @ApiPropertyOptional({ example: 'Confirmed via match replay — ban issued.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reviewNote?: string;
}
