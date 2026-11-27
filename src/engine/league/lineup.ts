import type { Lineup } from '../models/Match.ts';
import type { Player, PlayerPosition } from '../models/Player.ts';
import type { Team } from '../models/Team.ts';
import { calculateOverall } from '../generators/player.ts';
import { leagueConfig } from './config.ts';
import { playerTrait } from '../models/personality.ts';

export class LineupUnavailableError extends Error {}

const specializedRows: Record<string, readonly (readonly PlayerPosition[])[]> = {
  '3-4-3': [['CB', 'CB', 'CB'], ['LB', 'DM', 'CM', 'RB'], ['LW', 'ST', 'RW']],
  '4-1-2-1-2': [['LB', 'CB', 'CB', 'RB'], ['DM'], ['CM', 'CM'], ['AM'], ['ST', 'ST']],
  '4-3-2-1': [['LB', 'CB', 'CB', 'RB'], ['DM', 'CM', 'CM'], ['AM', 'AM'], ['ST']],
};

export function formationRows(formation: string): readonly (readonly PlayerPosition[])[] {
  if (Object.hasOwn(specializedRows, formation)) return specializedRows[formation];
  const lines = formation.split('-').map(Number);
  if ((lines.length !== 3 && lines.length !== 4) || lines.some((count) => !Number.isInteger(count) || count < 1)
    || lines.reduce((sum, count) => sum + count, 0) !== 10) throw new Error('Formação inválida.');
  const defense: Record<number, PlayerPosition[]> = {
    1: ['CB'], 2: ['CB', 'CB'], 3: ['CB', 'CB', 'CB'],
    4: ['LB', 'CB', 'CB', 'RB'], 5: ['LB', 'CB', 'CB', 'CB', 'RB'],
  };
  const midfield: Record<number, PlayerPosition[]> = {
    1: ['DM'], 2: ['DM', 'CM'], 3: ['DM', 'CM', 'AM'],
    4: ['LW', 'CM', 'CM', 'RW'], 5: ['LW', 'DM', 'CM', 'AM', 'RW'],
  };
  const advanced: Record<number, PlayerPosition[]> = { 1: ['AM'], 2: ['AM', 'AM'], 3: ['LW', 'AM', 'RW'], 4: ['LW', 'CM', 'AM', 'RW'] };
  const attack: Record<number, PlayerPosition[]> = { 1: ['ST'], 2: ['ST', 'ST'], 3: ['LW', 'ST', 'RW'], 4: ['LW', 'ST', 'ST', 'RW'] };
  const blocks = [defense[lines[0]], midfield[lines[1]], ...(lines.length === 4 ? [advanced[lines[2]]] : []), attack[lines[lines.length - 1]]];
  if (blocks.some((block) => !block)) throw new Error('Formação não suportada.');
  return blocks;
}

export function formationSlots(formation: string): PlayerPosition[] {
  return ['GK', ...formationRows(formation).flat()];
}

export const formations = [
  '3-4-3', '3-5-2', '4-1-4-1', '4-2-3-1', '4-3-2-1', '4-3-3', '4-4-2', '4-1-2-1-2', '4-5-1', '5-3-2',
] as const;

export const maxReserves = 10;

export function selectReserves(players: readonly Player[]): string[] {
  const ranked = players.filter((player) => !player.injury && !player.discipline.suspendedMatches)
    .sort((a, b) => b.overall - a.overall || a.id.localeCompare(b.id));
  const bestByPosition = new Map<PlayerPosition, Player>();
  for (const player of ranked) {
    if (!bestByPosition.has(player.primaryPosition)) bestByPosition.set(player.primaryPosition, player);
  }
  const firstPicks = new Set(bestByPosition.values());
  return [...firstPicks, ...ranked.filter((player) => !firstPicks.has(player))].slice(0, maxReserves).map((player) => player.id);
}

