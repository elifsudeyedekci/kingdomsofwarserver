import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

/**
 * DTO for GET /analytics/revenue — date range params for revenue breakdown.
 * Queries PlayerPurchase model in schema.prisma
 */
export class RevenueReportDto {
  @ApiProperty({ example: '2026-01-01', description: 'ISO 8601 start date (inclusive)' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2026-01-31', description: 'ISO 8601 end date (inclusive)' })
  @IsDateString()
  endDate: string;
}
