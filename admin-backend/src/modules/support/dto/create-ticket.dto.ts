import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { SupportTicketPriority } from '@prisma/client';

export class CreateTicketDto {
  @ApiProperty({ example: 'Cannot connect to match' })
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  subject: string;

  @ApiProperty({ example: 'After the latest update I keep getting error code 503.' })
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  body: string;

  @ApiProperty({ example: 'technical' })
  @IsString()
  @MaxLength(50)
  category: string;

  @ApiPropertyOptional({ enum: SupportTicketPriority, default: SupportTicketPriority.medium })
  @IsOptional()
  @IsEnum(SupportTicketPriority)
  priority?: SupportTicketPriority;
}
