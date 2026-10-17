import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsIn } from 'class-validator';

export const TOURNAMENT_STATUSES = [
  'upcoming',
  'registration',
  'active',
  'completed',
  'cancelled',
] as const;

export type TournamentStatus = (typeof TOURNAMENT_STATUSES)[number];

export class UpdateTournamentStatusDto {
  @ApiProperty({ enum: TOURNAMENT_STATUSES, example: 'active' })
  @IsString()
  @IsIn(TOURNAMENT_STATUSES)
  status: TournamentStatus;
}
