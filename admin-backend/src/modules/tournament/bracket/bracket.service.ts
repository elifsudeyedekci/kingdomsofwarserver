import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { BracketDTO, BracketMatchDTO, BracketRoundDTO } from './dto/bracket.dto';

const bracketStore = new Map<string, BracketDTO>();

@Injectable()
export class BracketService {
  generateBracket(tournamentId: string, participantIds: string[]): BracketDTO {
    if (participantIds.length < 2) {
      throw new BadRequestException('At least 2 participants required');
    }
    const seeded = this.deterministicShuffle(participantIds, tournamentId);
    const rounds = this.buildSingleElimination(seeded);
    const bracket: BracketDTO = { tournamentId, status: 'active', rounds, champion: null };
    bracketStore.set(tournamentId, bracket);
    return bracket;
  }

  getBracket(tournamentId: string): BracketDTO {
    const bracket = bracketStore.get(tournamentId);
    if (!bracket) throw new NotFoundException(`Bracket for tournament '${tournamentId}' not found`);
    return bracket;
  }

  recordMatchResult(tournamentId: string, matchId: string, winnerId: string, score: string): BracketDTO {
    const bracket = this.getBracket(tournamentId);
    let found: BracketMatchDTO | undefined;
    let rIdx = -1;
    let mIdx = -1;
    for (let r = 0; r < bracket.rounds.length; r++) {
      const i = bracket.rounds[r].matches.findIndex((m) => m.id === matchId);
      if (i !== -1) { found = bracket.rounds[r].matches[i]; rIdx = r; mIdx = i; break; }
    }
    if (!found) throw new NotFoundException(`Match '${matchId}' not found`);
    if (winnerId !== found.participant1Id && winnerId !== found.participant2Id) {
      throw new BadRequestException(`Winner is not a participant in this match`);
    }
    if (found.isBye) throw new BadRequestException('Cannot record result for bye match');
    found.winnerId = winnerId; found.score = score;
    const nextR = rIdx + 1;
    if (nextR < bracket.rounds.length) {
      const nextM = bracket.rounds[nextR].matches[Math.floor(mIdx / 2)];
      if (nextM) { if (mIdx % 2 === 0) nextM.participant1Id = winnerId; else nextM.participant2Id = winnerId; }
    } else {
      bracket.champion = winnerId; bracket.status = 'completed';
    }
    bracketStore.set(tournamentId, bracket);
    return bracket;
  }

  private buildSingleElimination(participants: string[]): BracketRoundDTO[] {
    const size = this.nextPow2(participants.length);
    const padded = [...participants, ...Array<null>(size - participants.length).fill(null)] as (string | null)[];
    const rounds: BracketRoundDTO[] = [];
    let round = 1; let current = padded;
    while (current.length > 1) {
      const matches: BracketMatchDTO[] = [];
      for (let i = 0; i < current.length; i += 2) {
        const p1 = current[i]; const p2 = current[i + 1]; const isBye = p1 !== null && p2 === null;
        matches.push({ id: `${round}-${i / 2}`, round, position: i / 2, participant1Id: p1, participant2Id: p2, winnerId: isBye ? p1 : null, score: isBye ? 'BYE' : null, isBye });
      }
      rounds.push({ round, matches });
      current = matches.map((m) => m.winnerId); round++;
    }
    return rounds;
  }

  private deterministicShuffle(ids: string[], seed: string): string[] {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
    const arr = [...ids];
    for (let i = arr.length - 1; i > 0; i--) {
      h = (Math.imul(h, 1664525) + 1013904223) | 0;
      const j = Math.abs(h) % (i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  private nextPow2(n: number): number { let p = 1; while (p < n) p <<= 1; return p; }
}
