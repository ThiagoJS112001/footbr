import type { League, Team } from '../models';
import type { Career } from './career';
import type { Board } from './types';
import { createAcademy } from './academy';
import { arrangeDivisions, completedRounds, ownTeam, worldLeagues, worldTeams } from './world';
import { clubProfile } from '../models/personality';
import { minutesPlayed } from '../league/season';

export function createBoard(team: Team | undefined, league: League, round = 0): Board {
  const rank = team ? 1 + league.teams.filter((t) => t.reputation > team.reputation).length : 10;
  const adjustment = !team ? 0 : clubProfile(team) === 'traditional' ? -2 : clubProfile(team) === 'community' ? -1 : 1;
  return { teamId: team?.id ?? null, targetPosition: Math.max(4, Math.min(16, rank + 3 + adjustment)), confidence: 65, status: 'active', lastReviewRound: round, appointedRound: round, startingPoints: league.standings.find((r) => r.teamId === team?.id)?.points ?? 0, reviews: [] };
}
export function evaluateBoard(career: Career, round: number): Career {
  const board = career.systems.board;
  if (!career.selectedTeamId || board.status === 'dismissed' || round <= board.lastReviewRound || round % 4 || round - board.appointedRound < 8) return career;
  const row = career.league.standings.find((r) => r.teamId === career.selectedTeamId)!;
  const team = ownTeam(career);
  const targetPpg = 2.25 - (board.targetPosition - 1) / 19 * 1.1;
  const ratio = (row.points - (board.startingPoints ?? 0)) / Math.max(1, row.played - board.appointedRound) / targetPpg;
  const performance = ratio >= 1 ? 8 : ratio >= .85 ? 2 : ratio >= .65 ? -6 : -12;
  const debtPenalty = team.budget < 0 ? Math.min(8, 2 + Math.floor(-team.budget / Math.max(1, team.payroll))) : 0;
  const youthIds = new Set(team.squad.filter((p) => p.age <= 21).map((p) => p.id));
  const youthMinutes = career.league.schedule.filter((r) => r.round > board.lastReviewRound && r.round <= round).flatMap((r) => r.matches)
    .filter((m) => m.homeTeamId === team.id || m.awayTeamId === team.id).reduce((sum, m) => sum + [...minutesPlayed(m, team.id)].filter(([id]) => youthIds.has(id)).reduce((s, [, minutes]) => s + minutes, 0), 0);
  const youthBonus = clubProfile(team) === 'academy' && youthMinutes >= 360 ? 3 : 0;
  const confidence = Math.max(0, Math.min(100, board.confidence + performance - debtPenalty + youthBonus));
  const dismissed = confidence <= 15;
  const note = dismissed ? 'A diretoria encerrou seu vínculo. Escolha uma proposta para continuar a carreira.' : `${row.position}º lugar, meta até ${board.targetPosition}º. ${team.budget < 0 ? 'A dívida também reduziu a confiança.' : performance >= 0 ? 'A diretoria reconhece o desempenho.' : 'A diretoria espera uma recuperação.'}${youthBonus ? ' A utilização dos sub-21 trouxe mais 3 pontos de confiança.' : ''}`;
  return { ...career, news: [note, ...career.news].slice(0, 20), systems: { ...career.systems, board: { ...board, confidence, status: dismissed ? 'dismissed' : 'active', lastReviewRound: round, reviews: [...board.reviews, { round, confidence, note }] } } };
}
export function availableJobs(career: Career): Team[] {
  if (career.systems.board.status !== 'dismissed') return [];
  const excluded = new Set([career.selectedTeamId, ...career.systems.jobs.filter((j) => j.season === career.season).flatMap((j) => [j.fromId, j.toId])]);
  return worldTeams(career).filter((t) => !excluded.has(t.id)).sort((a, b) => a.reputation - b.reputation || a.id.localeCompare(b.id)).slice(0, 3);
}
export function takeJob(career: Career, teamId: string): Career {
  if (!availableJobs(career).some((t) => t.id === teamId)) throw new Error('Proposta de emprego indisponível.');
  const league = worldLeagues(career).find((l) => l.teams.some((t) => t.id === teamId))!;
  const team = league.teams.find((t) => t.id === teamId)!;
  const round = completedRounds(career);
  return { ...career, selectedTeamId: teamId, ...arrangeDivisions(worldLeagues(career), league), lineup: null,
    finances: [...career.finances, { teamId, season: career.season, round, amount: 0, description: 'Início do trabalho no clube', balance: team.budget }],
    news: [`Você assumiu ${team.name} na rodada ${round}.`, ...career.news].slice(0, 20), systems: { ...career.systems, lastSummary: null,
      jobs: [...career.systems.jobs, { season: career.season, round, fromId: career.selectedTeamId!, toId: teamId }],
      board: createBoard(team, league, round), academy: createAcademy(team, career.seed, career.season), offers: career.systems.offers.map((o) => o.status === 'pending' ? { ...o, status: 'expired' } : o) } };
}
