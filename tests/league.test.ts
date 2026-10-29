import { describe, expect, it } from 'vitest';
import { generateLeague } from '../src/engine/generators/league';
import { generateTeam } from '../src/engine/generators/team';
import type { League } from '../src/engine/models/League';
import type { Match } from '../src/engine/models/Match';
import { autoPickLineup, calculateStandings, generateSchedule, LineupUnavailableError, playRound, simulateSeason } from '../src/engine/league';

function manualLeague(scores: [string, string, number, number][]): League {
  const league = generateLeague(1, 7);
  league.teams = league.teams.map((team, index) => ({ ...team, id: 'ABCDEFG'[index] }));
  league.schedule = [{ round: 1, matches: scores.map(([homeTeamId, awayTeamId, home, away], index): Match => ({
    id: `manual-${index}`, homeTeamId, awayTeamId, status: 'finished', score: { home, away },
    homeLineup: null, awayLineup: null, events: [], statistics: null,
  })) }];
  return league;
}

describe('calendário', () => {
  it('gera 38 rodadas, 380 partidas, mandos equilibrados e sequências de até 3 jogos', () => {
    const ids = Array.from({ length: 20 }, (_, index) => `team-${index}`);
    const schedule = generateSchedule(ids);
    expect(schedule).toHaveLength(38);
    const pairs = new Map<string, number>();
    for (const round of schedule) {
      expect(round.matches).toHaveLength(10);
      const playing = round.matches.flatMap((match) => [match.homeTeamId, match.awayTeamId]);
      expect(new Set(playing).size).toBe(20);
      for (const match of round.matches) {
        const key = [match.homeTeamId, match.awayTeamId].sort().join(':');
        pairs.set(key, (pairs.get(key) ?? 0) + 1);
      }
    }
    expect(pairs.size).toBe(190);
    expect([...pairs.values()].every((count) => count === 2)).toBe(true);
    for (const id of ids) {
      const matches = schedule.flatMap((round) => round.matches).filter((match) => match.homeTeamId === id || match.awayTeamId === id);
      expect(matches).toHaveLength(38);
      expect(matches.filter((match) => match.homeTeamId === id)).toHaveLength(19);
      for (const opponent of ids.filter((other) => other !== id)) {
        expect(matches.filter((match) => match.homeTeamId === id && match.awayTeamId === opponent)).toHaveLength(1);
      }
      let previous: boolean | undefined;
      let streak = 0;
      for (const match of matches) {
        const home = match.homeTeamId === id;
        streak = home === previous ? streak + 1 : 1;
        expect(streak).toBeLessThanOrEqual(3);
        previous = home;
      }
    }
  });

  it.each([2, 3, 4, 5, 7, 8])('suporta %i clubes e folgas para N ímpar', (count) => {
    const ids = Array.from({ length: count }, (_, index) => `${index}`);
    const schedule = generateSchedule(ids);
    expect(schedule).toHaveLength(2 * (count % 2 === 0 ? count - 1 : count));
    expect(schedule.flatMap((round) => round.matches)).toHaveLength(count * (count - 1));
    for (const round of schedule) {
      const players = round.matches.flatMap((match) => [match.homeTeamId, match.awayTeamId]);
      expect(new Set(players).size).toBe(players.length);
    }
    for (const id of ids) {
      const matches = schedule.flatMap((round) => round.matches);
      expect(matches.filter((match) => match.homeTeamId === id)).toHaveLength(count - 1);
      expect(matches.filter((match) => match.awayTeamId === id)).toHaveLength(count - 1);
    }
  });

  it('rejeita IDs repetidos e quantidade insuficiente', () => {
    expect(() => generateSchedule(['a', 'a'])).toThrow();
    expect(() => generateSchedule(['a'])).toThrow();
  });
});

describe('classificação e desempates', () => {
  it.each([
    { criterion: 'pontos antes de vitórias', scores: [['A', 'C', 1, 0], ['A', 'D', 1, 0], ['B', 'C', 1, 0], ['B', 'D', 0, 0], ['B', 'E', 0, 0], ['B', 'F', 0, 0], ['B', 'G', 0, 0]], winner: 'B' },
    { criterion: 'vitórias antes de saldo', scores: [['A', 'C', 1, 0], ['A', 'D', 1, 0], ['B', 'C', 4, 0], ['B', 'D', 0, 0], ['B', 'E', 0, 0], ['B', 'F', 0, 0]], winner: 'A' },
    { criterion: 'saldo antes de gols pró', scores: [['A', 'C', 2, 0], ['B', 'D', 4, 3]], winner: 'A' },
    { criterion: 'gols pró', scores: [['A', 'C', 3, 2], ['B', 'D', 1, 0]], winner: 'A' },
    { criterion: 'confronto direto', scores: [['A', 'B', 1, 0], ['A', 'C', 0, 1], ['B', 'D', 1, 0]], winner: 'A' },
  ])('ordena por $criterion', ({ scores, winner }) => {
    const table = calculateStandings(manualLeague(scores as [string, string, number, number][]), 42);
    const a = table.findIndex((row) => row.teamId === 'A');
    const b = table.findIndex((row) => row.teamId === 'B');
    expect(winner === 'A' ? a < b : b < a).toBe(true);
  });

  it('resolve empate múltiplo circular com sorteio estável por seed', () => {
    const league = manualLeague([['A', 'B', 1, 0], ['B', 'C', 1, 0], ['C', 'A', 1, 0]]);
    const order = (seed: number) => calculateStandings(league, seed).filter((row) => 'ABC'.includes(row.teamId)).map((row) => row.teamId);
    expect(order(42)).toEqual(order(42));
    expect(new Set(Array.from({ length: 20 }, (_, seed) => order(seed).join())).size).toBeGreaterThan(1);
    const expected = order(42);
    league.teams.reverse();
    expect(order(42)).toEqual(expected);
  });
});

