import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';

export class VerifyReceiptDto {
  @ApiProperty()
  @IsString()
  rawReceipt: string;

  @ApiProperty()
  @IsBoolean()
  isValid: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  validationResponse?: Record<string, unknown>;
}
