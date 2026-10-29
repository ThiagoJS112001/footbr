import type { Player, PlayerAttributes, PlayerPosition } from '../models/Player.ts';
import { generatePlayerName } from './names.ts';
import { pick, randomInt } from './random.ts';
import type { Rng } from './random.ts';

type Attribute = keyof PlayerAttributes;
type Weights = Partial<Record<Attribute, number>>;

const weights: Record<PlayerPosition, Weights> = {
  GK: { goalkeeping: 8, passing: 1, stamina: 1 },
  CB: { defense: 6, stamina: 2, passing: 1, speed: 1 },
  LB: { defense: 4, speed: 3, passing: 2, stamina: 1 },
  RB: { defense: 4, speed: 3, passing: 2, stamina: 1 },
  DM: { defense: 4, midfield: 3, passing: 2, stamina: 1 },
  CM: { midfield: 5, passing: 3, stamina: 2 },
  AM: { midfield: 4, passing: 3, attack: 2, finishing: 1 },
  LW: { attack: 4, speed: 3, finishing: 2, passing: 1 },
  RW: { attack: 4, speed: 3, finishing: 2, passing: 1 },
  ST: { finishing: 5, attack: 3, speed: 1, stamina: 1 },
};

const secondaryPositions: Record<PlayerPosition, readonly PlayerPosition[]> = {
  GK: [], CB: ['DM'], LB: ['RB', 'LW'], RB: ['LB', 'RW'],
  DM: ['CM', 'CB'], CM: ['DM', 'AM'], AM: ['CM', 'ST'],
  LW: ['RW', 'AM'], RW: ['LW', 'AM'], ST: ['AM', 'LW', 'RW'],
};

export function calculateOverall(attributes: PlayerAttributes, position: PlayerPosition): number {
  let total = 0;
  let weightTotal = 0;
  for (const [key, weight] of Object.entries(weights[position])) {
    total += attributes[key as Attribute] * weight;
    weightTotal += weight;
  }
  return Math.round(total / weightTotal);
}

/** Valores monetários em reais; salário mensal. */
export function generatePlayer(rng: Rng, position: PlayerPosition, targetOverall: number): Player {
  if (!Number.isFinite(targetOverall) || targetOverall < 1 || targetOverall > 99) {
    throw new RangeError('O overall desejado deve estar entre 1 e 99.');
  }
  const attributeNames: Attribute[] = ['attack', 'midfield', 'defense', 'goalkeeping', 'speed', 'passing', 'finishing', 'stamina'];
  const attributes = {} as PlayerAttributes;
  for (const key of attributeNames) {
    const weight = weights[position][key] ?? 0;
    const offset = weight >= 4 ? 3 : weight > 0 ? -4 : -24;
    const value = key === 'goalkeeping' && position !== 'GK'
      ? randomInt(rng, 1, 15)
      : targetOverall + offset + randomInt(rng, -5, 5);
    attributes[key] = Math.max(1, Math.min(99, Math.round(value)));
  }
  const age = randomInt(rng, 17, 36);
  const overall = calculateOverall(attributes, position);
  const qualityValue = 10000 * (overall / 10) ** 3;
  // Jovens preservam valor de revenda; veteranos recebem salário pela experiência.
  const resaleFactor = age <= 23 ? 1.3 : Math.max(0.3, 1.15 - (age - 24) * 0.07);
  const experienceFactor = age < 23 ? 0.85 : age <= 30 ? 1 : 0.9;
  const secondary = secondaryPositions[position];
  return {
    id: `player-${randomInt(rng, 0, 0xffff_ffff).toString(16)}-${randomInt(rng, 0, 0xffff_ffff).toString(16)}`,
    name: generatePlayerName(rng), age,
    nationality: pick(rng, ['Brasil', 'Brasil', 'Brasil', 'Argentina', 'Uruguai', 'Paraguai', 'Chile', 'Colômbia']),
    primaryPosition: position,
    secondaryPosition: secondary.length === 0 ? null : pick(rng, secondary),
    attributes, overall, morale: randomInt(rng, 60, 90), fitness: randomInt(rng, 85, 100),
    injury: null,
    contract: { salary: Math.round(qualityValue * 0.012 * experienceFactor / 100) * 100 + 100, yearsRemaining: randomInt(rng, 1, 5) },
    marketValue: Math.round(qualityValue * resaleFactor / 1000) * 1000,
    currentTeamId: null,
  };
}
