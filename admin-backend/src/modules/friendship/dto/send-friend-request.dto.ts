import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class SendFriendRequestDto {
  @ApiProperty({
    description: 'The user ID who is sending the request',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  fromUserId: string;

  @ApiProperty({
    description: 'The user ID who will receive the request',
    example: '660e8400-e29b-41d4-a716-446655440001',
  })
  @IsUUID()
  toUserId: string;
}
