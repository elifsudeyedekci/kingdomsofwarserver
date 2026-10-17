import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export const PROMOTABLE_ROLES = ['member', 'officer', 'leader'] as const;
export type PromotableRole = (typeof PROMOTABLE_ROLES)[number];

export class PromoteMemberDto {
  @ApiProperty({
    description: 'New role to assign to the member',
    enum: PROMOTABLE_ROLES,
  })
  @IsIn(PROMOTABLE_ROLES)
  role: PromotableRole;
}
