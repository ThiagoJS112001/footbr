import type { Lineup, Team } from '../models';
import type { Career } from './career';
import { autoPickLineup } from '../league/lineup';
import { repairLineup } from './progression';
import { ownTeam } from './world';

export type LineupPreset = 'main' | 'reserve' | 'cup';
export const presetLabels = { main: 'Principal', reserve: 'Reserva', cup: 'Copa' };
export function saveLineupPreset(career: Career, name: LineupPreset): Career {
  const team = ownTeam(career);
  const lineup = career.lineup ?? autoPickLineup(team, undefined, true);
  return { ...career, systems: { ...career.systems, savedLineups: [...career.systems.savedLineups.filter((p) => p.teamId !== team.id || p.name !== name), { teamId: team.id, name, lineup: structuredClone(lineup) }] } };
}
export function loadLineupPreset(career: Career, name: LineupPreset): Career {
  const saved = career.systems.savedLineups.find((p) => p.teamId === career.selectedTeamId && p.name === name);
  if (!saved) throw new Error('Salve uma escalação neste espaço primeiro.');
  const next = { ...career, league: { ...career.league, teams: career.league.teams.map((t) => t.id === career.selectedTeamId ? { ...t, defaultTactic: { ...saved.lineup.tactic } } : t) } };
  const repaired = repairLineup(next, saved.lineup);
  if (!repaired.lineup) throw new Error('Não há jogadores disponíveis para a formação salva.');
  return repaired;
}
export function preparationWarnings(team: Team, lineup: Lineup | null, previous?: Lineup): string[] {
  const notes: string[] = [];
  if (!lineup) return ['Não há escalação completa. Revise o elenco antes de jogar.'];
  for (const id of previous?.starterIds ?? []) {
    const player = team.squad.find((p) => p.id === id);
    if (!player) notes.push('Um titular da escalação salva deixou o clube.');
    else if (player.injury || player.discipline.suspendedMatches) notes.push(`${player.name}: ${player.injury ? 'lesionado' : 'suspenso'}; a vaga foi reposta.`);
  }
  const exhausted = team.squad.filter((p) => lineup.starterIds.includes(p.id) && p.fitness < 70);
  if (exhausted.length) notes.push(`Titulares cansados: ${exhausted.map((p) => `${p.name} (${Math.round(p.fitness)}%)`).join(', ')}.`);
  const bench = team.squad.filter((p) => lineup.substituteIds.includes(p.id) && !p.injury && !p.discipline.suspendedMatches);
  if (bench.length < 5) notes.push(`Banco curto: ${bench.length} reserva(s) para até cinco substituições.`);
  if (!bench.some((p) => p.primaryPosition === 'GK')) notes.push('O banco está sem goleiro reserva.');
  return [...new Set(notes)];
}
