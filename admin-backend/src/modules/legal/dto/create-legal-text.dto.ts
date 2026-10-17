import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreateLegalTextDto {
  @ApiProperty()
  @IsString()
  type: string;

  @ApiProperty()
  @IsString()
  version: string;

  @ApiProperty()
  @IsString()
  language: string;

  @ApiProperty()
  @IsString()
  content: string;
}
