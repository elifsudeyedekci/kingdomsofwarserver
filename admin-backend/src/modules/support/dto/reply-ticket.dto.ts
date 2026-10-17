import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ReplyTicketDto {
  @ApiProperty({ example: 'We are looking into this issue right now.' })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body: string;

  /**
   * ID of the sender (adminId or userId — resolved by the caller).
   * Stored inside the messages JSON array alongside the message body.
   */
  @ApiProperty({ example: 'admin-uuid-1' })
  @IsString()
  senderId: string;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  isAdminReply?: boolean;
}
