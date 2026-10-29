import type { Lineup, Match, MatchEvent, MatchScore, MatchStatistics, TeamMatchStatistics } from '../models/Match.ts';
import type { Player } from '../models/Player.ts';
import type { Team } from '../models/Team.ts';
import { createRng, pick } from '../generators/random.ts';
import type { Rng } from '../generators/random.ts';
import { simulationConfig } from './config.ts';
import type { SimulationConfig } from './config.ts';

export interface MatchTeam extends Team {
  lineup: Lineup;
}

export interface MatchResult extends Match {
  status: 'finished';
  homeLineup: Lineup;
  awayLineup: Lineup;
  score: MatchScore;
  statistics: MatchStatistics;
}

type Unit = 'defense' | 'midfield' | 'attack';
interface Side {
  team: MatchTeam;
  active: Player[];
  bench: Player[];
  denominators: Record<Unit, number>;
  yellows: Map<string, number>;
  substitutions: number;
  possessionMinutes: number;
  goals: number;
  stats: TeamMatchStatistics;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const round = (value: number, decimals: number) => Number(value.toFixed(decimals));

function prepare(team: MatchTeam, config: SimulationConfig): Side {
  const { starterIds, substituteIds, tactic } = team.lineup;
  const ids = [...starterIds, ...substituteIds];
  const squad = new Map(team.squad.map((player) => [player.id, player]));
  const formation = tactic.formation.split('-').map(Number);
  if (starterIds.length !== config.starters || new Set(ids).size !== ids.length
    || squad.size !== team.squad.length || ids.some((id) => !squad.has(id) || squad.get(id)!.injury !== null || squad.get(id)!.discipline.suspendedMatches > 0)
    || Object.entries(team.lineup.positions ?? {}).some(([id, position]) => !starterIds.includes(id)
      || (squad.get(id)?.primaryPosition !== position && squad.get(id)?.secondaryPosition !== position))
    || formation.some((count) => !Number.isInteger(count) || count <= 0)
    || formation.reduce((sum, count) => sum + count, 0) !== config.outfieldPlayers) {
    throw new Error('Escalação inválida: use 11 titulares disponíveis, IDs únicos e formação com 10 jogadores de linha.');
  }
  const active = starterIds.map((id) => ({ ...squad.get(id)!, primaryPosition: team.lineup.positions?.[id] ?? squad.get(id)!.primaryPosition }));
  if (active.filter((player) => player.primaryPosition === 'GK').length !== 1) {
    throw new Error('A escalação deve ter exatamente um goleiro titular.');
  }
  const denominators = { defense: 0, midfield: 0, attack: 0 };
  for (const player of active) {
    for (const unit of ['defense', 'midfield', 'attack'] as const) {
      denominators[unit] += config.roles[player.primaryPosition][unit];
    }
  }
  return {
    team, active, bench: substituteIds.map((id) => squad.get(id)!), denominators,
    yellows: new Map(), substitutions: 0, possessionMinutes: 0, goals: 0,
    stats: { possession: 0, shots: 0, shotsOnTarget: 0, corners: 0, xG: 0 },
  };
}

function strength(side: Side, unit: Unit, config: SimulationConfig): number {
  const total = side.active.reduce((sum, player) => {
    const a = player.attributes;
    const value = unit === 'defense' ? a.defense
      : unit === 'attack' ? a.attack * config.attackAttributes.attack + a.passing * config.attackAttributes.passing
        : a.midfield * config.midfieldAttributes.midfield + a.passing * config.midfieldAttributes.passing;
    const morale = 1 + (player.morale - config.neutralMorale) * config.moraleEffect;
    const fitness = 1 + (player.fitness - config.neutralFitness) * config.fitnessEffect;
    return sum + value * config.roles[player.primaryPosition][unit] * morale * fitness;
  }, 0);
  const lines = side.team.lineup.tactic.formation.split('-').map(Number);
  const count = unit === 'defense' ? lines[0] : unit === 'attack' ? lines[lines.length - 1]
    : lines.slice(1, -1).reduce((sum, value) => sum + value, 0);
  const f = config.formation;
  const baseline = unit === 'defense' ? f.baselineDefense : unit === 'attack' ? f.baselineAttack : f.baselineMidfield;
  const effect = unit === 'defense' ? f.defenseEffect : unit === 'attack' ? f.attackEffect : f.midfieldEffect;
  const marking = unit === 'defense' ? config.marking[side.team.lineup.tactic.markingIntensity].defense : 1;
  return Math.max(config.strengthFloor, total / Math.max(config.strengthFloor, side.denominators[unit]) * (1 + (count - baseline) * effect) * marking);
}

function disciplinaryEvents(side: Side, minute: number, rng: Rng, events: MatchEvent[], config: SimulationConfig): void {
  if (!side.active.length) return;
  const base = { minute, teamId: side.team.id };
  const intensity = config.marking[side.team.lineup.tactic.markingIntensity].cards;
  const draw = rng();
  if (draw < config.redProbability * intensity) {
    const player = pick(rng, side.active);
    events.push({ ...base, type: 'card', card: 'red', playerId: player.id });
    side.active = side.active.filter((candidate) => candidate.id !== player.id);
  } else if (draw < (config.redProbability + config.yellowProbability) * intensity) {
    const player = pick(rng, side.active);
    const count = (side.yellows.get(player.id) ?? 0) + 1;
    side.yellows.set(player.id, count);
    events.push({ ...base, type: 'card', card: 'yellow', playerId: player.id });
    if (count >= config.yellowsForRed) {
      events.push({ ...base, type: 'card', card: 'red', playerId: player.id });
      side.active = side.active.filter((candidate) => candidate.id !== player.id);
    }
  }
  if (side.active.length && rng() < config.injuryProbability) {
    const player = pick(rng, side.active);
    events.push({ ...base, type: 'injury', playerId: player.id, description: 'Lesão durante a partida' });
    side.active = side.active.filter((candidate) => candidate.id !== player.id);
    const replacement = side.bench.find((candidate) => candidate.primaryPosition === player.primaryPosition);
    if (replacement && side.substitutions < config.maxSubstitutions) {
      side.active.push(replacement);
      side.bench = side.bench.filter((candidate) => candidate.id !== replacement.id);
      side.substitutions++;
      events.push({ ...base, type: 'substitution', playerOutId: player.id, playerInId: replacement.id });
    }
  }
}

function shoot(attacking: Side, defending: Side, home: boolean, minute: number, rng: Rng, events: MatchEvent[], config: SimulationConfig): void {
  const shooters = attacking.active.filter((player) => config.roles[player.primaryPosition].shooter > 0);
  if (!shooters.length) return;
  const advantage = home ? config.homeAdvantage : -config.homeAdvantage;
  const difference = strength(attacking, 'attack', config) - strength(defending, 'defense', config) + advantage;
  const attackStyle = config.styles[attacking.team.lineup.tactic.style];
  const defenseStyle = config.styles[defending.team.lineup.tactic.style];
  const shotChance = clamp(config.shotProbability * Math.exp(difference * config.shotSensitivity)
    * attackStyle.attack * defenseStyle.exposure, config.shotMin, config.shotMax);
  if (rng() >= shotChance) return;
  const weights = shooters.map((player) => config.roles[player.primaryPosition].shooter * player.attributes.finishing);
  let draw = rng() * weights.reduce((sum, weight) => sum + weight, 0);
  let shooter = shooters[shooters.length - 1];
  for (let index = 0; index < shooters.length; index++) {
    draw -= weights[index];
    if (draw < 0) { shooter = shooters[index]; break; }
  }
  const keeper = defending.active.find((player) => player.primaryPosition === 'GK');
  const keeperSkill = keeper?.attributes.goalkeeping
    ?? Math.max(config.strengthFloor, ...defending.active.map((player) => player.attributes.goalkeeping));
  const targetChance = clamp(config.onTargetProbability * Math.exp(
    (shooter.attributes.finishing - strength(defending, 'defense', config) + advantage) * config.onTargetSensitivity,
  ), config.onTargetMin, config.onTargetMax);
  const goalChance = clamp(config.goalOnTargetProbability * Math.exp(
    (shooter.attributes.finishing - keeperSkill + advantage) * config.keeperSensitivity,
  ), config.goalMin, config.goalMax);
  attacking.stats.shots++;
  // xG é a probabilidade do gol antes de sortear o resultado da finalização.
  attacking.stats.xG += targetChance * goalChance;
  if (rng() < targetChance) {
    attacking.stats.shotsOnTarget++;
    if (rng() < goalChance) {
      attacking.goals++;
      events.push({ minute, teamId: attacking.team.id, type: 'goal', playerId: shooter.id, assistPlayerId: null });
    } else if (rng() < config.cornerAfterSave) attacking.stats.corners++;
  } else if (rng() < config.cornerAfterMiss) attacking.stats.corners++;
}

/** Função pura: escalações, elencos e configuração de entrada não são alterados. */
export function simulateMatch(home: MatchTeam, away: MatchTeam, seed: number, config: SimulationConfig = simulationConfig): MatchResult {
  if (home.id === away.id) throw new Error('Os times devem ter IDs distintos.');
  const rng = createRng(seed);
  const h = prepare(home, config);
  const a = prepare(away, config);
  const events: MatchEvent[] = [];
  for (let minute = 1; minute <= config.minutes; minute++) {
    disciplinaryEvents(h, minute, rng, events, config);
    disciplinaryEvents(a, minute, rng, events, config);
    const midfieldDifference = strength(h, 'midfield', config) * config.styles[home.lineup.tactic.style].midfield
      - strength(a, 'midfield', config) * config.styles[away.lineup.tactic.style].midfield + config.homeAdvantage;
    const homePossession = 1 / (1 + Math.exp(-midfieldDifference * config.possessionSensitivity));
    const hasBall = rng() < homePossession;
    const attacking = hasBall ? h : a;
    attacking.possessionMinutes++;
    shoot(attacking, hasBall ? a : h, hasBall, minute, rng, events, config);
  }
  h.stats.possession = round(h.possessionMinutes / config.minutes * 100, config.possessionDecimals);
  a.stats.possession = round(100 - h.stats.possession, config.possessionDecimals);
  for (const side of [h, a]) side.stats.xG = round(side.stats.xG, config.xGDecimals);
  return {
    id: `match-${home.id}-${away.id}-${seed}`, homeTeamId: home.id, awayTeamId: away.id,
    status: 'finished', homeLineup: structuredClone(home.lineup), awayLineup: structuredClone(away.lineup),
    score: { home: h.goals, away: a.goals }, events, statistics: { home: h.stats, away: a.stats },
  };
}
