import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional } from 'class-validator';

export class AdjustWalletDto {
  @ApiPropertyOptional({ example: 500, description: 'Delta applied to gem balance (negative to deduct)' })
  @IsOptional()
  @IsInt()
  gems?: number;

  @ApiPropertyOptional({ example: 1000, description: 'Delta applied to coin balance (negative to deduct)' })
  @IsOptional()
  @IsInt()
  coins?: number;

  @ApiPropertyOptional({ example: 3, description: 'Delta applied to chest key balance (negative to deduct)' })
  @IsOptional()
  @IsInt()
  chestKeys?: number;

  @ApiPropertyOptional({ example: 10, description: 'Delta applied to event token balance (negative to deduct)' })
  @IsOptional()
  @IsInt()
  eventTokens?: number;

  @ApiPropertyOptional({ example: 500, description: 'Delta applied to battle pass XP balance (negative to deduct)' })
  @IsOptional()
  @IsInt()
  bpXp?: number;
}
