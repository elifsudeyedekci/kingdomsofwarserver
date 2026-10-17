import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export enum QuestResetType {
  Daily    = 'daily',
  Weekly   = 'weekly',
  Seasonal = 'seasonal',
}

export class CreateQuestDto {
  @ApiProperty()
  @IsString()
  type: string;

  @ApiProperty()
  @IsString()
  titleKey: string;

  @ApiProperty()
  @IsString()
  descKey: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  xpReward?: number;

  @ApiPropertyOptional()
  @IsOptional()
  rewardData?: any;

  @ApiProperty()
  conditions: any;

  @ApiPropertyOptional({ enum: QuestResetType })
  @IsOptional()
  @IsEnum(QuestResetType)
  resetType?: QuestResetType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  civId?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  minAge?: number;
}
