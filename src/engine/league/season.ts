import type { League, LeagueStanding } from '../models/League.ts';
import type { Lineup, Match } from '../models/Match.ts';
import type { Player } from '../models/Player.ts';
import type { Team } from '../models/Team.ts';
import { createRng, randomInt } from '../generators/random.ts';
import type { Rng } from '../generators/random.ts';
import { simulateMatch } from '../simulation/simulateMatch.ts';
import { simulationConfig } from '../simulation/config.ts';
import { generateSchedule } from './calendar.ts';
import { leagueConfig as config } from './config.ts';
import { autoPickLineup, LineupUnavailableError } from './lineup.ts';
import { calculateStandings } from './standings.ts';

export interface TopScorer {
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  goals: number;
}

export interface SeasonResult {
  league: League;
  standings: LeagueStanding[];
  topScorers: TopScorer[];
  matches: Match[];
}

function pickOrForfeit(team: Team): Lineup | null {
  try { return autoPickLineup(team); }
  catch (error) {
    if (error instanceof LineupUnavailableError) return null;
    throw error;
  }
}

/** Minutagem de cada jogador, incluindo saídas por lesão ou expulsão. */
function minutesPlayed(match: Match, teamId: string): Map<string, number> {
  const lineup = match.homeTeamId === teamId ? match.homeLineup : match.awayLineup;
  const minutes = new Map<string, number>();
  if (!lineup || match.forfeitTeamIds?.length) return minutes;
  const entered = new Map(lineup.starterIds.map((id) => [id, 0]));
  const leave = (id: string, minute: number) => {
    if (!entered.has(id)) return;
    minutes.set(id, minute - entered.get(id)!);
    entered.delete(id);
  };
  for (const event of match.events) {
    if (event.teamId !== teamId) continue;
    if (event.type === 'substitution') {
      leave(event.playerOutId, event.minute);
      entered.set(event.playerInId, event.minute);
    } else if (event.type === 'injury' || (event.type === 'card' && event.card === 'red')) leave(event.playerId, event.minute);
  }
  for (const [id, start] of entered) minutes.set(id, simulationConfig.minutes - start);
  return minutes;
}

function updateTeam(team: Team, match: Match | undefined, rng: Rng): Team {
  const minutes = match ? minutesPlayed(match, team.id) : new Map<string, number>();
  const events = match?.events.filter((event) => event.teamId === team.id) ?? [];
  const byPlayer = new Map<string, typeof events>();
  for (const event of events) {
    if (event.type === 'substitution') continue;
    const list = byPlayer.get(event.playerId) ?? [];
    list.push(event);
    byPlayer.set(event.playerId, list);
  }
  return {
    ...team,
    squad: team.squad.map((player): Player => {
      let injury = player.injury ? { ...player.injury, remainingDays: player.injury.remainingDays - config.daysBetweenRounds } : null;
      if (injury && injury.remainingDays <= 0) injury = null;
      let yellowCards = player.discipline.yellowCards;
      // Somente uma partida do clube pode cumprir suspensão; folga não conta.
      let suspendedMatches = Math.max(0, player.discipline.suspendedMatches - (match ? 1 : 0));
      for (const event of byPlayer.get(player.id) ?? []) {
        if (event.type === 'injury') injury = {
          description: event.description, remainingDays: randomInt(rng, config.injuryMinDays, config.injuryMaxDays),
        };
        if (event.type === 'card' && event.card === 'yellow') {
          yellowCards++;
          if (yellowCards >= config.yellowCardsForSuspension) {
            yellowCards -= config.yellowCardsForSuspension;
            suspendedMatches = Math.max(suspendedMatches, config.suspensionMatches);
          }
        }
        if (event.type === 'card' && event.card === 'red') suspendedMatches = Math.max(suspendedMatches, config.suspensionMatches);
      }
      const fatigue = (minutes.get(player.id) ?? 0) / simulationConfig.minutes * config.fullMatchFatigue;
      return {
        ...player, injury, discipline: { yellowCards, suspendedMatches },
        fitness: Math.max(config.minFitness, Math.min(config.maxFitness, player.fitness - fatigue + config.fitnessRecovery)),
      };
    }),
  };
}

