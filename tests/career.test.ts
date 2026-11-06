import { describe, expect, it } from 'vitest';
import { autoPickLineup, playRound, simulateSeason, getTopScorers, getPlayerSeasonStats } from '../src/engine/league';
import { startRound, finishRound, stepRound } from '../src/engine/league/season';
import { askingPrice, buyPlayer, createCareer, nextSeason, renewContract, sellPlayer, settleRound } from '../src/engine/career/career';
import { changeMatchStyle, finishMatch, matchSnapshot, startMatch, stepMatch, substitutePlayer } from '../src/engine/simulation/simulateMatch';
import { simulationConfig } from '../src/engine/simulation/config';
import { decodeSave, encodeSave } from '../src/engine/save/save';
import { playCupRound } from '../src/engine/career/cup';

const setup = () => {
  const c = createCareer(42);
  c.selectedTeamId = c.league.teams[19].id;
  c.finances = [{ season: 1, round: 0, description: 'Saldo inicial', amount: 0, balance: c.league.teams[19].budget }];
  return c;
};

describe('carreira e decisões de jogo', () => {
  it('jogar minuto a minuto produz a mesma rodada do avanço direto, sem alterar a entrada', () => {
    const c = setup();
    const original = structuredClone(c.league);
    let live = startRound(c.league, c.seed);
    for (let i = 0; i < 90; i++) live = stepRound(live);
    expect(finishRound(c.league, live)).toEqual(playRound(c.league, c.seed));
    expect(c.league).toEqual(original);
    expect(() => finishRound(c.league, startRound(c.league, c.seed))).toThrow('andamento');
  });

  it('substituições e postura preservam o passado e afetam somente a continuação', () => {
    const c = setup();
    const home = c.league.teams[0];
    const away = c.league.teams[1];
    let game = startMatch({ ...home, lineup: autoPickLineup(home) }, { ...away, lineup: autoPickLineup(away) }, 42,
      { ...simulationConfig, injuryProbability: 0, yellowProbability: 0, redProbability: 0 });
    for (let i = 0; i < 45; i++) game = stepMatch(game);
    const past = structuredClone(game);
    const outgoing = game.home.active.find((p) => p.primaryPosition === 'GK')!;
    const incoming = game.home.bench.find((p) => p.primaryPosition === 'GK')!;
    const changed = substitutePlayer(changeMatchStyle(game, home.id, 'attacking'), home.id, outgoing.id, incoming.id);
    expect(changed.rngState).toBe(game.rngState);
    expect(changed.events.slice(0, -1)).toEqual(game.events);
    expect(changed.home.active.some((p) => p.id === incoming.id)).toBe(true);
    expect(game).toEqual(past);
    expect(finishMatch(changed).home.team.lineup.tactic.style).toBe('attacking');
    const completed = matchSnapshot(finishMatch(changed));
    const league = { ...c.league, schedule: [{ round: 1, matches: [completed] }] };
    expect(getPlayerSeasonStats([league], outgoing.id)).toMatchObject({ appearances: 1, minutes: 45 });
    expect(getPlayerSeasonStats([league], incoming.id)).toMatchObject({ appearances: 1, minutes: 45 });
    expect(() => substitutePlayer(changed, home.id, outgoing.id, incoming.id)).toThrow();
    expect(() => substitutePlayer({ ...game, home: { ...game.home, substitutions: 5 } }, home.id, outgoing.id, incoming.id)).toThrow('Limite');
    expect(() => changeMatchStyle(finishMatch(game), home.id, 'defensive')).toThrow('terminou');
  });

  it('mantém titulares escolhidos na reparação automática e substitui indisponíveis', () => {
    const c = setup();
    const team = c.league.teams[0];
    const lineup = autoPickLineup(team);
    const original = lineup.starterIds[0];
    const alternate = team.squad.filter((p) => p.primaryPosition === 'GK').find((p) => p.id !== original)!;
    lineup.starterIds[0] = alternate.id;
    lineup.positions = { ...lineup.positions, [alternate.id]: 'GK' };
    expect(autoPickLineup(team, lineup).starterIds).toContain(alternate.id);
    alternate.injury = { description: 'Lesão', remainingDays: 7 };
    expect(autoPickLineup(team, lineup).starterIds).not.toContain(alternate.id);
  });

  it('compra de forma atômica, respeita contraproposta, salário, janela e saldo', () => {
    const c = setup();
    const seller = c.league.teams[0];
    const player = seller.squad[0];
    const buyer = c.league.teams.find((t) => t.id === c.selectedTeamId)!;
    const offer = askingPrice(player);
    const salary = Math.ceil(player.contract!.salary * 1.1 / 100) * 100;
    const before = structuredClone(c);
    expect(() => buyPlayer(c, player.id, offer - 1000, salary, 3, 1)).toThrow('Contraproposta');
    expect(() => buyPlayer(c, player.id, offer, 100, 3, 1)).toThrow('salário');
    expect(() => buyPlayer(c, player.id, offer, salary, 3, 5)).toThrow('fechada');
    const next = buyPlayer(c, player.id, offer, salary, 3, 1);
    const newBuyer = next.league.teams.find((t) => t.id === buyer.id)!;
    expect(newBuyer.budget).toBe(buyer.budget - offer);
    expect(newBuyer.squad.find((p) => p.id === player.id)?.currentTeamId).toBe(buyer.id);
    expect(next.league.teams[0].budget).toBe(seller.budget + offer);
    expect(next.league.teams[0].squad.some((p) => p.id === player.id)).toBe(false);
    expect(newBuyer.payroll).toBe(buyer.payroll + salary);
    expect(c).toEqual(before);
    const poor = { ...c, league: { ...c.league, teams: c.league.teams.map((t) => t.id === buyer.id ? { ...t, budget: -1 } : t) } };
    expect(() => buyPlayer(poor, player.id, offer, salary, 3, 1)).toThrow('Saldo');
  });

  it('venda e renovação atualizam elenco, contrato, folha e extrato', () => {
    const c = setup();
    const team = c.league.teams.find((t) => t.id === c.selectedTeamId)!;
    const next = sellPlayer(c, team.squad[0].id, 1);
    expect(next.league.teams.find((t) => t.id === team.id)!.squad).toHaveLength(24);
    expect(next.finances.at(-1)!.amount).toBeGreaterThan(0);
    const expiring = team.squad.find((p) => p.contract!.yearsRemaining < 3)!;
    const renewed = renewContract(c, expiring.id, 1);
    const player = renewed.league.teams.find((t) => t.id === team.id)!.squad.find((p) => p.id === expiring.id)!;
    expect(player.contract!.yearsRemaining).toBe(3);
    expect(player.contract!.salary).toBeGreaterThan(expiring.contract!.salary);
    expect(renewed.finances.at(-1)!.amount).toBe(-player.contract!.salary);
  });

  it('fecha contas por rodada e aplica juros sem perder a relação saldo/extrato', () => {
    const c = setup();
    const team = c.league.teams.find((t) => t.id === c.selectedTeamId)!;
    const next = settleRound({ ...c, league: playRound(c.league, 42), otherLeague: playRound(c.otherLeague, 42) }, 1);
    expect(next.finances.some((e) => e.description.startsWith('Salários'))).toBe(true);
    expect(next.finances.reduce((sum, e) => sum + e.amount, team.budget)).toBe(next.league.teams.find((t) => t.id === team.id)!.budget);
    const debt = settleRound({ ...c, league: { ...c.league, teams: c.league.teams.map((t) => t.id === team.id ? { ...t, budget: -10000 } : t) } }, 1);
    expect(debt.finances.find((e) => e.description.startsWith('Juros'))?.amount).toBe(-100);
  });

  it('troca quatro clubes por divisão e inicia outra temporada com histórico e evolução', () => {
    const c = setup();
    expect(() => nextSeason(c)).toThrow('Conclua');
    c.league = simulateSeason(c.league, c.seed).league;
    c.otherLeague = simulateSeason(c.otherLeague, c.seed).league;
    while (!c.systems.cup.championId) Object.assign(c, playCupRound(c));
    const promoted = c.otherLeague.standings.slice(0, 4).map((r) => r.teamId);
    const relegated = c.league.standings.slice(-4).map((r) => r.teamId);
    const next = nextSeason(c);
    const first = [next.league, next.otherLeague].find((l) => l.teams[0].division === 1)!;
    const second = [next.league, next.otherLeague].find((l) => l.teams[0].division === 2)!;
    expect(promoted.every((id) => first.teams.some((t) => t.id === id))).toBe(true);
    expect(relegated.every((id) => second.teams.some((t) => t.id === id))).toBe(true);
    expect(next.history).toHaveLength(1);
    expect(next.season).toBe(2);
    expect(next.league.teams.some((t) => t.id === c.selectedTeamId)).toBe(true);
    expect(next.league.schedule.flatMap((r) => r.matches).every((m) => m.status === 'scheduled')).toBe(true);
    const allPlayers = [...first.teams, ...second.teams].flatMap((t) => t.squad);
    expect(new Set(allPlayers.map((p) => p.id)).size).toBe(allPlayers.length);
    expect(allPlayers.every((p) => p.overall >= 1 && p.overall <= 99)).toBe(true);
    expect(decodeSave(encodeSave({ career: next, lastRound: null, progress: null })).career).toEqual(next);
  });

  it('save preserva a carreira e rejeita versões, calendário e referências corrompidas', () => {
    const c = setup();
    const raw = encodeSave({ career: c, lastRound: null, progress: null });
    expect(decodeSave(raw).career).toEqual(c);
    expect(() => decodeSave('{')).toThrow('JSON');
    expect(() => decodeSave(raw.replace('"version":2', '"version":99'))).toThrow('versão');
    const broken = structuredClone(c);
    broken.league.teams[0].squad[0].currentTeamId = 'unknown';
    expect(() => decodeSave(encodeSave({ career: broken, lastRound: null, progress: null }))).toThrow('inconsistentes');
    broken.league = structuredClone(c.league);
    broken.league.schedule[0].matches[0].homeTeamId = 'unknown';
    expect(() => decodeSave(encodeSave({ career: broken, lastRound: null, progress: null }))).toThrow('Partida');
  });

  it('artilharia mantém gols e clube de origem depois de uma transferência', () => {
    const c = setup();
    const team = c.league.teams[0];
    const scorer = team.squad[0];
    const fixture = c.league.schedule[0].matches.find((m) => m.homeTeamId === team.id || m.awayTeamId === team.id)!;
    fixture.status = 'finished';
    fixture.events = [{ type: 'goal', minute: 1, teamId: team.id, playerId: scorer.id, playerName: scorer.name, assistPlayerId: null }];
    team.squad = team.squad.filter((p) => p.id !== scorer.id);
    expect(getTopScorers(c.league)[0]).toMatchObject({ playerName: scorer.name, teamId: team.id, goals: 1 });
  });
});