describe('escalação automática', () => {
  it.each(['4-4-2', '4-3-3', '3-5-2', '4-2-3-1', '5-3-2', '4-1-4-1'] as const)('respeita posições na formação %s', (formation) => {
    const team = generateTeam(123);
    team.defaultTactic.formation = formation;
    const before = structuredClone(team);
    const lineup = autoPickLineup(team);
    expect(lineup.starterIds).toHaveLength(11);
    expect(new Set([...lineup.starterIds, ...lineup.substituteIds]).size).toBe(25);
    for (const id of lineup.starterIds) {
      const player = team.squad.find((candidate) => candidate.id === id)!;
      expect([player.primaryPosition, player.secondaryPosition]).toContain(lineup.positions![id]);
    }
    expect(team).toEqual(before);
  });

  it('escolhe os melhores por posição e exclui lesionados e suspensos até do banco', () => {
    const team = generateTeam(5);
    const keepers = team.squad.filter((player) => player.primaryPosition === 'GK').sort((a, b) => b.overall - a.overall);
    expect(autoPickLineup(team).starterIds).toContain(keepers[0].id);
    keepers[0].injury = { description: 'Teste', remainingDays: 14 };
    keepers[1].discipline.suspendedMatches = 1;
    const lineup = autoPickLineup(team);
    expect(lineup.starterIds).toContain(keepers[2].id);
    expect([...lineup.starterIds, ...lineup.substituteIds]).not.toContain(keepers[0].id);
    expect([...lineup.starterIds, ...lineup.substituteIds]).not.toContain(keepers[1].id);
    keepers[2].discipline.suspendedMatches = 1;
    expect(() => autoPickLineup(team)).toThrow(LineupUnavailableError);
  });

  it('preserva o especialista ao alocar um jogador versátil em outra posição', () => {
    const team = generateTeam(123);
    const keeper = team.squad.find((player) => player.primaryPosition === 'GK')!;
    const lineup = autoPickLineup(team);
    const chosen = team.squad.filter((player) => lineup.starterIds.includes(player.id));
    // Reduza o elenco aos 11, tornando a alocação global necessária.
    team.squad = chosen;
    const left = chosen.find((player) => lineup.positions![player.id] === 'LB')!;
    const right = chosen.find((player) => lineup.positions![player.id] === 'RB')!;
    left.secondaryPosition = 'RB';
    right.secondaryPosition = null;
    for (const key of Object.keys(left.attributes) as (keyof typeof left.attributes)[]) left.attributes[key] = 99;
    const result = autoPickLineup(team);
    expect(result.positions![left.id]).toBe('LB');
    expect(result.positions![right.id]).toBe('RB');
    expect(result.starterIds).toContain(keeper.id);
  });
});

