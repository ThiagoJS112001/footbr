import type { PlayerPosition } from '../models/Player.ts';
import type { Team } from '../models/Team.ts';
import { generateClubName } from './names.ts';
import { generatePlayer } from './player.ts';
import { createRng, randomInt } from './random.ts';

const squadPositions: readonly PlayerPosition[] = [
  'GK', 'GK', 'GK',
  'CB', 'CB', 'CB', 'CB', 'LB', 'LB', 'RB', 'RB',
  'DM', 'DM', 'CM', 'CM', 'CM', 'CM', 'AM', 'AM',
  'LW', 'LW', 'RW', 'RW', 'ST', 'ST',
];

export function generateTeam(seed: number, reputation = 50): Team {
  if (!Number.isFinite(reputation) || reputation < 0 || reputation > 100) {
    throw new RangeError('A reputação deve estar entre 0 e 100.');
  }
  const rng = createRng(seed);
  const identity = generateClubName(rng);
  const id = `team-${seed}`;
  const targetOverall = 35 + reputation * 0.5;
  const squad = squadPositions.map((position, index) => ({
    ...generatePlayer(rng, position, targetOverall + randomInt(rng, -6, 6)),
    id: `${id}-player-${index + 1}`,
    currentTeamId: id,
  }));
  const payroll = squad.reduce((sum, player) => sum + player.contract!.salary, 0);
  return {
    id, ...identity, division: 1, squad, reputation, payroll,
    budget: Math.round(payroll * (6 + reputation / 10)),
    stadium: { capacity: 5000 + Math.round(reputation * 550), ticketPrice: 15 + Math.round(reputation * 0.7) },
    defaultTactic: { formation: '4-4-2', style: 'balanced', markingIntensity: 'medium' },
  };
}
