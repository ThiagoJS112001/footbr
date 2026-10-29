import type { League, LeagueStanding } from '../models/League.ts';
import type { Match } from '../models/Match.ts';
import { createRng, randomInt } from '../generators/random.ts';
import { leagueConfig } from './config.ts';

function emptyStanding(teamId: string): LeagueStanding {
  return { teamId, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0, position: 0, qualified: false, relegated: false };
}

function accumulate(rows: Map<string, LeagueStanding>, matches: readonly Match[]): void {
  for (const match of matches) {
    if (match.status !== 'finished' || !match.score) continue;
    const home = rows.get(match.homeTeamId);
    const away = rows.get(match.awayTeamId);
    if (!home || !away) continue;
    home.played++; away.played++;
    home.goalsFor += match.score.home; home.goalsAgainst += match.score.away;
    away.goalsFor += match.score.away; away.goalsAgainst += match.score.home;
    if (match.score.home === match.score.away) {
      home.draws++; away.draws++;
      home.points += leagueConfig.drawPoints; away.points += leagueConfig.drawPoints;
    } else {
      const winner = match.score.home > match.score.away ? home : away;
      const loser = winner === home ? away : home;
      winner.wins++; loser.losses++; winner.points += leagueConfig.winPoints;
    }
  }
  for (const row of rows.values()) row.goalDifference = row.goalsFor - row.goalsAgainst;
}

const primaryOrder = (a: LeagueStanding, b: LeagueStanding) => b.points - a.points || b.wins - a.wins || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor;

/** Confronto direto é uma minitabela entre todos os clubes empatados. */
export function calculateStandings(league: League, seed: number): LeagueStanding[] {
  const rng = createRng(seed);
  const matches = league.schedule.flatMap((round) => round.matches);
  const rows = new Map(league.teams.map((team) => [team.id, emptyStanding(team.id)]));
  accumulate(rows, matches);
  const lottery = [...rows.keys()].sort();
  for (let index = lottery.length - 1; index > 0; index--) {
    const other = randomInt(rng, 0, index);
    [lottery[index], lottery[other]] = [lottery[other], lottery[index]];
  }
  const lotteryRank = new Map(lottery.map((id, index) => [id, index]));
  const sorted = [...rows.values()].sort(primaryOrder);
  const result: LeagueStanding[] = [];
  for (let start = 0; start < sorted.length;) {
    let end = start + 1;
    while (end < sorted.length && primaryOrder(sorted[start], sorted[end]) === 0) end++;
    const group = sorted.slice(start, end);
    const miniTable = new Map(group.map((row) => [row.teamId, emptyStanding(row.teamId)]));
    accumulate(miniTable, matches);
    group.sort((a, b) => {
      const h2hA = miniTable.get(a.teamId)!;
      const h2hB = miniTable.get(b.teamId)!;
      return h2hB.points - h2hA.points || h2hB.goalDifference - h2hA.goalDifference || h2hB.goalsFor - h2hA.goalsFor
        || lotteryRank.get(a.teamId)! - lotteryRank.get(b.teamId)!;
    });
    result.push(...group);
    start = end;
  }
  return result.map((row, index) => ({
    ...row, position: index + 1,
    qualified: index < league.rules.qualificationSpots,
    relegated: index >= result.length - league.rules.relegationSpots,
  }));
}
