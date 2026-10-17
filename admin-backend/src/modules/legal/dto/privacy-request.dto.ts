import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsUUID } from 'class-validator';

export class CreatePrivacyRequestDto {
  @ApiProperty()
  @IsUUID()
  userId: string;

  @ApiProperty({ enum: ['export', 'delete'] })
  @IsIn(['export', 'delete'])
  type: 'export' | 'delete';
}
