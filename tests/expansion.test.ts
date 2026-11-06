import { describe, expect, it } from 'vitest';
import { createCareer, nextSeason, seasonSeed } from '../src/engine/career/career';
import type { Career } from '../src/engine/career/career';
import { createSystems } from '../src/engine/career/bootstrap';
import { createCup, decideCupMatch, dueCupRound, playCupRound, startCupRound, finishCupRound } from '../src/engine/career/cup';
import { assessProspect, createAcademy, promoteProspect, releaseProspect } from '../src/engine/career/academy';
import { availableJobs, evaluateBoard, takeJob } from '../src/engine/career/board';
import { processAiMarket, refreshOffers, respondToOffer } from '../src/engine/career/market';
import { currentPlayerRecords, playerCareerTotals } from '../src/engine/career/history';
import { financeForecast, nextCompetition, repairLineup, seasonComplete, simulateCareerEvent } from '../src/engine/career/progression';
import { completedRounds, ownTeam, worldTeams } from '../src/engine/career/world';
import { autoPickLineup, playRound, simulateSeason } from '../src/engine/league';
import { finishMatch } from '../src/engine/simulation/simulateMatch';
import { decodeSave, encodeSave } from '../src/engine/save/save';
import { matchInsights } from '../src/engine/career/insights';

function setup(seed = 42, index = 19): Career {
  const c = createCareer(seed);
  c.selectedTeamId = c.league.teams[index].id;
  c.systems = createSystems(c);
  c.finances = [{ teamId: c.selectedTeamId, season: 1, round: 0, description: 'Saldo inicial', amount: 0, balance: ownTeam(c).budget }];
  return c;
}
function atRound(c: Career, count: number): Career {
  for (let i = 0; i < count; i++) c = { ...c, league: playRound(c.league, seasonSeed(c)), otherLeague: playRound(c.otherLeague, seasonSeed(c)) };
  return c;
}
function complete(c: Career): Career {
  c = { ...c, league: simulateSeason(c.league, seasonSeed(c)).league, otherLeague: simulateSeason(c.otherLeague, seasonSeed(c)).league };
  while (!c.systems.cup.championId) c = playCupRound(c);
  return c;
}

