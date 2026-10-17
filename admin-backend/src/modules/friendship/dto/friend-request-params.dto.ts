import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class RequestIdParamDto {
  @ApiProperty({
    description: 'The FriendRequest record ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  requestId: string;
}

export class AcceptRequestParamDto {
  @ApiProperty({
    description: 'The FriendRequest record ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  requestId: string;

  @ApiProperty({
    description: 'The user ID accepting the request (must be the receiver)',
    example: '660e8400-e29b-41d4-a716-446655440001',
  })
  @IsUUID()
  userId: string;
}

export class RemoveFriendParamDto {
  @ApiProperty({
    description: 'The user ID initiating the removal',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  userId: string;

  @ApiProperty({
    description: 'The friend user ID to remove',
    example: '660e8400-e29b-41d4-a716-446655440001',
  })
  @IsUUID()
  friendId: string;
}
