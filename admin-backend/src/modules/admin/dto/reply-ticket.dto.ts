import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReplyTicketDto {
  @ApiProperty({ description: 'Reply message body from the support agent' })
  @IsString()
  @MinLength(1)
  message: string;
}
