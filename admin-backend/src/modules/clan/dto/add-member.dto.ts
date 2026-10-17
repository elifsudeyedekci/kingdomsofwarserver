import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export const CLAN_ROLES = ['member', 'officer', 'leader'] as const;
export type ClanRole = (typeof CLAN_ROLES)[number];

export class AddMemberDto {
  @ApiProperty({ description: 'User ID to add to the clan' })
  @IsString()
  userId: string;

  @ApiPropertyOptional({
    description: 'Role assigned to the new member',
    enum: CLAN_ROLES,
    default: 'member',
  })
  @IsOptional()
  @IsIn(CLAN_ROLES)
  role?: ClanRole;
}
