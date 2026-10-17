import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class GuestDto {
  @ApiProperty({ example: 'b6f1c1de-0d0c-4d6a-9a53-0f4f2f0e7a11', description: 'Random id generated once by the game client' })
  @IsString() @Matches(/^[A-Za-z0-9-]{16,64}$/)
  guestId!: string;

  @ApiProperty({ description: 'Random secret generated once by the game client (24-128 letters/digits)' })
  @IsString() @Matches(/^[A-Za-z0-9]{24,128}$/)
  secret!: string;
}
