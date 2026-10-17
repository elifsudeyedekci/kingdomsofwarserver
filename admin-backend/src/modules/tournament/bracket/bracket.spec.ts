import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BracketService } from './bracket.service';

describe('BracketService', () => {
  let service: BracketService;
  beforeEach(() => { service = new BracketService(); });

  it('8 participants → 3 rounds, 7 matches', () => {
    const bracket = service.generateBracket('t1', ['p1','p2','p3','p4','p5','p6','p7','p8']);
    expect(bracket.rounds).toHaveLength(3);
    const total = bracket.rounds.reduce((s, r) => s + r.matches.length, 0);
    expect(total).toBe(7);
  });

  it('5 participants → includes bye matches', () => {
    const bracket = service.generateBracket('t2', ['p1','p2','p3','p4','p5']);
    const byes = bracket.rounds[0].matches.filter((m) => m.isBye);
    expect(byes.length).toBeGreaterThan(0);
  });

  it('throws when fewer than 2 participants', () => {
    expect(() => service.generateBracket('t3', ['solo'])).toThrow(BadRequestException);
  });

  it('advances winner to next round', () => {
    const bracket = service.generateBracket('t4', ['p1','p2','p3','p4']);
    const first = bracket.rounds[0].matches.find((m) => !m.isBye)!;
    const winner = first.participant1Id as string;
    const updated = service.recordMatchResult('t4', first.id, winner, '2-0');
    expect(updated.rounds[1].matches[0].participant1Id).toBe(winner);
  });

  it('throws NotFoundException for unknown matchId', () => {
    service.generateBracket('t5', ['p1','p2']);
    expect(() => service.recordMatchResult('t5', 'bad-id', 'p1', '1-0')).toThrow(NotFoundException);
  });

  it('getBracket throws for missing tournament', () => {
    expect(() => service.getBracket('none')).toThrow(NotFoundException);
  });

  // ─── 4-player bracket scenarios ───────────────────────────────────────────

  describe('generateBracket_4Players_CreatesSemifinals', () => {
    it('produces exactly 2 rounds', () => {
      // 4 players is a power of 2 — no byes needed; 2 rounds (semis + final)
      const bracket = service.generateBracket('t6', ['p1', 'p2', 'p3', 'p4']);
      expect(bracket.rounds).toHaveLength(2);
    });

    it('round 1 has exactly 2 matches (semifinals)', () => {
      const bracket = service.generateBracket('t6', ['p1', 'p2', 'p3', 'p4']);
      expect(bracket.rounds[0].matches).toHaveLength(2);
    });

    it('round 2 has exactly 1 match (the final)', () => {
      const bracket = service.generateBracket('t6', ['p1', 'p2', 'p3', 'p4']);
      expect(bracket.rounds[1].matches).toHaveLength(1);
    });

    it('all 4 players appear exactly once across the 2 semifinal match slots', () => {
      const bracket = service.generateBracket('t6', ['p1', 'p2', 'p3', 'p4']);
      const semifinalParticipants = bracket.rounds[0].matches.flatMap((m) => [
        m.participant1Id,
        m.participant2Id,
      ]);
      // All 4 players must appear, each exactly once — no byes, no duplicates
      expect(semifinalParticipants).toHaveLength(4);
      expect(new Set(semifinalParticipants).size).toBe(4);
      expect(semifinalParticipants).toEqual(expect.arrayContaining(['p1', 'p2', 'p3', 'p4']));
    });

    it('no matches in round 1 are bye matches (4 is a perfect bracket size)', () => {
      const bracket = service.generateBracket('t6', ['p1', 'p2', 'p3', 'p4']);
      const byes = bracket.rounds[0].matches.filter((m) => m.isBye);
      expect(byes).toHaveLength(0);
    });
  });

  describe('recordMatchResult_SemifinalWinner_AdvancesToFinal', () => {
    it('semifinal winner is placed in the final match as participant1Id (first semifinal)', () => {
      // Arrange — generate bracket; inspect both semifinal matches dynamically
      const bracket = service.generateBracket('t7', ['p1', 'p2', 'p3', 'p4']);
      const sf1 = bracket.rounds[0].matches[0]; // first semifinal (index 0 → advances to final slot 0)
      const winner = sf1.participant1Id as string;

      // Act
      const updated = service.recordMatchResult('t7', sf1.id, winner, '2-1');

      // Assert — winner is written into round 2 final match participant1Id
      expect(updated.rounds[1].matches[0].participant1Id).toBe(winner);
    });

    it('semifinal winner is placed in the final match as participant2Id (second semifinal)', () => {
      // Arrange
      const bracket = service.generateBracket('t7', ['p1', 'p2', 'p3', 'p4']);
      const sf1 = bracket.rounds[0].matches[0];
      const sf2 = bracket.rounds[0].matches[1]; // second semifinal (index 1 → advances to final slot 1)

      // Record first semifinal first so the bracket state is valid
      const winner1 = sf1.participant1Id as string;
      service.recordMatchResult('t7', sf1.id, winner1, '2-0');

      const winner2 = sf2.participant1Id as string;

      // Act
      const updated = service.recordMatchResult('t7', sf2.id, winner2, '2-1');

      // Assert — second semifinal winner appears in participant2Id of the final
      expect(updated.rounds[1].matches[0].participant2Id).toBe(winner2);
    });

    it('final match has no winner set immediately after a semifinal is recorded', () => {
      // Arrange — only one semifinal recorded; final not yet playable
      const bracket = service.generateBracket('t7', ['p1', 'p2', 'p3', 'p4']);
      const sf1 = bracket.rounds[0].matches[0];
      const winner = sf1.participant1Id as string;

      // Act
      const updated = service.recordMatchResult('t7', sf1.id, winner, '2-0');

      // Assert — final match has one participant set but no winner yet
      expect(updated.rounds[1].matches[0].winnerId).toBeNull();
      expect(updated.champion).toBeNull();
    });
  });

  describe('generateBracket_4Players_Champion — full flow', () => {
    it('champion is set after all 3 matches (2 semis + 1 final) are recorded', () => {
      // Arrange
      const bracket = service.generateBracket('t8', ['p1', 'p2', 'p3', 'p4']);
      const sf1 = bracket.rounds[0].matches[0];
      const sf2 = bracket.rounds[0].matches[1];

      const winner1 = sf1.participant1Id as string;
      const winner2 = sf2.participant1Id as string;

      // Act — record both semis then the final
      service.recordMatchResult('t8', sf1.id, winner1, '2-1');
      service.recordMatchResult('t8', sf2.id, winner2, '2-0');

      const finalMatch = service.getBracket('t8').rounds[1].matches[0];
      const champion = finalMatch.participant1Id as string; // winner1 was seeded into slot 0
      const result = service.recordMatchResult('t8', finalMatch.id, champion, '3-1');

      // Assert
      expect(result.champion).toBe(champion);
      expect(result.status).toBe('completed');
    });

    it('bracket status transitions to "completed" only after the final is played', () => {
      // Arrange
      const bracket = service.generateBracket('t8', ['p1', 'p2', 'p3', 'p4']);
      expect(bracket.status).toBe('active');

      const sf1 = bracket.rounds[0].matches[0];
      const sf2 = bracket.rounds[0].matches[1];
      const w1 = sf1.participant1Id as string;
      const w2 = sf2.participant1Id as string;

      // Act — play semis; status should still be active
      service.recordMatchResult('t8', sf1.id, w1, '2-0');
      const afterSemis = service.recordMatchResult('t8', sf2.id, w2, '2-0');
      expect(afterSemis.status).toBe('active');

      // Play final
      const finalMatch = service.getBracket('t8').rounds[1].matches[0];
      const champ = finalMatch.participant1Id as string;
      const afterFinal = service.recordMatchResult('t8', finalMatch.id, champ, '2-1');

      // Assert
      expect(afterFinal.status).toBe('completed');
    });
  });
});
