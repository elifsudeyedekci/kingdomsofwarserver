import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ResolveTicketDto {
  @ApiProperty({ example: 'Refund was processed successfully. Issue closed.' })
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  resolution: string;
}
