import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsDateString,
  IsOptional,
  IsInt,
  Min,
  IsObject,
} from 'class-validator';

export class CreateTournamentDto {
  @ApiProperty({ example: 'KoW Summer Cup 2026' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Ranked 1v1 bracket tournament' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: '2026-07-01T00:00:00Z' })
  @IsDateString()
  startAt: string | Date;

  @ApiProperty({ example: '2026-07-15T00:00:00Z' })
  @IsDateString()
  endAt: string | Date;

  @ApiPropertyOptional({ example: 64 })
  @IsOptional()
  @IsInt()
  @Min(2)
  maxPlayers?: number;

  @ApiPropertyOptional({ example: { first: '100 USD', second: '50 USD' } })
  @IsOptional()
  @IsObject()
  prizePool?: Record<string, unknown>;

  @ApiProperty({ example: 'admin-uuid-1' })
  @IsString()
  createdBy: string;
}
