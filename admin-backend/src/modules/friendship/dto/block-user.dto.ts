import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class BlockUserDto {
  @ApiProperty({
    description: 'The user ID performing the block',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  userId: string;

  @ApiProperty({
    description: 'The user ID to block',
    example: '660e8400-e29b-41d4-a716-446655440001',
  })
  @IsUUID()
  targetId: string;
}
