import { generateTeam } from '../generators/team';
import { createRng, randomInt } from '../generators/random';
import type { PlayerPosition, Team } from '../models';
import type { Career } from './career';
import type { Academy } from './types';
import { addFinance } from './career';
import { careerConfig as config } from './config';
import { ownTeam, replaceTeams, requireManagedClub } from './world';

export function createAcademy(team: Team | undefined, seed: number, season: number): Academy {
  if (!team) return { teamId: null, season, promoted: 0, prospects: [] };
  let clubHash = 0;
  for (const char of team.id) clubHash = (Math.imul(clubHash, 31) + char.charCodeAt(0)) >>> 0;
  const rng = createRng((seed ^ season ^ clubHash) >>> 0);
  const academy = generateTeam(randomInt(rng, 0, 0xffff_ffff), Math.max(5, team.reputation - 25));
  const positions: PlayerPosition[] = ['GK', 'CB', 'CM', 'LW', 'ST'];
  return { teamId: team.id, season, promoted: 0, prospects: positions.slice(0, config.academyProspects).map((position, i) => {
    const player = academy.squad.find((p) => p.primaryPosition === position)!;
    return { assessed: false, status: 'available', player: { ...player, id: `${team.id}-prospect-${season}-${i}`, currentTeamId: null, contract: null,
      age: randomInt(rng, 16, 18), potential: Math.min(94, player.overall + randomInt(rng, 4, 23)), fitness: 100 } };
  }) };
}
export function assessProspect(career: Career, playerId: string, round: number): Career {
  requireManagedClub(career);
  const prospect = career.systems.academy.prospects.find((p) => p.player.id === playerId);
  if (!prospect || prospect.status !== 'available' || prospect.assessed) throw new Error('Escolha um jovem disponível e ainda não avaliado.');
  if (ownTeam(career).budget < config.assessmentFee) throw new Error('Saldo insuficiente para avaliar o jovem.');
  const next = addFinance(career, career.selectedTeamId!, round, `Avaliação da base · ${prospect.player.name}`, -config.assessmentFee);
  return { ...next, systems: { ...next.systems, academy: { ...next.systems.academy, prospects: next.systems.academy.prospects.map((p) => p.player.id === playerId ? { ...p, assessed: true } : p) } } };
}
export const prospectSalary = (overall: number) => Math.max(1000, Math.round(10000 * (overall / 10) ** 3 * .006 / 100) * 100);
export function promoteProspect(career: Career, playerId: string, round: number): Career {
  requireManagedClub(career);
  const academy = career.systems.academy;
  const prospect = academy.prospects.find((p) => p.player.id === playerId);
  const team = ownTeam(career);
  if (!prospect || prospect.status !== 'available') throw new Error('Jovem indisponível para promoção.');
  if (academy.promoted >= config.maxPromotions) throw new Error('Limite de três promoções nesta temporada atingido.');
  if (team.squad.length >= 35 || team.squad.some((p) => p.id === playerId)) throw new Error('Não há vaga disponível no elenco.');
  const salary = prospectSalary(prospect.player.overall);
  if (team.budget < salary * 2) throw new Error('Saldo insuficiente para as luvas de promoção.');
  const player = { ...prospect.player, currentTeamId: team.id, contract: { salary, yearsRemaining: 3 } };
  let next = replaceTeams(career, [{ ...team, squad: [...team.squad, player] }]);
  next = addFinance(next, team.id, round, `Promoção da base · ${player.name}`, -salary * 2);
  return { ...next, news: [`${player.name} foi promovido ao elenco profissional.`, ...next.news].slice(0, 20), systems: { ...next.systems,
    academy: { ...academy, promoted: academy.promoted + 1, prospects: academy.prospects.map((p) => p.player.id === playerId ? { ...p, status: 'promoted' } : p) } } };
}
export function releaseProspect(career: Career, playerId: string): Career {
  requireManagedClub(career);
  const prospect = career.systems.academy.prospects.find((p) => p.player.id === playerId);
  if (!prospect || prospect.status !== 'available') throw new Error('Jovem indisponível.');
  return { ...career, systems: { ...career.systems, academy: { ...career.systems.academy, prospects: career.systems.academy.prospects.map((p) => p.player.id === playerId ? { ...p, status: 'released' } : p) } } };
}