describe('mundo ativo, copa e carreira', () => {
  it('a IA contrata por necessidade, mantém salários reservados e não vende atletas do usuário', () => {
    const c = setup();
    const before = structuredClone(c);
    const next = processAiMarket(c, 1);
    expect(next).toEqual(processAiMarket(c, 1));
    expect(next.systems.transfers.length).toBeGreaterThan(0);
    expect(next.systems.transfers.length).toBeLessThanOrEqual(5);
    expect(ownTeam(next)).toEqual(ownTeam(c));
    for (const record of next.systems.transfers) {
      const buyer = worldTeams(next).find((t) => t.id === record.toId)!;
      expect(buyer.budget).toBeGreaterThanOrEqual(buyer.payroll * 2);
      expect(buyer.squad.some((p) => p.id === record.playerId)).toBe(true);
      expect(record.fromId).not.toBe(c.selectedTeamId);
    }
    const ids = [...worldTeams(next).flatMap((t) => t.squad), ...next.freeAgents].map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(processAiMarket(next, 1)).toBe(next);
    expect(c).toEqual(before);
  });

  it('propostas exigem aceite e movimentam dinheiro uma única vez; rejeição e expiração preservam o elenco', () => {
    const c = refreshOffers(setup(), 1);
    const offer = c.systems.offers[0];
    expect(offer).toBeDefined();
    const original = ownTeam(c);
    const declined = respondToOffer(c, offer.id, false, 1);
    expect(ownTeam(declined)).toEqual(original);
    expect(() => respondToOffer(declined, offer.id, true, 1)).toThrow('respondida');
    const accepted = respondToOffer(c, offer.id, true, 1);
    expect(ownTeam(accepted).squad.some((p) => p.id === offer.playerId)).toBe(false);
    expect(ownTeam(accepted).budget).toBe(original.budget + offer.amount);
    expect(accepted.systems.transfers).toHaveLength(1);
    expect(() => respondToOffer(accepted, offer.id, true, 1)).toThrow();
    expect(() => respondToOffer(c, offer.id, true, 5)).toThrow('expirou');
    expect(refreshOffers(c, 5).systems.offers.every((o) => o.status !== 'pending')).toBe(true);
    expect(ownTeam(c)).toEqual(original);
  });

  it('sorteia 40 clubes, resolve seis fases e registra exatamente 39 eliminatórias', () => {
    let c = setup();
    expect(c.systems.cup).toEqual(createCup(worldTeams(c), c.seed, 1));
    const participants = [...c.systems.cup.rounds[0].matches.flatMap((m) => [m.homeTeamId, m.awayTeamId]), ...c.systems.cup.byeTeamIds];
    expect(new Set(participants).size).toBe(40);
    c = complete(c);
    expect(c.systems.cup.rounds.map((r) => r.matches.length)).toEqual([8, 16, 8, 4, 2, 1]);
    expect(c.systems.cup.rounds.flatMap((r) => r.matches)).toHaveLength(39);
    expect(c.systems.cup.rounds.every((r) => r.matches.every((m) => m.status === 'finished' && m.winnerTeamId))).toBe(true);
    expect(c.systems.cup.championId).toBe(c.systems.cup.rounds[5].matches[0].winnerTeamId);
    expect(decodeSave(encodeSave({ career: c, lastRound: 38, progress: null })).career).toEqual(c);
  });

  it('pênaltis são reproduzíveis e não alteram gols, lances ou estatísticas dos 90 minutos', () => {
    const c = setup();
    const game = c.league.schedule[0].matches[0];
    const home = c.league.teams.find((t) => t.id === game.homeTeamId)!;
    const away = c.league.teams.find((t) => t.id === game.awayTeamId)!;
    const tied = { ...game, status: 'finished' as const, score: { home: 0, away: 0 } };
    const result = decideCupMatch(tied, home, away, 42);
    expect(result).toEqual(decideCupMatch(tied, home, away, 42));
    expect(result.penalties!.home).not.toBe(result.penalties!.away);
    expect(result.score).toEqual({ home: 0, away: 0 });
    expect(result.events).toEqual([]);
    expect(result.winnerTeamId).toBeDefined();
    expect(tied).not.toHaveProperty('penalties');
    const doubleForfeit = decideCupMatch({ ...tied, forfeitTeamIds: [home.id, away.id] }, home, away, 42);
    expect(doubleForfeit.penalties).toBeUndefined();
    expect(doubleForfeit.winnerTeamId).toBeDefined();
  });

  it('a copa acrescenta desgaste sem curar lesões nem suspensões de quem não joga', () => {
    let c = atRound(setup(), 4);
    const stage = dueCupRound(c)!;
    const homeId = stage.matches[0].homeTeamId;
    const byeId = c.systems.cup.byeTeamIds[0];
    const home = worldTeams(c).find((t) => t.id === homeId)!;
    const bye = worldTeams(c).find((t) => t.id === byeId)!;
    home.squad[0].discipline.suspendedMatches = 1;
    bye.squad[0].injury = { description: 'Lesão antiga', remainingDays: 14 };
    bye.squad[1].discipline.suspendedMatches = 1;
    const byeBefore = structuredClone(bye);
    const session = startCupRound(c);
    const game = session.games.find((g) => g.home.team.id === homeId)!;
    const starter = game.home.active[0];
    const beforeFitness = starter.fitness;
    c = finishCupRound(c, { ...session, games: session.games.map(finishMatch) });
    expect(worldTeams(c).find((t) => t.id === byeId)).toEqual(byeBefore);
    const after = worldTeams(c).find((t) => t.id === homeId)!;
    expect(after.squad[0].discipline.suspendedMatches).toBe(0);
    expect(after.squad.find((p) => p.id === starter.id)!.fitness).toBeLessThan(beforeFitness);
  });

  it('o fluxo coloca o jogo da copa entre duas rodadas da liga e preserva titulares elegíveis', () => {
    let c = setup();
    c.selectedTeamId = c.systems.cup.rounds[0].matches[0].homeTeamId;
    if (!c.league.teams.some((t) => t.id === c.selectedTeamId)) [c.league, c.otherLeague] = [c.otherLeague, c.league];
    c.systems = { ...createSystems(c), cup: c.systems.cup };
    for (let i = 0; i < 4; i++) c = simulateCareerEvent(c, null).career;
    expect(completedRounds(c)).toBe(4);
    expect(nextCompetition(c)).toBe('cup');
    const result = simulateCareerEvent(c, null);
    expect(result.competition).toBe('cup');
    expect(completedRounds(result.career)).toBe(4);
    expect(nextCompetition(result.career)).toBe('league');
    expect(result.career.systems.lastSummary?.competition).toBe('cup');
    expect(result.career.systems.lastSummary?.notes.length).toBeGreaterThan(0);
  });

  it('avalia a diretoria com carência e permite um novo emprego após demissão', () => {
    let c = atRound(setup(), 24);
    c.league.standings = c.league.standings.map((r) => r.teamId === c.selectedTeamId ? { ...r, position: 20, points: 0, played: 24 } : r);
    expect(evaluateBoard(c, 4)).toBe(c);
    for (const round of [8, 12, 16, 20, 24]) c = evaluateBoard(c, round);
    expect(c.systems.board.status).toBe('dismissed');
    expect(() => simulateCareerEvent(c, null)).toThrow('vínculo');
    expect(() => promoteProspect(c, c.systems.academy.prospects[0].player.id, 24)).toThrow('vínculo');
    const jobs = availableJobs(c);
    expect(jobs).toHaveLength(3);
    expect(evaluateBoard(c, 24)).toBe(c);
    const next = takeJob(c, jobs[0].id);
    expect(next.selectedTeamId).toBe(jobs[0].id);
    expect(next.season).toBe(c.season);
    expect(completedRounds(next)).toBe(24);
    expect(next.systems.board.status).toBe('active');
    expect(next.systems.board.startingPoints).toBe(next.league.standings.find((r) => r.teamId === jobs[0].id)!.points);
    const squads = (career: Career) => worldTeams(career).sort((a, b) => a.id.localeCompare(b.id)).map((t) => ({ id: t.id, squad: t.squad }));
    expect(squads(next)).toEqual(squads(c));
    expect(() => takeJob(c, c.selectedTeamId!)).toThrow('indisponível');
  });

  it('avalia e promove jovens com custos, contratos, potencial e limite por temporada', () => {
    let c = setup();
    const names = (index: number) => createAcademy(c.league.teams[index], c.seed, c.season).prospects.map((p) => p.player.name);
    expect(names(0)).not.toEqual(names(1));
    const original = structuredClone(c);
    const ids = c.systems.academy.prospects.map((p) => p.player.id);
    c = assessProspect(c, ids[0], 1);
    expect(ownTeam(c).budget).toBe(ownTeam(original).budget - 5000);
    expect(c.systems.academy.prospects[0].assessed).toBe(true);
    expect(() => assessProspect(c, ids[0], 1)).toThrow('avaliado');
    for (const id of ids.slice(0, 3)) c = promoteProspect(c, id, 1);
    expect(c.systems.academy.promoted).toBe(3);
    expect(ownTeam(c).squad).toHaveLength(28);
    expect(ownTeam(c).squad.find((p) => p.id === ids[0])!.contract!.yearsRemaining).toBe(3);
    expect(() => promoteProspect(c, ids[0], 1)).toThrow('indisponível');
    expect(() => promoteProspect(c, ids[3], 1)).toThrow('três');
    c = releaseProspect(c, ids[3]);
    expect(c.systems.academy.prospects[3].status).toBe('released');
    expect(decodeSave(encodeSave({ career: c, lastRound: null, progress: null })).career).toEqual(c);
    expect(original.systems.academy.promoted).toBe(0);
  });

  it('arquiva clubes e atletas, preserva aposentados e respeita o teto de evolução', () => {
    let c = complete(setup());
    const records = currentPlayerRecords(c);
    const scorer = records.find((r) => r.goals > 0)!;
    const retired = worldTeams(c).flatMap((t) => t.squad).find((p) => p.id === scorer.playerId)!;
    retired.age = 37;
    const young = ownTeam(c).squad.find((p) => p.age < 24 && p.id !== retired.id)!;
    young.potential = young.overall;
    const beforePotential = young.overall;
    const next = nextSeason(c);
    expect(next.systems.clubHistory).toHaveLength(40);
    expect(next.systems.playerHistory.some((p) => p.playerId === retired.id && p.goals > 0)).toBe(true);
    expect(worldTeams(next).flatMap((t) => t.squad).some((p) => p.id === retired.id)).toBe(false);
    expect(playerCareerTotals(next, retired.id).goals).toBeGreaterThan(0);
    const evolved = worldTeams(next).flatMap((t) => t.squad).find((p) => p.id === young.id);
    if (evolved) expect(evolved.overall).toBeLessThanOrEqual(beforePotential);
    expect(next.systems.academy.promoted).toBe(0);
    expect(next.systems.cup.status).toBe('active');
    expect(next.systems.playerHistory.some((p) => p.titles.length > 0)).toBe(true);
    expect(decodeSave(encodeSave({ career: next, lastRound: null, progress: null })).career).toEqual(next);
  });

  it('reposição emergencial mantém cobertura da formação após o vencimento de todo o elenco', () => {
    const c = complete(setup());
    for (const player of ownTeam(c).squad) player.contract = { salary: player.contract!.salary, yearsRemaining: 1 };
    const next = nextSeason(c);
    const team = ownTeam(next);
    expect(team.squad.length).toBeGreaterThanOrEqual(18);
    expect(team.squad.filter((p) => p.primaryPosition === 'ST').length).toBeGreaterThanOrEqual(2);
    expect(autoPickLineup(team).starterIds).toHaveLength(11);
  });

  it('migra saves v1 sem mudar times ou resultados; copa entra na próxima temporada', () => {
    const c = atRound(setup(), 3);
    const legacy = JSON.parse(encodeSave({ career: c, progress: { minute: 12, commands: [] }, lastRound: 3 }));
    legacy.version = 1;
    delete legacy.data.career.systems;
    const next = decodeSave(JSON.stringify(legacy));
    expect(next.career.league).toEqual(c.league);
    expect(next.career.otherLeague).toEqual(c.otherLeague);
    expect(next.career.systems.cup.status).toBe('deferred');
    expect(Object.keys(next.progress!.lineups!)).toHaveLength(20);
    expect(next.progress!.lineups![c.league.teams[0].id]).toEqual(autoPickLineup(c.league.teams[0]));
  });

  it('rejeita dados de copa e base corrompidos e explica fatos sem prometer causalidade', () => {
    const c = setup();
    const raw = JSON.parse(encodeSave({ career: c, progress: null, lastRound: null }));
    raw.data.career.systems.cup.rounds[0].matches[0].homeTeamId = 'outside';
    expect(() => decodeSave(JSON.stringify(raw))).toThrow('copa');
    const game = { ...c.league.schedule[0].matches[0], status: 'finished' as const, score: { home: 1, away: 0 }, homeLineup: autoPickLineup(c.league.teams.find((t) => t.id === c.league.schedule[0].matches[0].homeTeamId)!),
      styleChanges: [{ minute: 60, teamId: c.league.schedule[0].matches[0].homeTeamId, style: 'attacking' as const }] };
    expect(matchInsights(game, game.homeTeamId).some((s) => s.includes('60′') && s.includes('minuto seguinte'))).toBe(true);
    const sameMinute = { ...game, events: [
      { type: 'substitution' as const, minute: 30, teamId: game.homeTeamId, playerOutId: 'out', playerInId: 'in' },
      { type: 'goal' as const, minute: 30, teamId: game.homeTeamId, playerId: 'scorer', assistPlayerId: null },
    ] };
    expect(matchInsights(sameMinute, game.homeTeamId).some((s) => s.includes('1 gol(s) a favor'))).toBe(true);
    expect(financeForecast(c).salaryReserve).toBe(ownTeam(c).payroll * 2);
  });

  it('mantém integridade em três temporadas para um favorito e um clube pequeno', () => {
    const metrics = [];
    for (const index of [0, 19]) {
      let c = setup(2026 + index, index);
      for (let year = 0; year < 3; year++) {
        let events = 0;
        while (!seasonComplete(c) && events++ < 50) {
          if (c.systems.board.status === 'dismissed') c = takeJob(c, availableJobs(c)[0].id);
          const ready = repairLineup(c);
          c = simulateCareerEvent(ready, ready.lineup).career;
        }
        expect(seasonComplete(c)).toBe(true);
        if (c.systems.board.status === 'dismissed') c = takeJob(c, availableJobs(c)[0].id);
        const teams = worldTeams(c);
        const ids = [...teams.flatMap((t) => t.squad), ...c.freeAgents].map((p) => p.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(teams.every((t) => Number.isFinite(t.budget) && t.squad.length >= 18 && t.squad.length <= 40)).toBe(true);
        expect(teams.filter((t) => t.budget < 0).length).toBeLessThan(20);
        expect(Math.max(...teams.map((t) => t.budget))).toBeLessThan(100_000_000);
        expect(decodeSave(encodeSave({ career: c, lastRound: 38, progress: null })).career).toEqual(c);
        metrics.push({ club: index === 0 ? 'Pequeno' : 'Favorito', season: c.season, transfers: c.systems.transfers.filter((t) => t.season === c.season).length, indebted: teams.filter((t) => t.budget < 0).length, medianCash: Math.round([...teams].sort((a, b) => a.budget - b.budget)[20].budget), events });
        c = nextSeason(c);
      }
      expect(c.systems.clubHistory).toHaveLength(120);
      expect(c.systems.playerHistory.length).toBeGreaterThan(1000);
    }
    console.table(metrics);
  }, 60000);
});
