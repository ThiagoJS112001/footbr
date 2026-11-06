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

function fixtures(id: string, stage: number, ids: string[]): CupRound {
  const matches: Match[] = [];
  for (let i = 0; i < ids.length; i += 2) matches.push({ id: `${id}-${stage}-${i / 2}`, homeTeamId: ids[i], awayTeamId: ids[i + 1], status: 'scheduled', homeLineup: null, awayLineup: null, score: null, events: [], statistics: null });
  return { round: stage + 1, name: config.cupNames[stage], afterRound: config.cupWeeks[stage], matches };
}
export function createCup(teams: Team[], seed: number, season: number, deferred = false): Cup {
  const ids = teams.map((t) => t.id);
  const rng = createRng((seed ^ 0xc0ffee) >>> 0);
  for (let i = ids.length - 1; i > 0; i--) { const j = randomInt(rng, 0, i); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  const id = `cup-${seed}-${season}`;
  return { id, name: 'Copa dos Horizontes', status: deferred ? 'deferred' : 'active', rounds: deferred ? [] : [fixtures(id, 0, ids.slice(0, 16))], byeTeamIds: deferred ? [] : ids.slice(16), championId: null };
}
export const pendingCupRound = (career: Career) => career.systems.cup.status === 'active' ? career.systems.cup.rounds.find((r) => r.matches.some((m) => m.status !== 'finished')) : undefined;
export const dueCupRound = (career: Career) => { const round = pendingCupRound(career); return round && round.afterRound <= completedRounds(career) ? round : undefined; };
export function cupLeague(career: Career): League {
  const stage = dueCupRound(career);
  if (!stage) throw new Error('Não há rodada da copa para jogar agora.');
  return { id: career.systems.cup.id, name: career.systems.cup.name, teams: worldTeams(career), schedule: [{ round: stage.round, matches: stage.matches }], standings: [], rules: { promotionSpots: 0, qualificationSpots: 0, relegationSpots: 0 } };
}
export function startCupRound(career: Career, lineup?: Lineup | null, overrides: Record<string, Lineup> = {}): RoundSession {
  return startRound(cupLeague(career), (seasonSeed(career) ^ 0xc0ffee) >>> 0, { ...overrides, ...(lineup && career.selectedTeamId ? { [career.selectedTeamId]: lineup } : {}) });
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

export function finishCupRound(career: Career, session: RoundSession): Career {
  const stage = dueCupRound(career);
  if (!stage || stage.round !== session.round) throw new Error('Etapa de copa incompatível.');
  const league = finishRound(cupLeague(career), session, { days: 0, recovery: 0, onlyParticipants: true });
  const rng = createRng((session.seed ^ stage.round) >>> 0);
  const matches = league.schedule[0].matches.map((m) => decideCupMatch(m, league.teams.find((t) => t.id === m.homeTeamId)!, league.teams.find((t) => t.id === m.awayTeamId)!, randomInt(rng, 0, 0xffff_ffff)));
  const winners = matches.map((m) => m.winnerTeamId!);
  const nextIds = stage.round === 1 ? [...winners, ...career.systems.cup.byeTeamIds] : winners;
  let next = replaceTeams(career, league.teams);
  const finished = { ...stage, matches };
  const rounds = career.systems.cup.rounds.map((r) => r.round === stage.round ? finished : r);
  if (nextIds.length > 1) rounds.push(fixtures(career.systems.cup.id, stage.round, nextIds));
  const cup: Cup = { ...career.systems.cup, rounds, championId: nextIds.length === 1 ? nextIds[0] : null };
  next = { ...next, systems: { ...next.systems, cup } };
  for (const match of matches) {
    const home = worldTeams(next).find((t) => t.id === match.homeTeamId)!;
    if (!match.forfeitTeamIds?.length) next = addFinance(next, home.id, stage.afterRound, `Copa · bilheteria · ${stage.name}`, Math.round(home.stadium.capacity * .65 * home.stadium.ticketPrice * config.netGateShare));
    next = addFinance(next, match.winnerTeamId!, stage.afterRound, `Copa · premiação · ${stage.name}`, [80000, 160000, 320000, 600000, 1000000, 2000000][stage.round - 1]);
  }
  const own = matches.find((m) => m.homeTeamId === career.selectedTeamId || m.awayTeamId === career.selectedTeamId);
  const note = own ? `${stage.name}: ${own.winnerTeamId === career.selectedTeamId ? cup.championId ? 'você conquistou a copa!' : 'classificação garantida.' : 'seu clube foi eliminado da copa.'}` : `${stage.name} da copa concluída.`;
  return { ...next, news: [note, ...next.news].slice(0, 20) };
}
export function playCupRound(career: Career): Career {
  const session = startCupRound(career);
  return finishCupRound(career, { ...session, games: session.games.map(finishMatch) });
}
/** Rodadas sem o clube do técnico são resolvidas automaticamente. */
export function resolveBackgroundCup(career: Career): Career {
  let next = career;
  let stage = dueCupRound(next);
  while (stage && !stage.matches.some((m) => m.homeTeamId === next.selectedTeamId || m.awayTeamId === next.selectedTeamId)) {
    next = playCupRound(next); stage = dueCupRound(next);
  }
  return next;
}