/** Valida também a distribuição por posição, antes de permitir entrar em campo. */
export function validateLineup(team: Team, lineup: Lineup, allowUnavailable = false): void {
  const slots = formationSlots(lineup.tactic.formation);
  const ids = [...lineup.starterIds, ...lineup.substituteIds];
  if (lineup.starterIds.length !== 11 || new Set(ids).size !== ids.length) throw new Error('Selecione 11 titulares diferentes.');
  if (!['defensive', 'balanced', 'attacking'].includes(lineup.tactic.style)
    || !['low', 'medium', 'high'].includes(lineup.tactic.markingIntensity)) throw new Error('Tática inválida.');
  const occupied = lineup.starterIds.map((id) => {
    const player = team.squad.find((p) => p.id === id);
    const position = lineup.positions?.[id] ?? player?.primaryPosition;
    if (!player || !allowUnavailable && (player.injury || player.discipline.suspendedMatches > 0)) throw new Error('Há um titular indisponível. Revise a escalação.');
    if (position !== player.primaryPosition && position !== player.secondaryPosition) throw new Error('Jogador fora de sua posição.');
    return position;
  });
  for (const position of slots) {
    const index = occupied.indexOf(position);
    if (index < 0) throw new Error('A escalação não corresponde à formação.');
    occupied.splice(index, 1);
  }
  for (const id of lineup.substituteIds) {
    const player = team.squad.find((p) => p.id === id);
    if (!player || !allowUnavailable && (player.injury || player.discipline.suspendedMatches > 0)) throw new Error('Há um reserva indisponível.');
  }
}

/** Atribuição ótima de jogadores a posições (algoritmo Húngaro retangular). */
export function autoPickLineup(team: Team, preferred?: Lineup, considerFitness = false, personality = true): Lineup {
  const slots = formationSlots(team.defaultTactic.formation);
  const players = team.squad.filter((player) => player.injury === null && player.discipline.suspendedMatches === 0)
    .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  if (players.length < slots.length) throw new LineupUnavailableError(`${team.name}: menos de 11 jogadores disponíveis.`);
  const costs = slots.map((position) => players.map((player) => {
    const versatile = personality && playerTrait(player) === 'versatile';
    const factor = player.primaryPosition === position ? versatile ? .98 : 1 : player.secondaryPosition === position ? versatile ? .98 : leagueConfig.secondaryPositionFactor : 0;
    const keep = preferred?.starterIds.includes(player.id) && (preferred.positions?.[player.id] ?? player.primaryPosition) === position;
    const readiness = considerFitness ? .65 + player.fitness * .0035 : 1;
    return factor === 0 ? leagueConfig.unavailableCost : -calculateOverall(player.attributes, position) * factor * readiness - (keep ? 1000 : 0);
  }));
  const chosen = minimumCostAssignment(costs);
  if (chosen.some((column, row) => costs[row][column] === leagueConfig.unavailableCost)) {
    throw new LineupUnavailableError(`${team.name}: não há jogadores elegíveis para todas as posições.`);
  }
  const starterIds = chosen.map((column) => players[column].id);
  return {
    starterIds,
    substituteIds: selectReserves(players.filter((player) => !starterIds.includes(player.id))),
    positions: Object.fromEntries(starterIds.map((id, index) => [id, slots[index]])),
    tactic: { ...team.defaultTactic },
  };
}

/** Associa uma coluna única a cada linha de uma matriz com pelo menos tantas colunas quanto linhas. */
export function minimumCostAssignment(costs: number[][]): number[] {
  const rows = costs.length;
  const columns = costs[0].length;
  const u = Array(rows + 1).fill(0) as number[];
  const v = Array(columns + 1).fill(0) as number[];
  const p = Array(columns + 1).fill(0) as number[];
  const way = Array(columns + 1).fill(0) as number[];
  for (let row = 1; row <= rows; row++) {
    p[0] = row;
    let column = 0;
    const min = Array(columns + 1).fill(Infinity) as number[];
    const used = Array(columns + 1).fill(false) as boolean[];
    do {
      used[column] = true;
      const currentRow = p[column];
      let delta = Infinity;
      let next = 0;
      for (let candidate = 1; candidate <= columns; candidate++) {
        if (used[candidate]) continue;
        const cost = costs[currentRow - 1][candidate - 1] - u[currentRow] - v[candidate];
        if (cost < min[candidate]) { min[candidate] = cost; way[candidate] = column; }
        if (min[candidate] < delta) { delta = min[candidate]; next = candidate; }
      }
      for (let candidate = 0; candidate <= columns; candidate++) {
        if (used[candidate]) { u[p[candidate]] += delta; v[candidate] -= delta; }
        else min[candidate] -= delta;
      }
      column = next;
    } while (p[column] !== 0);
    do {
      const previous = way[column];
      p[column] = p[previous];
      column = previous;
    } while (column !== 0);
  }
  const chosen = Array(rows).fill(-1) as number[];
  for (let column = 1; column <= columns; column++) if (p[column]) chosen[p[column] - 1] = column - 1;
  return chosen;
}
