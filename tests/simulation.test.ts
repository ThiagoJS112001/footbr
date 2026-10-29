import { describe, expect, it } from 'vitest';
import { generateTeam } from '../src/engine/generators/team';
import { calculateOverall } from '../src/engine/generators/player';
import type { PlayerPosition } from '../src/engine/models';
import { simulateMatch, simulationConfig } from '../src/engine/simulation';
import type { MatchTeam, SimulationConfig } from '../src/engine/simulation';

function fixture(id: string, boost = 0): MatchTeam {
  const team = generateTeam(123, 50);
  team.id = id;
  team.squad = team.squad.map((player, index) => {
    const attributes = { ...player.attributes };
    for (const key of Object.keys(attributes) as (keyof typeof attributes)[]) attributes[key] += boost;
    return { ...player, id: `${id}-${index}`, currentTeamId: id, attributes, overall: calculateOverall(attributes, player.primaryPosition) };
  });
  const positions: PlayerPosition[] = ['GK', 'CB', 'CB', 'LB', 'RB', 'DM', 'CM', 'CM', 'AM', 'ST', 'ST'];
  const starterIds: string[] = [];
  for (const position of positions) {
    starterIds.push(team.squad.find((player) => player.primaryPosition === position && !starterIds.includes(player.id))!.id);
  }
  return { ...team, lineup: { starterIds, substituteIds: team.squad.filter((player) => !starterIds.includes(player.id)).map((player) => player.id), tactic: { ...team.defaultTactic } } };
}

function batch(strong: MatchTeam, weak: MatchTeam, count: number, offset = 0) {
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let goals = 0;
  for (let index = 0; index < count; index++) {
    const strongHome = index % 2 === 0;
    const result = simulateMatch(strongHome ? strong : weak, strongHome ? weak : strong, index + offset);
    const scored = strongHome ? result.score.home : result.score.away;
    const conceded = strongHome ? result.score.away : result.score.home;
    if (scored > conceded) wins++;
    else if (scored === conceded) draws++;
    else losses++;
    goals += scored + conceded;
  }
  return { wins, draws, losses, averageGoals: goals / count };
}

