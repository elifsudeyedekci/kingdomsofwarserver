import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class LogChargebackDto {
  @ApiProperty()
  @IsString()
  userId: string;

  @ApiProperty()
  @IsString()
  transactionId: string;

  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  amountUsd: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}
