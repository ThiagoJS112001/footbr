import { describe, expect, it } from 'vitest';
import { calculateOverall, createRng, generateLeague, generatePlayer, generateTeam } from '../src/engine/generators/index';
import type { PlayerPosition } from '../src/engine/models';

const average = (seed: number, reputation: number) => {
  const team = generateTeam(seed, reputation);
  return team.squad.reduce((sum, player) => sum + player.overall, 0) / 25;
};

describe('geradores reproduzíveis', () => {
  it('produz sequências iguais, limitadas a [0, 1), e diferentes por seed', () => {
    const sequence = (seed: number) => {
      const rng = createRng(seed);
      return Array.from({ length: 1000 }, () => rng());
    };
    expect(sequence(42)).toEqual(sequence(42));
    expect(sequence(42)).not.toEqual(sequence(43));
    for (const value of sequence(0)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('gera exatamente o mesmo time com a mesma seed', () => {
    expect(generateTeam(42, 60)).toEqual(generateTeam(42, 60));
    expect(generateTeam(42, 60)).not.toEqual(generateTeam(43, 60));
  });

  it('mantém composição, limites, contratos e vínculos em várias seeds', () => {
    for (let seed = 0; seed < 40; seed++) {
      const team = generateTeam(seed, seed % 2 === 0 ? 0 : 100);
      const counts = team.squad.reduce<Partial<Record<PlayerPosition, number>>>((result, player) => {
        result[player.primaryPosition] = (result[player.primaryPosition] ?? 0) + 1;
        return result;
      }, {});
      expect(team.squad).toHaveLength(25);
      expect(counts).toEqual({ GK: 3, CB: 4, LB: 2, RB: 2, DM: 2, CM: 4, AM: 2, LW: 2, RW: 2, ST: 2 });
      expect(new Set(team.squad.map((player) => player.id)).size).toBe(25);
      for (const player of team.squad) {
        expect(player.age).toBeGreaterThanOrEqual(17);
        expect(player.age).toBeLessThanOrEqual(36);
        expect(player.currentTeamId).toBe(team.id);
        expect(player.overall).toBe(calculateOverall(player.attributes, player.primaryPosition));
        expect(player.contract!.salary).toBeGreaterThan(0);
        expect(player.marketValue).toBeGreaterThan(0);
        for (const value of Object.values(player.attributes)) {
          expect(Number.isInteger(value)).toBe(true);
          expect(value).toBeGreaterThanOrEqual(1);
          expect(value).toBeLessThanOrEqual(99);
        }
      }
      expect(team.payroll).toBe(team.squad.reduce((sum, player) => sum + player.contract!.salary, 0));
    }
  });

  it('gera elencos mais fortes conforme a reputação', () => {
    for (let seed = 0; seed < 40; seed++) {
      expect(average(seed, 90)).toBeGreaterThan(average(seed, 50));
      expect(average(seed, 50)).toBeGreaterThan(average(seed, 10));
    }
  });

  it('especializa atributos e calcula overall por posição', () => {
    const keeper = generatePlayer(createRng(12), 'GK', 70);
    const defender = generatePlayer(createRng(12), 'CB', 70);
    const midfielder = generatePlayer(createRng(12), 'CM', 70);
    const striker = generatePlayer(createRng(12), 'ST', 70);
    expect(keeper.attributes.goalkeeping).toBeGreaterThan(keeper.attributes.finishing);
    expect(defender.attributes.defense).toBeGreaterThan(defender.attributes.finishing);
    expect(midfielder.attributes.midfield).toBeGreaterThan(midfielder.attributes.defense);
    expect(striker.attributes.finishing).toBeGreaterThan(striker.attributes.defense);
    const attributes = { attack: 20, midfield: 30, defense: 90, goalkeeping: 80, speed: 40, passing: 50, finishing: 10, stamina: 60 };
    expect(calculateOverall(attributes, 'GK')).toBe(75);
    expect(calculateOverall(attributes, 'CB')).toBe(75);
    expect(calculateOverall(attributes, 'ST')).toBe(21);
  });

  it('aumenta salário e valor com qualidade e valor de revenda com juventude', () => {
    const low = generatePlayer(createRng(5), 'ST', 40);
    const high = generatePlayer(createRng(5), 'ST', 80);
    expect(high.contract!.salary).toBeGreaterThan(low.contract!.salary);
    expect(high.marketValue).toBeGreaterThan(low.marketValue);
    const players = Array.from({ length: 100 }, (_, seed) => generatePlayer(createRng(seed), 'CM', 70));
    const young = players.find((player) => player.age <= 23)!;
    const old = players.find((player) => player.age >= 34)!;
    expect(young.marketValue).toBeGreaterThan(old.marketValue);
  });

  it('mantém atributos nos limites também com overalls extremos', () => {
    for (const target of [1, 99]) {
      for (const position of ['GK', 'CB', 'LB', 'RB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST'] as const) {
        for (const value of Object.values(generatePlayer(createRng(1), position, target).attributes)) {
          expect(value).toBeGreaterThanOrEqual(1);
          expect(value).toBeLessThanOrEqual(99);
        }
      }
    }
  });

  it('gera 20 clubes únicos e liga reproduzível com forças variadas', () => {
    const league = generateLeague(2026);
    expect(league).toEqual(generateLeague(2026));
    expect(league.teams).toHaveLength(20);
    expect(new Set(league.teams.map((team) => team.name)).size).toBe(20);
    expect(new Set(league.teams.flatMap((team) => team.squad.map((player) => player.id))).size).toBe(500);
    expect(league.teams[19].squad.reduce((sum, player) => sum + player.overall, 0))
      .toBeGreaterThan(league.teams[0].squad.reduce((sum, player) => sum + player.overall, 0));
    expect(generateLeague(7, 8).teams).toHaveLength(8);
  });

  it('não repete nomes mesmo ao esgotar o catálogo', () => {
    const league = generateLeague(0, 512);
    expect(new Set(league.teams.map((team) => team.name)).size).toBe(512);
  });

  it('rejeita parâmetros fora dos limites', () => {
    for (const seed of [-1, NaN, 1.5, 4294967296]) expect(() => createRng(seed)).toThrow(RangeError);
    for (const reputation of [-1, 101, NaN]) expect(() => generateTeam(1, reputation)).toThrow(RangeError);
    for (const count of [0, 1, 2.5, 513, Infinity]) expect(() => generateLeague(1, count)).toThrow(RangeError);
    expect(() => generatePlayer(createRng(1), 'ST', 100)).toThrow(RangeError);
  });
});
