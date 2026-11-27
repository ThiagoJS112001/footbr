import { generateTeam } from '../generators/team';
import { adjustAttributes, calculateOverall } from '../generators/player';
import { createRng, randomInt } from '../generators/random';
import type { PlayerPosition, Team } from '../models';
import type { Career } from './career';
import type { Academy } from './types';
import { addFinance } from './career';
import { careerConfig as config } from './config';
import { ownTeam, replaceTeams, requireManagedClub } from './world';
import { clubProfile, identityHash } from '../models/personality';
import { rosterSize } from './market';

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
      age: randomInt(rng, 16, 18), potential: Math.min(94, player.overall + randomInt(rng, 4, 23) + (clubProfile(team) === 'academy' ? 3 : 0)), fitness: 100 } };
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
  return promoteForClub(career, ownTeam(career), career.systems.academy, playerId, round);
}

export function clubAcademy(career: Career, team: Team): Academy {
  if (career.systems.academy.teamId === team.id) return career.systems.academy;
  return career.systems.academies?.find((entry) => entry.teamId === team.id) ?? createAcademy(team, career.seed, career.season);
}

export function saveAcademy(career: Career, academy: Academy): Career {
  const systems = career.systems;
  return { ...career, systems: academy.teamId === career.selectedTeamId ? { ...systems, academy }
    : { ...systems, academies: [...(systems.academies ?? []).filter((entry) => entry.teamId !== academy.teamId), academy] } };
}

export function promoteForClub(career: Career, team: Team, academy: Academy, playerId: string, round: number): Career {
  const prospect = academy.prospects.find((p) => p.player.id === playerId);
  if (!prospect || prospect.status !== 'available') throw new Error('Jovem indisponível para promoção.');
  if (academy.promoted >= config.maxPromotions) throw new Error('Limite de três promoções nesta temporada atingido.');
  if (rosterSize(career, team.id) >= 35 || team.squad.some((p) => p.id === playerId)) throw new Error('Não há vaga disponível no elenco.');
  const salary = prospectSalary(prospect.player.overall);
  if (team.budget < salary * 2) throw new Error('Saldo insuficiente para as luvas de promoção.');
  const player = { ...prospect.player, academyClubId: prospect.player.academyClubId ?? team.id, currentTeamId: team.id, contract: { salary, yearsRemaining: 3 } };
  let next = replaceTeams(career, [{ ...team, squad: [...team.squad, player] }]);
  next = addFinance(next, team.id, round, `Promoção da base · ${player.name}`, -salary * 2);
  if (team.id === career.selectedTeamId) next = { ...next, news: [`${player.name} foi promovido ao elenco profissional.`, ...next.news].slice(0, 20) };
  return saveAcademy(next, { ...academy, promoted: academy.promoted + 1, prospects: academy.prospects.map((p) => p.player.id === playerId ? { ...p, status: 'promoted' } : p) });
}

export function advanceAcademies(before: Career, after: Career): Career {
  let next = after;
  for (const team of [...(before.systems.academies ?? []), before.systems.academy]) {
    const club = after.league.teams.concat(after.otherLeague.teams, after.extraLeague?.teams ?? []).find((item) => item.id === team.teamId);
    if (!club) continue;
    const fresh = createAcademy(club, after.seed, after.season);
    const retained = team.prospects.filter((p) => p.status === 'available' && p.player.age < 19).map((prospect) => {
      const player = prospect.player;
      const gain = Math.min(Math.max(0, (player.potential ?? player.overall) - player.overall), clubProfile(club) === 'academy' ? 2 : 1);
      const attributes = adjustAttributes(player.attributes, gain);
      return { ...prospect, player: { ...player, age: player.age + 1, attributes, overall: calculateOverall(attributes, player.primaryPosition) } };
    });
    const released = team.prospects.filter((p) => p.status === 'available' && p.player.age >= 19 && p.player.academyClubId)
      .map(({ player }) => ({ ...player, age: player.age + 1 }));
    next = saveAcademy({ ...next, freeAgents: [...next.freeAgents, ...released] }, { ...fresh, prospects: [...retained, ...fresh.prospects].slice(0, 8) });
  }
  return next;
}

export function prospectReport(player: import('../models').Player, team: Team) {
  const estimated = (player.potential ?? player.overall) + identityHash(player.id) % 7 - 3;
  const low = Math.max(player.overall, estimated - 6);
  const high = Math.min(99, Math.max(low, estimated + 6));
  const peers = team.squad.filter((p) => p.primaryPosition === player.primaryPosition).sort((a, b) => b.overall - a.overall);
  const baseline = peers[1]?.overall ?? peers[0]?.overall ?? 0;
  return { low, high, readiness: player.overall >= baseline ? 'Pronto para disputar uma vaga no banco.' : 'Precisa de minutos e desenvolvimento antes de competir com os profissionais.',
    development: high - player.overall >= 15 ? 'Grande margem estimada de evolução.' : 'Margem estimada de evolução moderada.',
    uncertainty: 'Faixa estimada pelo departamento de base; minutos, idade e desenvolvimento determinam o resultado.' };
}
export function releaseProspect(career: Career, playerId: string): Career {
  requireManagedClub(career);
  const prospect = career.systems.academy.prospects.find((p) => p.player.id === playerId);
  if (!prospect || prospect.status !== 'available') throw new Error('Jovem indisponível.');
  return { ...career, systems: { ...career.systems, academy: { ...career.systems.academy, prospects: career.systems.academy.prospects.map((p) => p.player.id === playerId ? { ...p, status: 'released' } : p) } } };
}
