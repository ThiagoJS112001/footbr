import { generateTeam } from '../generators/team';
import type { League, Lineup, Match, Team } from '../models';
import { createRng, randomInt } from '../generators/random';
import { finishMatch } from '../simulation/simulateMatch';
import { finishRound, startRound } from '../league/season';
import type { RoundSession } from '../league/season';
import type { Cup, CupRound } from './types';
import type { Career } from './career';
import { addFinance, seasonSeed } from './career';
import { careerConfig as config } from './config';
import { completedRounds, replaceTeams, worldTeams } from './world';
import { derbyAttendance } from './stories';
import { captureAwardsContext, finalizeCupAwards, noteManagedCoach } from './awards';

function fixtures(id: string, stage: number, ids: string[], weeks?: number[]): CupRound {
  const matches: Match[] = [];
  for (let i = 0; i < ids.length; i += 2) matches.push({ id: `${id}-${stage}-${i / 2}`, homeTeamId: ids[i], awayTeamId: ids[i + 1], status: 'scheduled', homeLineup: null, awayLineup: null, score: null, events: [], statistics: null });
  return { round: stage + 1, name: weeks ? ['Quartas de final', 'Semifinal', 'Final'][3 - weeks.length + stage] : config.cupNames[stage], afterRound: (weeks ?? config.cupWeeks)[stage], matches };
}
export function createCup(teams: Team[], seed: number, season: number, deferred = false): Cup {
  const ids = teams.map((t) => t.id);
  const rng = createRng((seed ^ 0xc0ffee) >>> 0);
  for (let i = ids.length - 1; i > 0; i--) { const j = randomInt(rng, 0, i); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  const id = `cup-${seed}-${season}`;
  const preliminaries = 2 * (ids.length - 32);
  return { id, name: 'Copa dos Horizontes', status: deferred ? 'deferred' : 'active', rounds: deferred ? [] : [fixtures(id, 0, ids.slice(0, preliminaries))], byeTeamIds: deferred ? [] : ids.slice(preliminaries), championId: null };
}
export const pendingCupRound = (career: Career, cup = career.systems.cup) => cup.status === 'active' ? cup.rounds.find((r) => r.matches.some((m) => m.status !== 'finished')) : undefined;
export const dueCupRound = (career: Career, cup = career.systems.cup) => { const round = pendingCupRound(career, cup); return round && round.afterRound <= completedRounds(career) ? round : undefined; };
export function cupLeague(career: Career, cup = career.systems.cup): League {
  const stage = dueCupRound(career, cup);
  if (!stage) throw new Error('Não há rodada da copa para jogar agora.');
  return { id: cup.id, name: cup.name, teams: [...worldTeams(career), ...cupGuests(cup)], schedule: [{ round: stage.round, matches: stage.matches }], standings: [], rules: { promotionSpots: 0, qualificationSpots: 0, relegationSpots: 0 } };
}
export function startCupRound(career: Career, lineup?: Lineup | null, overrides: Record<string, Lineup> = {}, cup = career.systems.cup): RoundSession {
  return startRound(cupLeague(career, cup), (seasonSeed(career) ^ 0xc0ffee) >>> 0, { ...overrides, ...(lineup && career.selectedTeamId ? { [career.selectedTeamId]: lineup } : {}) });
}

/** Pênaltis decidem o vencedor sem somar gols à artilharia ou ao placar dos 90 minutos. */
export function decideCupMatch(match: Match, home: Team, away: Team, seed: number): Match {
  if (!match.score || match.status !== 'finished') throw new Error('Encerre os 90 minutos antes de decidir a eliminatória.');
  if (match.score.home !== match.score.away) return { ...match, winnerTeamId: match.score.home > match.score.away ? home.id : away.id };
  const rng = createRng(seed);
  if (match.forfeitTeamIds?.length === 2) return { ...match, winnerTeamId: rng() < .5 ? home.id : away.id };
  const skill = (team: Team) => team.squad.reduce((sum, p) => sum + p.overall, 0) / team.squad.length;
  const advantage = Math.max(-0.08, Math.min(0.08, (skill(home) - skill(away)) * 0.002));
  const penalties = { home: 0, away: 0 };
  for (let i = 0; i < 5; i++) { if (rng() < 0.75 + advantage) penalties.home++; if (rng() < 0.75 - advantage) penalties.away++; }
  for (let i = 0; penalties.home === penalties.away && i < 20; i++) { if (rng() < 0.75 + advantage) penalties.home++; if (rng() < 0.75 - advantage) penalties.away++; }
  if (penalties.home === penalties.away) { if (rng() < .5 + advantage) penalties.home++; else penalties.away++; }
  return { ...match, penalties, winnerTeamId: penalties.home > penalties.away ? home.id : away.id };
}

export function finishCupRound(career: Career, session: RoundSession, cup = career.systems.cup, coachName?: string): Career {
  career = captureAwardsContext(career);
  const stage = dueCupRound(career, cup);
  if (!stage || stage.round !== session.round) throw new Error('Etapa de copa incompatível.');
  const league = finishRound(cupLeague(career, cup), session, { days: 0, recovery: 0, onlyParticipants: true });
  const rng = createRng((session.seed ^ stage.round) >>> 0);
  const matches = league.schedule[0].matches.map((m) => noteManagedCoach(
    decideCupMatch(m, league.teams.find((t) => t.id === m.homeTeamId)!, league.teams.find((t) => t.id === m.awayTeamId)!, randomInt(rng, 0, 0xffff_ffff)), career.selectedTeamId, coachName));
  const winners = matches.map((m) => m.winnerTeamId!);
  const nextIds = stage.round === 1 ? [...winners, ...cup.byeTeamIds] : winners;
  let next = replaceTeams(career, league.teams);
  const finished = { ...stage, matches };
  const rounds = cup.rounds.map((r) => r.round === stage.round ? finished : r);
  if (nextIds.length > 1) rounds.push(fixtures(cup.id, stage.round, nextIds, cup.weeks));
  const updated: Cup = { ...cup, rounds, championId: nextIds.length === 1 ? nextIds[0] : null };
  next = { ...next, systems: { ...next.systems,
    cup: cup === career.systems.cup ? updated : next.systems.cup,
    stateCups: next.systems.stateCups?.map((item) => item.id === cup.id ? updated : item),
    continentalCups: next.systems.continentalCups?.map((item) => item.id === cup.id ? updated : item),
  } };
  for (const match of matches) {
    const home = worldTeams(next).find((t) => t.id === match.homeTeamId)!;
    if (home && !match.forfeitTeamIds?.length) next = addFinance(next, home.id, stage.afterRound, `Copa · bilheteria · ${stage.name}`, Math.round(home.stadium.capacity * Math.min(1, .65 * derbyAttendance(career, home, match.awayTeamId)) * home.stadium.ticketPrice * config.netGateShare));
    if (!cup.guestIds?.includes(match.winnerTeamId!)) next = addFinance(next, match.winnerTeamId!, stage.afterRound, `Copa · premiação · ${stage.name}`, [80000, 160000, 320000, 600000, 1000000, 2000000][stage.round - 1]);
  }
  const own = matches.find((m) => m.homeTeamId === career.selectedTeamId || m.awayTeamId === career.selectedTeamId);
  const note = own ? `${stage.name}: ${own.winnerTeamId === career.selectedTeamId ? updated.championId ? 'você conquistou a copa!' : 'classificação garantida.' : 'seu clube foi eliminado da copa.'}` : `${stage.name} da copa concluída.`;
  return finalizeCupAwards({ ...next, news: [note, ...next.news].slice(0, 20) }, updated);
}
export function playCupRound(career: Career, cup = career.systems.cup): Career {
  const session = startCupRound(career, null, {}, cup);
  return finishCupRound(career, { ...session, games: session.games.map(finishMatch) }, cup);
}
/** Rodadas sem o clube do técnico são resolvidas automaticamente. */
export function resolveBackgroundCup(career: Career, includeSelected = false): Career {
  let next = captureAwardsContext(career);
  let cup = backgroundCup(next, includeSelected);
  while (cup) { next = playCupRound(next, cup); cup = backgroundCup(next, includeSelected); }
  return next;
}

const involves = (match: Match, teamId: string | null) => match.homeTeamId === teamId || match.awayTeamId === teamId;
export const allCups = (career: Career) => [career.systems.cup, ...(career.systems.stateCups ?? []), ...(career.systems.continentalCups ?? [])];
const backgroundCup = (career: Career, includeSelected: boolean) => allCups(career).find((cup) => dueCupRound(career, cup)
  && (includeSelected || !dueCupRound(career, cup)!.matches.some((match) => involves(match, career.selectedTeamId))));

export function managedCup(career: Career, kind: 'cup' | 'state' | 'continental' | 'continental-secondary'): Cup | undefined {
  if (kind === 'cup') return career.systems.cup;
  if (kind === 'state') return career.systems.stateCups?.find((cup) => cup.rounds[0].matches.some((match) => involves(match, career.selectedTeamId)));
  return career.systems.continentalCups?.[kind === 'continental' ? 0 : 1];
}

function createKnockout(id: string, name: string, participants: string[], weeks: number[], guestIds?: string[]): Cup {
  return { id, name, weeks, guestIds, status: 'active', rounds: [fixtures(id, 0, participants, weeks)], byeTeamIds: [], championId: null };
}

export function createStateCups(teams: Team[], seed: number) {
  const ordered = [...teams].sort((a, b) => a.city.localeCompare(b.city, 'pt-BR') || a.id.localeCompare(b.id));
  return Array.from({ length: ordered.length / 4 }, (_, index) => createKnockout(
    'state-' + seed + '-' + index, 'Estadual de ' + ordered[index * 4].city,
    ordered.slice(index * 4, index * 4 + 4).map((team) => team.id), [0, 0],
  ));
}

export function createContinentalCups(ranking: string[], cupChampion: string | null, seed: number) {
  const qualifiers = [...new Set([...(cupChampion ? [cupChampion] : []), ...ranking])];
  return ['Copa Continental', 'Copa Sul dos Horizontes'].map((name, index) => {
    const id = 'continental-' + seed + '-' + index;
    const domestic = qualifiers.slice(index * 4, index * 4 + 4);
    const guests = domestic.map((_, slot) => id + '-guest-' + slot);
    return createKnockout(id, name, domestic.flatMap((team, slot) => [team, guests[slot]]), index === 0 ? [10, 24, 37] : [11, 25, 38], guests);
  });
}

const guestCities = ['Puerto Aurora', 'Villa Nevada', 'Monte del Plata', 'Lago Andino'];
export function cupGuests(cup: Cup): Team[] {
  return (cup.guestIds ?? []).map((id, index) => {
    const seed = [...id].reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0, 2166136261);
    const team = generateTeam(seed, (cup.weeks?.[0] === 10 ? 75 : 60) + index * 3);
    const city = guestCities[index];
    return { ...team, id, name: city + (cup.weeks?.[0] === 10 ? ' Atlético' : ' Unión'), city,
      squad: team.squad.map((player, slot) => ({ ...player, id: id + '-player-' + slot, currentTeamId: id })) };
  });
}

export const competitionTeams = (career: Career) => [...worldTeams(career), ...allCups(career).flatMap(cupGuests)];
