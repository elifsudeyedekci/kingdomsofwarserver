import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class RecordPromotionResultDto {
  @ApiProperty({ example: true, description: 'Whether the player won the promotion match' })
  @IsBoolean()
  isWin: boolean;
}
