export class BracketMatchDTO {
  id: string;
  round: number;
  position: number;
  participant1Id: string | null;
  participant2Id: string | null;
  winnerId: string | null;
  score: string | null;
  isBye: boolean;
}

export class BracketRoundDTO {
  round: number;
  matches: BracketMatchDTO[];
}

export class BracketDTO {
  tournamentId: string;
  status: string;
  rounds: BracketRoundDTO[];
  champion: string | null;
}

export class RecordMatchResultDto {
  winnerId: string;
  score: string;
}
