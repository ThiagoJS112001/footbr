import type { Player, PlayerPosition } from '../models';
import { autoPickLineup } from '../league';
import { calculateOverall } from '../generators/player';
import { createCareer, playerValue } from './career';
import { createSystems } from './bootstrap';
import { replaceTeams, worldTeams } from './world';

export const editablePositions: PlayerPosition[] = ['GK', 'CB', 'LB', 'RB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST'];

export interface CustomBase {
  version: 1;
  seed: number;
  clubs: Record<string, string>;
  players: Record<string, Pick<Player, 'name' | 'age' | 'overall' | 'primaryPosition'>>;
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const integer = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
const validName = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 100;

export function decodeCustomBase(raw: string): CustomBase {
  if (raw.length > 1_000_000) throw new Error('Arquivo de base muito grande.');
  let data: unknown;
  try { data = JSON.parse(raw); } catch { throw new Error('O arquivo não contém uma base JSON válida.'); }
  if (!record(data) || data.version !== 1 || !integer(data.seed, 0, 0xffffffff) || !record(data.clubs) || !record(data.players)) throw new Error('Formato de base inválido.');
  if (!Object.values(data.clubs).every(validName) || !Object.values(data.players).every((player) => record(player) && validName(player.name)
    && integer(player.age, 16, 60) && integer(player.overall, 1, 99) && editablePositions.includes(player.primaryPosition as PlayerPosition))) {
    throw new Error('Confira nomes, posições, idades entre 16 e 60 e força entre 1 e 99.');
  }
  return data as unknown as CustomBase;
}

export function createCustomCareer(base: CustomBase) {
  const career = createCareer(base.seed, true);
  const teams = worldTeams(career);
  const clubIds = new Set(teams.map((team) => team.id));
  const playerIds = new Set(teams.flatMap((team) => team.squad.map((player) => player.id)));
  if (Object.keys(base.clubs).some((id) => !clubIds.has(id)) || Object.keys(base.players).some((id) => !playerIds.has(id))) throw new Error('A base contém IDs incompatíveis com a semente.');
  const updated = replaceTeams(career, teams.map((team) => {
    const squad = team.squad.map((player) => {
      const patch = base.players[player.id];
      if (!patch) return player;
      const { name, age, overall, primaryPosition } = patch;
      const mapped = { ...player, name: name.trim(), age, primaryPosition,
        secondaryPosition: player.secondaryPosition === primaryPosition ? null : player.secondaryPosition };
      if (overall !== calculateOverall(player.attributes, primaryPosition)) {
        // Desloca os atributos juntos e mantém o resultado dentro dos limites do motor.
        for (let delta = -98; delta <= 98; delta++) {
          const attributes = Object.fromEntries(Object.entries(player.attributes).map(([key, value]) => [key, Math.max(1, Math.min(99, value + delta))])) as unknown as Player['attributes'];
          if (calculateOverall(attributes, primaryPosition) === overall) { mapped.attributes = attributes; break; }
        }
      }
      mapped.overall = overall;
      mapped.potential = Math.max(overall, mapped.potential ?? overall);
      mapped.marketValue = playerValue(mapped);
      return mapped;
    });
    const club = { ...team, name: base.clubs[team.id]?.trim() ?? team.name, squad };
    try { autoPickLineup(club); } catch { throw new Error(club.name + ' precisa de um elenco que cubra a formação inicial.'); }
    return club;
  }));
  return { ...updated, systems: createSystems(updated) };
}
