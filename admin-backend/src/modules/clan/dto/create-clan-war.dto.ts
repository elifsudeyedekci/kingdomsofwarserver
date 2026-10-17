import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateClanWarDto {
  @ApiProperty({ description: 'ID of the initiating clan' })
  @IsString()
  clanId: string;

  @ApiProperty({ description: 'ID of the opponent clan' })
  @IsString()
  opponentId: string;

  @ApiPropertyOptional({ description: 'Scheduled end date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  endedAt?: string;
}