/** Joga a próxima rodada completa e devolve novo estado, sem alterar a entrada.
 * A seed identifica a temporada; use a mesma seed ao continuar rodadas ou saves.
 */
export function playRound(league: League, seed: number): League {
  createRng(seed); // Validação mesmo quando a temporada já terminou.
  const schedule = league.schedule.length ? league.schedule : generateSchedule(league.teams.map((team) => team.id));
  const roundIndex = schedule.findIndex((round) => round.matches.some((match) => match.status !== 'finished'));
  if (roundIndex < 0) return { ...league, standings: calculateStandings(league, seed) };
  const round = schedule[roundIndex];
  if (round.matches.some((match) => match.status !== 'scheduled')) throw new Error('Rodada parcial ou em andamento não suportada.');
  const rng = createRng((seed ^ Math.imul(round.round, config.seedMultiplier)) >>> 0);
  const teams = new Map(league.teams.map((team) => [team.id, team]));
  const matches = round.matches.map((fixture): Match => {
    const home = teams.get(fixture.homeTeamId);
    const away = teams.get(fixture.awayTeamId);
    if (!home || !away) throw new Error('Partida referencia clube fora da liga.');
    const homeLineup = pickOrForfeit(home);
    const awayLineup = pickOrForfeit(away);
    const matchSeed = randomInt(rng, 0, 0xffff_ffff);
    if (!homeLineup || !awayLineup) {
      return {
        ...fixture, status: 'finished', homeLineup, awayLineup,
        score: { home: homeLineup ? config.forfeitGoals : 0, away: awayLineup ? config.forfeitGoals : 0 },
        events: [], statistics: null,
        forfeitTeamIds: [!homeLineup ? home.id : null, !awayLineup ? away.id : null].filter((id): id is string => id !== null),
      };
    }
    return { ...simulateMatch({ ...home, lineup: homeLineup }, { ...away, lineup: awayLineup }, matchSeed), id: fixture.id };
  });
  const matchByTeam = new Map(matches.flatMap((match) => [[match.homeTeamId, match], [match.awayTeamId, match]] as const));
  const next: League = {
    ...league,
    teams: league.teams.map((team) => updateTeam(team, matchByTeam.get(team.id), rng)),
    schedule: schedule.map((entry, index) => index === roundIndex ? { ...entry, matches } : entry),
    standings: [],
  };
  next.standings = calculateStandings(next, seed);
  return next;
}

export function getTopScorers(league: League): TopScorer[] {
  const players = new Map(league.teams.flatMap((team) => team.squad.map((player) => [player.id, { player, team }] as const)));
  const scorers = new Map<string, TopScorer>();
  for (const match of league.schedule.flatMap((round) => round.matches)) {
    if (match.status !== 'finished') continue;
    for (const event of match.events) {
      if (event.type !== 'goal') continue;
      const entry = players.get(event.playerId);
      if (!entry) throw new Error('Gol de jogador fora da liga.');
      const scorer = scorers.get(event.playerId) ?? {
        playerId: event.playerId, playerName: entry.player.name, teamId: entry.team.id, teamName: entry.team.name, goals: 0,
      };
      scorer.goals++;
      scorers.set(event.playerId, scorer);
    }
  }
  return [...scorers.values()].sort((a, b) => b.goals - a.goals || (a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0));
}

export function simulateSeason(league: League, seed: number): SeasonResult {
  let current = playRound(league, seed);
  while (current.schedule.some((round) => round.matches.some((match) => match.status !== 'finished'))) {
    current = playRound(current, seed);
  }
  return { league: current, standings: current.standings, topScorers: getTopScorers(current), matches: current.schedule.flatMap((round) => round.matches) };
}
