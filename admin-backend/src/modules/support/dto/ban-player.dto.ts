import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { BanType } from '@prisma/client';

export class BanPlayerDto {
  @ApiProperty({ example: 'user-uuid-1' })
  @IsString()
  userId: string;

  @ApiProperty({ enum: BanType })
  @IsEnum(BanType)
  type: BanType;

  @ApiProperty({ example: 'Speed hack confirmed via match replay analysis.' })
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reason: string;

  @ApiProperty({ example: 'admin-uuid-1' })
  @IsString()
  bannedBy: string;

  @ApiPropertyOptional({ example: '2026-06-20T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  endsAt?: Date;

  @ApiPropertyOptional({ example: 'match-uuid-1' })
  @IsOptional()
  @IsString()
  matchId?: string;

  @ApiPropertyOptional({ example: 'Replay hash: abc123' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  evidence?: string;
}