describe('simulação de partida', () => {
  it('é reproduzível e não altera os times nem a configuração', () => {
    const home = fixture('home');
    const away = fixture('away');
    const before = structuredClone({ home, away, config: simulationConfig });
    expect(simulateMatch(home, away, 42)).toEqual(simulateMatch(home, away, 42));
    expect(simulateMatch(home, away, 42)).not.toEqual(simulateMatch(home, away, 43));
    expect({ home, away, config: simulationConfig }).toEqual(before);
  });

  it('atende ao balanceamento em 1.000 partidas, alternando o mando', () => {
    const strong = fixture('strong', 15);
    const weak = fixture('weak');
    const mean = (team: MatchTeam) => team.squad.reduce((sum, player) => sum + player.overall, 0) / team.squad.length;
    expect(mean(strong) - mean(weak)).toBeCloseTo(15);
    const result = batch(strong, weak, 1000);
    console.table([{ scenario: '+15 overall (mando alternado)', ...result }]);
    expect(result.wins).toBeGreaterThan(600);
    expect(result.wins).toBeLessThan(850);
    expect(result.draws).toBeGreaterThanOrEqual(200);
    expect(result.draws).toBeLessThanOrEqual(300);
    expect(result.averageGoals).toBeGreaterThanOrEqual(2.2);
    expect(result.averageGoals).toBeLessThanOrEqual(3);
  });

  it('dá uma pequena vantagem ao mandante entre times iguais', () => {
    const home = fixture('home');
    const away = fixture('away');
    let wins = 0;
    let draws = 0;
    let losses = 0;
    let goals = 0;
    for (let seed = 0; seed < 1000; seed++) {
      const { score } = simulateMatch(home, away, seed);
      if (score.home > score.away) wins++;
      else if (score.home === score.away) draws++;
      else losses++;
      goals += score.home + score.away;
    }
    console.table([{ scenario: 'Iguais (vitórias do mandante)', wins, draws, losses, averageGoals: goals / 1000 }]);
    expect(wins).toBeGreaterThan(losses);
    expect((wins - losses) / 1000).toBeLessThan(0.12);
  });

  it('mantém eventos, jogadores ativos, placar e estatísticas consistentes', () => {
    const home = fixture('home');
    const away = fixture('away');
    for (let seed = 0; seed < 150; seed++) {
      const result = simulateMatch(home, away, seed);
      const active = new Set([...home.lineup.starterIds, ...away.lineup.starterIds]);
      const reds = new Set<string>();
      const yellows = new Map<string, number>();
      let previousMinute = 0;
      for (const event of result.events) {
        expect(event.minute).toBeGreaterThanOrEqual(previousMinute);
        expect(event.minute).toBeGreaterThanOrEqual(1);
        expect(event.minute).toBeLessThanOrEqual(90);
        previousMinute = event.minute;
        if (event.type === 'substitution') {
          expect(active.has(event.playerOutId)).toBe(false);
          expect(active.has(event.playerInId)).toBe(false);
          const squad = event.teamId === home.id ? home.squad : away.squad;
          expect(squad.find((player) => player.id === event.playerInId)!.primaryPosition)
            .toBe(squad.find((player) => player.id === event.playerOutId)!.primaryPosition);
          active.add(event.playerInId);
        } else {
          expect(active.has(event.playerId)).toBe(true);
          expect(reds.has(event.playerId)).toBe(false);
          if (event.type === 'card' && event.card === 'yellow') {
            yellows.set(event.playerId, (yellows.get(event.playerId) ?? 0) + 1);
            expect(yellows.get(event.playerId)).toBeLessThanOrEqual(2);
          }
          if (event.type === 'card' && event.card === 'red') { reds.add(event.playerId); active.delete(event.playerId); }
          if (event.type === 'injury') active.delete(event.playerId);
        }
      }
      expect(result.score.home).toBe(result.events.filter((event) => event.type === 'goal' && event.teamId === home.id).length);
      expect(result.score.away).toBe(result.events.filter((event) => event.type === 'goal' && event.teamId === away.id).length);
      expect(result.statistics.home.possession + result.statistics.away.possession).toBeCloseTo(100);
      for (const side of ['home', 'away'] as const) {
        const stats = result.statistics[side];
        expect(stats.shotsOnTarget).toBeLessThanOrEqual(stats.shots);
        expect(result.score[side]).toBeLessThanOrEqual(stats.shotsOnTarget);
        expect(stats.xG).toBeGreaterThanOrEqual(0);
        expect(stats.xG).toBeLessThanOrEqual(stats.shots);
        expect(stats.corners).toBeLessThanOrEqual(stats.shots - result.score[side]);
      }
    }
  });

  it('substitui lesionados, respeita limite e continua sem reserva da posição', () => {
    const home = fixture('home');
    const away = fixture('away');
    const config: SimulationConfig = { ...simulationConfig, injuryProbability: 1, yellowProbability: 0, redProbability: 0 };
    const result = simulateMatch(home, away, 8, config);
    expect(result.events.some((event) => event.type === 'substitution')).toBe(true);
    for (const team of [home, away]) {
      expect(result.events.filter((event) => event.type === 'substitution' && event.teamId === team.id).length).toBeLessThanOrEqual(config.maxSubstitutions);
    }
    home.lineup.substituteIds = [];
    away.lineup.substituteIds = [];
    expect(simulateMatch(home, away, 8, config).events.some((event) => event.type === 'substitution')).toBe(false);
  });

  it('expulsa após o segundo amarelo e não reutiliza expulsos', () => {
    const config = { ...simulationConfig, yellowProbability: 1, redProbability: 0, injuryProbability: 0 };
    const result = simulateMatch(fixture('home'), fixture('away'), 1, config);
    const yellows = new Map<string, number>();
    const reds = new Set<string>();
    for (const event of result.events) {
      if (event.type !== 'card') continue;
      expect(reds.has(event.playerId)).toBe(false);
      if (event.card === 'yellow') yellows.set(event.playerId, (yellows.get(event.playerId) ?? 0) + 1);
      else { expect(yellows.get(event.playerId)).toBe(2); reds.add(event.playerId); }
    }
    expect(reds.size).toBe(22);
  });

  it('rejeita escalações inválidas', () => {
    const home = fixture('home');
    const away = fixture('away');
    home.lineup.starterIds.pop();
    expect(() => simulateMatch(home, away, 1)).toThrow('Escalação inválida');
    expect(() => simulateMatch(away, away, 1)).toThrow('IDs distintos');
  });

  it('estilo ofensivo aumenta finalizações e exposição comparado ao defensivo', () => {
    const home = fixture('home');
    const away = fixture('away');
    const config = { ...simulationConfig, yellowProbability: 0, redProbability: 0, injuryProbability: 0 };
    const totals = (style: 'attacking' | 'defensive') => {
      home.lineup.tactic.style = style;
      let shots = 0;
      let concededShots = 0;
      for (let seed = 0; seed < 300; seed++) {
        const result = simulateMatch(home, away, seed, config);
        shots += result.statistics.home.shots;
        concededShots += result.statistics.away.shots;
      }
      return { shots, concededShots };
    };
    const attacking = totals('attacking');
    const defensive = totals('defensive');
    expect(attacking.shots).toBeGreaterThan(defensive.shots);
    expect(attacking.concededShots).toBeGreaterThan(defensive.concededShots);
  });

  it('meio-campo e moral influenciam posse e goleiro influencia gols sofridos', () => {
    const home = fixture('home');
    const away = fixture('away');
    const config = { ...simulationConfig, yellowProbability: 0, redProbability: 0, injuryProbability: 0 };
    const totals = () => {
      let possession = 0;
      let goals = 0;
      for (let seed = 0; seed < 300; seed++) {
        const result = simulateMatch(home, away, seed, config);
        possession += result.statistics.home.possession;
        goals += result.score.home;
      }
      return { possession, goals };
    };
    const baseline = totals();
    for (const player of home.squad) {
      player.attributes.midfield = 99;
      player.attributes.passing = 99;
      player.morale = 100;
    }
    expect(totals().possession).toBeGreaterThan(baseline.possession);
    // Isole o goleiro: não altere jogadores de linha nem o RNG de eventos.
    const keeper = away.squad.find((player) => player.id === away.lineup.starterIds[0])!;
    keeper.attributes.goalkeeping = 1;
    const weakKeeper = totals().goals;
    keeper.attributes.goalkeeping = 99;
    expect(totals().goals).toBeLessThan(weakKeeper);
  });

  it('remove expulsos por vermelho direto sem substituição', () => {
    const result = simulateMatch(fixture('home'), fixture('away'), 9, {
      ...simulationConfig, redProbability: 1, yellowProbability: 0, injuryProbability: 0,
    });
    const redEvents = result.events.filter((event) => event.type === 'card' && event.card === 'red');
    expect(redEvents).toHaveLength(22);
    expect(new Set(redEvents.map((event) => event.type === 'card' ? event.playerId : '')).size).toBe(22);
    expect(result.events.some((event) => event.type === 'substitution')).toBe(false);
  });
});
