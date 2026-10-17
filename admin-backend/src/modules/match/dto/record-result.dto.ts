import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, ValidateNested, IsInt, IsBoolean, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { VictoryType } from '@prisma/client';

export class ParticipantResultDto {
  @ApiProperty()
  @IsString()
  userId: string;

  @ApiProperty()
  @IsBoolean()
  isWinner: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  placement?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  surrendered?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  disconnected?: boolean;
}

export class RecordResultDto {
  @ApiPropertyOptional({ enum: VictoryType })
  @IsOptional()
  @IsEnum(VictoryType)
  victoryType?: VictoryType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  winnerUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  durationTicks?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dataHash?: string;

  @ApiProperty({ type: [ParticipantResultDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParticipantResultDto)
  participants: ParticipantResultDto[];
}
