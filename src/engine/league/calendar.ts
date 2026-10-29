import type { LeagueRound } from '../models/League.ts';
import type { Match } from '../models/Match.ts';

/** Método do círculo, incluindo folga quando N é ímpar; returno espelhado. */
export function generateSchedule(teamIds: readonly string[]): LeagueRound[] {
  if (teamIds.length < 2 || new Set(teamIds).size !== teamIds.length) {
    throw new Error('O calendário exige pelo menos dois times com IDs únicos.');
  }
  const circle: (string | null)[] = [...teamIds];
  if (circle.length % 2 !== 0) circle.push(null);
  const firstLeg: LeagueRound[] = [];
  for (let round = 0; round < circle.length - 1; round++) {
    const matches: Match[] = [];
    for (let pair = 0; pair < circle.length / 2; pair++) {
      const left = circle[pair];
      const right = circle[circle.length - 1 - pair];
      if (left === null || right === null) continue;
      const leftHome = pair === 0 ? round % 2 === 0 : pair % 2 === 0;
      const homeTeamId = leftHome ? left : right;
      const awayTeamId = leftHome ? right : left;
      matches.push({
        id: `round-${round + 1}-${homeTeamId}-${awayTeamId}`, homeTeamId, awayTeamId,
        status: 'scheduled', homeLineup: null, awayLineup: null, score: null, events: [], statistics: null,
      });
    }
    firstLeg.push({ round: round + 1, matches });
    circle.splice(1, 0, circle.pop()!);
  }
  const secondLeg = firstLeg.map((round) => ({
    round: round.round + firstLeg.length,
    matches: round.matches.map((match) => ({
      ...match, id: `return-${match.id}`, homeTeamId: match.awayTeamId, awayTeamId: match.homeTeamId,
      events: [],
    })),
  }));
  return [...firstLeg, ...secondLeg];
}
