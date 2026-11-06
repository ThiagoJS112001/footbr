import type { Lineup } from '../models/Match.ts';
import type { PlayerPosition } from '../models/Player.ts';
import type { Team } from '../models/Team.ts';
import { calculateOverall } from '../generators/player.ts';
import { leagueConfig } from './config.ts';

export class LineupUnavailableError extends Error {}

export function formationSlots(formation: string): PlayerPosition[] {
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
  return ['GK', ...blocks.flat()];
}

export const formations = ['4-4-2', '4-3-3', '4-2-3-1', '3-5-2', '5-3-2'] as const;

/** Valida também a distribuição por posição, antes de permitir entrar em campo. */
export function validateLineup(team: Team, lineup: Lineup): void {
  const slots = formationSlots(lineup.tactic.formation);
  const ids = [...lineup.starterIds, ...lineup.substituteIds];
  if (lineup.starterIds.length !== 11 || new Set(ids).size !== ids.length) throw new Error('Selecione 11 titulares diferentes.');
  if (!['defensive', 'balanced', 'attacking'].includes(lineup.tactic.style)
    || !['low', 'medium', 'high'].includes(lineup.tactic.markingIntensity)) throw new Error('Tática inválida.');
  const occupied = lineup.starterIds.map((id) => {
    const player = team.squad.find((p) => p.id === id);
    const position = lineup.positions?.[id] ?? player?.primaryPosition;
    if (!player || player.injury || player.discipline.suspendedMatches > 0) throw new Error('Há um titular indisponível. Revise a escalação.');
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
    if (!player || player.injury || player.discipline.suspendedMatches > 0) throw new Error('Há um reserva indisponível.');
  }
}

/** Atribuição ótima de jogadores a posições (algoritmo Húngaro retangular). */
export function autoPickLineup(team: Team, preferred?: Lineup, considerFitness = false): Lineup {
  const slots = formationSlots(team.defaultTactic.formation);
  const players = team.squad.filter((player) => player.injury === null && player.discipline.suspendedMatches === 0)
    .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  if (players.length < slots.length) throw new LineupUnavailableError(`${team.name}: menos de 11 jogadores disponíveis.`);
  const costs = slots.map((position) => players.map((player) => {
    const factor = player.primaryPosition === position ? 1 : player.secondaryPosition === position ? leagueConfig.secondaryPositionFactor : 0;
    const keep = preferred?.starterIds.includes(player.id) && (preferred.positions?.[player.id] ?? player.primaryPosition) === position;
    const readiness = considerFitness ? .65 + player.fitness * .0035 : 1;
    return factor === 0 ? leagueConfig.unavailableCost : -calculateOverall(player.attributes, position) * factor * readiness - (keep ? 1000 : 0);
  }));
  const u = Array(slots.length + 1).fill(0) as number[];
  const v = Array(players.length + 1).fill(0) as number[];
  const p = Array(players.length + 1).fill(0) as number[];
  const way = Array(players.length + 1).fill(0) as number[];
  for (let row = 1; row <= slots.length; row++) {
    p[0] = row;
    let column = 0;
    const min = Array(players.length + 1).fill(Infinity) as number[];
    const used = Array(players.length + 1).fill(false) as boolean[];
    do {
      used[column] = true;
      const currentRow = p[column];
      let delta = Infinity;
      let next = 0;
      for (let candidate = 1; candidate <= players.length; candidate++) {
        if (used[candidate]) continue;
        const cost = costs[currentRow - 1][candidate - 1] - u[currentRow] - v[candidate];
        if (cost < min[candidate]) { min[candidate] = cost; way[candidate] = column; }
        if (min[candidate] < delta) { delta = min[candidate]; next = candidate; }
      }
      for (let candidate = 0; candidate <= players.length; candidate++) {
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
  const chosen = Array(slots.length).fill(-1) as number[];
  for (let column = 1; column <= players.length; column++) if (p[column]) chosen[p[column] - 1] = column - 1;
  if (chosen.some((column, row) => costs[row][column] === leagueConfig.unavailableCost)) {
    throw new LineupUnavailableError(`${team.name}: não há jogadores elegíveis para todas as posições.`);
  }
  const starterIds = chosen.map((column) => players[column].id);
  return {
    starterIds,
    substituteIds: players.filter((player) => !starterIds.includes(player.id)).map((player) => player.id),
    positions: Object.fromEntries(starterIds.map((id, index) => [id, slots[index]])),
    tactic: { ...team.defaultTactic },
  };
}
