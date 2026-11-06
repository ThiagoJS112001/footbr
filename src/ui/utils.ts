import type { Team, Match, PlayerPosition } from '../engine/models';

export const positionLabels: Record<PlayerPosition, string> = {
  GK: 'GOL', CB: 'ZAG', LB: 'LE', RB: 'LD', DM: 'VOL', CM: 'MC', AM: 'MEI', LW: 'PE', RW: 'PD', ST: 'ATA',
};
export const positionNames: Record<PlayerPosition, string> = {
  GK: 'Goleiro', CB: 'Zagueiro', LB: 'Lateral esquerdo', RB: 'Lateral direito', DM: 'Volante', CM: 'Meia central',
  AM: 'Meia ofensivo', LW: 'Ponta esquerda', RW: 'Ponta direita', ST: 'Atacante',
};
export const averageOverall = (team: Team) => team.squad.reduce((sum, player) => sum + player.overall, 0) / team.squad.length;
export const currency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
export const padRound = (round: number) => String(round).padStart(2, '0');
/** O calendário do motor usa intervalos de sete dias. Esta é sua representação visual. */
export function seasonDate(season: number, round: number, matchDay: boolean | number = false, baseYear = 2026): string {
  const offset = typeof matchDay === 'number' ? matchDay : matchDay ? 2 : 0;
  const date = new Date(Date.UTC(baseYear + season - 1, 0, 12 + (round - 1) * 7 + offset));
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).format(date).replaceAll(' de ', ' ').replaceAll('.', '');
}
export function matchOutcome(match: Match, teamId: string): 'V' | 'E' | 'D' {
  if (!match.score) throw new Error('Partida sem resultado.');
  if (match.winnerTeamId) return match.winnerTeamId === teamId ? 'V' : 'D';
  const home = match.homeTeamId === teamId;
  const own = home ? match.score.home : match.score.away;
  const opponent = home ? match.score.away : match.score.home;
  return own === opponent ? 'E' : own > opponent ? 'V' : 'D';
}
