import { IsString, IsOptional, IsInt, IsDateString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTournamentDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsDateString()
  startAt: string;

  @ApiProperty()
  @IsDateString()
  endAt: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(2)
  maxPlayers?: number;

  @ApiPropertyOptional({ description: 'Prize pool as JSON (e.g. { first: 1000, second: 500 })' })
  @IsOptional()
  prizePool?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Admin user ID creating the tournament' })
  @IsOptional()
  @IsString()
  createdBy?: string;
}
