import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LeaderboardEntryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  score: number;

  @ApiPropertyOptional({ nullable: true })
  rank: number | null;

  @ApiPropertyOptional({ nullable: true })
  seasonId: string | null;

  @ApiPropertyOptional({ nullable: true })
  metadata: unknown | null;

  @ApiProperty()
  updatedAt: Date;
}

export class PagedLeaderboardDto {
  @ApiProperty({ type: [LeaderboardEntryDto] })
  data: LeaderboardEntryDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}

export class PlayerRankDto {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  score: number;

  @ApiPropertyOptional({ nullable: true })
  rank: number | null;

  @ApiPropertyOptional({ nullable: true })
  seasonId: string | null;
}

export class AroundPlayerDto {
  @ApiProperty({ type: [LeaderboardEntryDto] })
  above: LeaderboardEntryDto[];

  @ApiProperty({ type: LeaderboardEntryDto })
  player: LeaderboardEntryDto;

  @ApiProperty({ type: [LeaderboardEntryDto] })
  below: LeaderboardEntryDto[];
}
