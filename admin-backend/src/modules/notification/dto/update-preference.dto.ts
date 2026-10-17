import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdatePreferenceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  mailEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  smsEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  marketingPush?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  marketingMail?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  marketingSms?: boolean;
}
