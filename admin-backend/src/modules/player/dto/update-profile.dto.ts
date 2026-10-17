import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'The Iron Warrior' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  displayName?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/avatars/warrior.png' })
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiPropertyOptional({ example: 'english' })
  @IsOptional()
  @IsString()
  favoriteCivId?: string;
}
