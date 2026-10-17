import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean } from 'class-validator';

export class CreateRefundDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ description: "Also take back what the purchase delivered (packs / items) from the player" })
  @IsOptional()
  @IsBoolean()
  revokeContents?: boolean;
}
