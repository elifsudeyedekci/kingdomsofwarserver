import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class AssignTicketDto {
  @ApiProperty({ example: 'admin-uuid-1' })
  @IsString()
  adminId: string;
}
