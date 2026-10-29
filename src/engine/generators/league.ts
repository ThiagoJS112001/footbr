import type { League } from '../models/League.ts';
import { CLUB_NAME_CAPACITY, generateClubName } from './names.ts';
import { createRng, randomInt } from './random.ts';
import { generateTeam } from './team.ts';

/** Calendário e classificação são preparados ao iniciar o campeonato. */
export function generateLeague(seed: number, numTeams = 20): League {
  if (!Number.isInteger(numTeams) || numTeams < 2 || numTeams > CLUB_NAME_CAPACITY) {
    throw new RangeError(`A liga deve ter entre 2 e ${CLUB_NAME_CAPACITY} times.`);
  }
  const rng = createRng(seed);
  const nameIndices = Array.from({ length: CLUB_NAME_CAPACITY }, (_, index) => index);
  for (let index = nameIndices.length - 1; index > 0; index--) {
    const other = randomInt(rng, 0, index);
    [nameIndices[index], nameIndices[other]] = [nameIndices[other], nameIndices[index]];
  }
  const teams = Array.from({ length: numTeams }, (_, index) => {
    // Faixas estratificadas garantem clubes de forças variadas em qualquer seed.
    const reputation = Math.round(20 + (index / (numTeams - 1)) * 70);
    const team = generateTeam(randomInt(rng, 0, 0xffff_ffff), reputation);
    const id = `league-${seed}-team-${index + 1}`;
    return {
      ...team, id, ...generateClubName(rng, nameIndices[index]),
      squad: team.squad.map((player, playerIndex) => ({ ...player, id: `${id}-player-${playerIndex + 1}`, currentTeamId: id })),
    };
  });
  return {
    id: `league-${seed}`, name: 'Liga dos Horizontes', teams,
    schedule: [], standings: [],
    rules: { promotionSpots: 0, qualificationSpots: Math.min(4, Math.floor(numTeams / 2)), relegationSpots: Math.min(4, Math.floor(numTeams / 2)) },
  };
}
