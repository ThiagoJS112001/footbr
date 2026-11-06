import type { Team } from '../models';
import type { Career } from './career';

export const worldTeams = (career: Pick<Career, 'league' | 'otherLeague'>) => [...career.league.teams, ...career.otherLeague.teams];
export const ownTeam = (career: Career) => worldTeams(career).find((t) => t.id === career.selectedTeamId)!;
export function requireManagedClub(career: Career): void {
  if (!career.selectedTeamId || !worldTeams(career).some((t) => t.id === career.selectedTeamId)) throw new Error('Escolha um clube primeiro.');
  if (career.systems.board.status === 'dismissed') throw new Error('Seu vínculo foi encerrado. Escolha um novo emprego para gerenciar um clube.');
}
export const completedRounds = (career: Pick<Career, 'league'>) => career.league.schedule.filter((r) => r.matches.every((m) => m.status === 'finished')).length;
export const monthlyPayroll = (team: Team) => team.squad.reduce((sum, p) => sum + (p.contract?.salary ?? 0), 0);
export function replaceTeams(career: Career, teams: Team[]): Career {
  const replacements = new Map(teams.map((t) => [t.id, { ...t, payroll: monthlyPayroll(t) }]));
  return { ...career, league: { ...career.league, teams: career.league.teams.map((t) => replacements.get(t.id) ?? t) },
    otherLeague: { ...career.otherLeague, teams: career.otherLeague.teams.map((t) => replacements.get(t.id) ?? t) } };
}