describe('rodadas e temporada', () => {
  it('atualiza só uma rodada, preserva entrada e cumpre suspensões no próximo jogo', () => {
    const league = generateLeague(2026, 4);
    const team = league.teams[0];
    const keeper = team.squad[0];
    keeper.discipline.suspendedMatches = 1;
    keeper.fitness = 30;
    const injured = team.squad[1];
    injured.injury = { description: 'Teste', remainingDays: 14 };
    const before = structuredClone(league);
    const after = playRound(league, 42);
    expect(league).toEqual(before);
    expect(after.schedule.filter((round) => round.matches.every((match) => match.status === 'finished'))).toHaveLength(1);
    const match = after.schedule[0].matches.find((entry) => entry.homeTeamId === team.id || entry.awayTeamId === team.id)!;
    const lineup = match.homeTeamId === team.id ? match.homeLineup! : match.awayLineup!;
    expect([...lineup.starterIds, ...lineup.substituteIds]).not.toContain(keeper.id);
    expect(after.teams[0].squad[0].discipline.suspendedMatches).toBe(0);
    expect(after.teams[0].squad[0].fitness).toBe(48);
    expect(after.teams[0].squad[1].injury?.remainingDays).toBe(7);
    const second = playRound(after, 42);
    expect(second.teams[0].squad[1].injury).toBeNull();
  });

  it('aplica cartões e lesões aos jogadores corretos, bloqueando a próxima escalação', () => {
    let sawYellowSuspension = false;
    let sawRed = false;
    let sawInjury = false;
    for (let seed = 0; seed < 20; seed++) {
      const league = generateLeague(1, 4);
      for (const team of league.teams) for (const player of team.squad) player.discipline.yellowCards = 2;
      const after = playRound(league, seed);
      for (const match of after.schedule[0].matches) {
        for (const event of match.events) {
          if (event.type === 'substitution' || event.type === 'goal') continue;
          const team = after.teams.find((entry) => entry.id === event.teamId)!;
          const player = team.squad.find((entry) => entry.id === event.playerId)!;
          if (event.type === 'injury') { expect(player.injury).not.toBeNull(); sawInjury = true; }
          else {
            expect(player.discipline.suspendedMatches).toBe(1);
            if (event.card === 'yellow') sawYellowSuspension = true;
            if (event.card === 'red') sawRed = true;
          }
          try {
            const picked = autoPickLineup(team);
            expect([...picked.starterIds, ...picked.substituteIds]).not.toContain(player.id);
          } catch (error) {
            // Vários jogadores começando com dois amarelos podem esgotar uma posição.
            expect(error).toBeInstanceOf(LineupUnavailableError);
          }
        }
      }
    }
    expect(sawYellowSuspension && sawRed && sawInjury).toBe(true);
  });

  it('folga não cumpre suspensão e W.O. não inventa artilheiros', () => {
    const league = generateLeague(1, 3);
    league.schedule = generateSchedule(league.teams.map((team) => team.id));
    const playing = league.schedule[0].matches.flatMap((match) => [match.homeTeamId, match.awayTeamId]);
    const bye = league.teams.find((team) => !playing.includes(team.id))!;
    bye.squad[0].discipline.suspendedMatches = 1;
    const forfeiting = league.teams.find((team) => team.id === playing[0])!;
    for (const player of forfeiting.squad) if (player.primaryPosition === 'GK') player.discipline.suspendedMatches = 1;
    const result = playRound(league, 7);
    expect(result.teams.find((team) => team.id === bye.id)!.squad[0].discipline.suspendedMatches).toBe(1);
    const match = result.schedule[0].matches[0];
    expect(match.forfeitTeamIds).toContain(forfeiting.id);
    expect(match.score).toEqual({ home: 0, away: 3 });
    expect(match.events).toHaveLength(0);
  });

  it('é reproduzível, pode continuar de uma rodada e fecha a contabilidade de 380 jogos', () => {
    const league = generateLeague(2026);
    const before = structuredClone(league);
    const result = simulateSeason(league, 42);
    expect(result).toEqual(simulateSeason(league, 42));
    expect(result).toEqual(simulateSeason(playRound(league, 42), 42));
    expect(league).toEqual(before);
    expect(result.matches).toHaveLength(380);
    expect(result.matches.every((match) => match.status === 'finished')).toBe(true);
    const sum = (key: 'wins' | 'losses' | 'draws' | 'points' | 'goalsFor' | 'goalsAgainst') => result.standings.reduce((total, row) => total + row[key], 0);
    const drawnMatches = result.matches.filter((match) => match.score!.home === match.score!.away).length;
    expect(sum('wins')).toBe(sum('losses'));
    expect(sum('wins')).toBe(380 - drawnMatches);
    expect(sum('draws')).toBe(drawnMatches * 2);
    expect(sum('points')).toBe((380 - drawnMatches) * 3 + drawnMatches * 2);
    expect(sum('goalsFor')).toBe(sum('goalsAgainst'));
    for (const row of result.standings) {
      expect(row.played).toBe(38);
      expect(row.wins + row.draws + row.losses).toBe(38);
      expect(row.points).toBe(row.wins * 3 + row.draws);
      expect(row.goalDifference).toBe(row.goalsFor - row.goalsAgainst);
    }
    expect(result.standings.filter((row) => row.qualified)).toHaveLength(4);
    expect(result.standings.filter((row) => row.relegated)).toHaveLength(4);
    expect(result.topScorers.reduce((total, scorer) => total + scorer.goals, 0))
      .toBe(result.matches.flatMap((match) => match.events).filter((event) => event.type === 'goal').length);
    expect(playRound(result.league, 42)).toEqual(result.league);
  });

  it('o melhor elenco fica no top 5 na maioria de 50 temporadas, mas não ganha sempre', () => {
    const league = generateLeague(2026);
    const average = (team: typeof league.teams[number]) => team.squad.reduce((sum, player) => sum + player.overall, 0) / team.squad.length;
    const strongest = [...league.teams].sort((a, b) => average(b) - average(a))[0];
    let top5 = 0;
    let titles = 0;
    for (let seed = 0; seed < 50; seed++) {
      const result = simulateSeason(league, seed);
      const position = result.standings.find((row) => row.teamId === strongest.id)!.position;
      if (position <= 5) top5++;
      if (position === 1) titles++;
    }
    console.table([{ Clube: strongest.name, Temporadas: 50, Top5: top5, Títulos: titles }]);
    expect(top5).toBeGreaterThan(25);
    expect(titles).toBeLessThan(50);
    expect(titles).toBeGreaterThan(0);
  }, 60_000);
});
