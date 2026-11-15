import { describe, expect, it } from 'vitest';
import { askingPrice, buyPlayer, createCareer, nextSeason, renewContract, sellPlayer } from '../src/engine/career/career';
import type { Career } from '../src/engine/career/career';
import { createSystems } from '../src/engine/career/bootstrap';
import { ownTeam, replaceTeams, worldTeams } from '../src/engine/career/world';
import { borrowPlayer, counterOffer, loanAvailability, loanFee, refreshOffers, respondToOffer, returnLoans, signingInterest, toggleWatchPlayer } from '../src/engine/career/market';
import { loadLineupPreset, preparationWarnings, saveLineupPreset } from '../src/engine/career/preparation';
import { createAcademy, prospectReport } from '../src/engine/career/academy';
import { createBoard } from '../src/engine/career/board';
import { initialRivalries, recordMatchStories, rivalryBetween } from '../src/engine/career/stories';
import { simulateCareerEvent } from '../src/engine/career/progression';
import { autoPickLineup, simulateSeason } from '../src/engine/league';
import { playCupRound } from '../src/engine/career/cup';
import { finishMatch, matchSnapshot, startMatch, stepMatch } from '../src/engine/simulation/simulateMatch';
import { decodeSave, encodeSave } from '../src/engine/save/save';

function setup(): Career {
  const c = createCareer(42);
  c.selectedTeamId = c.league.teams[19].id;
  c.systems = createSystems(c);
  return c;
}
const loanCandidate = (c: Career) => worldTeams(c).flatMap((t) => t.squad).find((p) => loanAvailability(c, p) === null)!;
const roundTrip = (c: Career) => decodeSave(encodeSave({ career: c, progress: null, lastRound: null })).career;

describe('identidade e decisões da carreira', () => {
  it('reaplica uma escalação salva com formação, banco e reposição de um titular lesionado', () => {
    let c = setup();
    c.lineup = autoPickLineup(ownTeam(c));
    c = saveLineupPreset(c, 'cup');
    const saved = structuredClone(c.systems.savedLineups[0]);
    const injuredId = saved.lineup.starterIds[0];
    const team = ownTeam(c);
    c = replaceTeams(c, [{ ...team, squad: team.squad.map((p) => p.id === injuredId ? { ...p, injury: { description: 'Lesão', remainingDays: 14 } } : p) }]);
    const next = loadLineupPreset(roundTrip(c), 'cup');
    expect(next.lineup!.starterIds).not.toContain(injuredId);
    expect(next.lineup!.starterIds.filter((id) => saved.lineup.starterIds.includes(id))).toHaveLength(10);
    expect(next.lineup!.tactic).toEqual(saved.lineup.tactic);
    expect(next.systems.savedLineups[0]).toEqual(saved);
    expect(preparationWarnings(ownTeam(next), next.lineup, saved.lineup).join(' ')).toContain('lesionado');
  });

  it('empréstimo transfere salário, cobra a taxa e retorna sem duplicar atleta nem dinheiro', () => {
    const c = setup();
    const player = loanCandidate(c);
    const seller = worldTeams(c).find((t) => t.id === player.currentTeamId)!;
    const buyer = ownTeam(c);
    const original = structuredClone(c);
    const next = roundTrip(borrowPlayer(c, player.id, 1));
    expect(ownTeam(next).budget).toBe(buyer.budget - loanFee(player));
    expect(ownTeam(next).payroll).toBe(buyer.payroll + player.contract!.salary);
    expect(worldTeams(next).find((t) => t.id === seller.id)!.payroll).toBe(seller.payroll - player.contract!.salary);
    expect(() => sellPlayer(next, player.id, 1)).toThrow('emprestado');
    expect(() => renewContract(next, player.id, 1)).toThrow('pertence');
    expect(() => buyPlayer(next, player.id, askingPrice(player), player.contract!.salary * 2, 3, 1)).toThrow();
    const returned = returnLoans(next);
    expect(worldTeams(returned).find((t) => t.id === seller.id)!.squad.find((p) => p.id === player.id)?.contract).toEqual(player.contract);
    expect(ownTeam(returned).squad.some((p) => p.id === player.id)).toBe(false);
    expect(ownTeam(returned).budget).toBe(ownTeam(next).budget);
    expect(returnLoans(returned)).toEqual(returned);
    expect(roundTrip(returned)).toEqual(returned);
    expect(c).toEqual(original);
  });

  it('devolve empréstimos na virada antes de atualizar contratos e preserva a memória da temporada', () => {
    let c = setup();
    const player = loanCandidate(c);
    const ownerId = player.currentTeamId;
    c = borrowPlayer(c, player.id, 1);
    c.league = simulateSeason(c.league, c.seed).league;
    c.otherLeague = simulateSeason(c.otherLeague, c.seed).league;
    while (!c.systems.cup.championId) c = playCupRound(c);
    const next = nextSeason(c);
    expect(next.systems.loans[0].status).toBe('returned');
    expect(ownTeam(next).squad.some((p) => p.id === player.id)).toBe(false);
    const returned = worldTeams(next).find((t) => t.id === ownerId)!.squad.find((p) => p.id === player.id);
    if (player.age < 37) expect(returned?.currentTeamId).toBe(ownerId);
    expect(roundTrip(next)).toEqual(next);
  });

  it('recusa empréstimos de titulares sem concorrência, fora da janela e sem reserva salarial', () => {
    const c = setup();
    const player = loanCandidate(c);
    expect(() => borrowPlayer(c, player.id, 5)).toThrow('Janela fechada');
    const poor = replaceTeams(c, [{ ...ownTeam(c), budget: loanFee(player) }]);
    expect(() => borrowPlayer(poor, player.id, 1)).toThrow('dois salários');
    const seller = worldTeams(c).find((t) => t.id === player.currentTeamId)!;
    const best = seller.squad.filter((p) => p.primaryPosition === player.primaryPosition).sort((a, b) => b.overall - a.overall)[0];
    expect(loanAvailability(c, best)).not.toBeNull();
  });

  it('contraproposta mantém a decisão de venda com o usuário e impede negociações infinitas', () => {
    const c = refreshOffers(setup(), 1);
    const offer = c.systems.offers[0];
    const next = counterOffer(c, offer.id, offer.amount + 1000, 1);
    const revised = next.systems.offers.find((o) => o.id === offer.id)!;
    expect(revised.countered).toBe(true);
    expect(revised.status).toBe('pending');
    expect(ownTeam(next)).toEqual(ownTeam(c));
    expect(next.systems.transfers).toHaveLength(0);
    expect(() => counterOffer(next, offer.id, revised.amount + 1000, 1)).toThrow('resposta final');
    const accepted = respondToOffer(next, offer.id, true, 1);
    expect(ownTeam(accepted).budget).toBe(ownTeam(c).budget + revised.amount);
    expect(accepted.systems.milestones.some((m) => m.kind === 'transfer' && m.playerId === offer.playerId)).toBe(true);
    expect(accepted.systems.milestones.find((m) => m.kind === 'transfer' && m.playerId === offer.playerId)?.relatedTeamId).toBe(c.selectedTeamId);
    expect(() => counterOffer(c, offer.id, offer.amount + 1000, 5)).toThrow('expirou');
  });

  it('mantém o valor observado original e considera reputação e espaço no salário pedido', () => {
    const c = setup();
    const seller = c.league.teams[0];
    const player = seller.squad[0];
    const watched = roundTrip(toggleWatchPlayer(c, player.id));
    expect(watched.systems.watchlist[0].value).toBe(player.marketValue);
    expect(toggleWatchPlayer(watched, player.id).systems.watchlist).toHaveLength(0);
    const crowded = { ...ownTeam(c), reputation: 1, squad: [1, 2, 3].map((i) => ({ ...player, id: `rival-${i}`, overall: Math.min(99, player.overall + 1) })) };
    expect(signingInterest(player, crowded, { ...seller, reputation: 99 }).salary).toBeGreaterThan(signingInterest(player, { ...crowded, squad: [], reputation: 99 }, seller).salary);
  });

  it('perfil altera meta e formação de jovens sem revelar um potencial exato no relatório', () => {
    const c = setup();
    const team = ownTeam(c);
    const academy = createAcademy({ ...team, profile: 'academy' }, 42, 1);
    const ordinary = createAcademy({ ...team, profile: 'community' }, 42, 1);
    academy.prospects.forEach((p, i) => expect(p.player.potential).toBeGreaterThanOrEqual(ordinary.prospects[i].player.potential!));
    expect(createBoard({ ...team, reputation: 50, profile: 'traditional' }, c.league).targetPosition).toBeLessThanOrEqual(createBoard({ ...team, reputation: 50, profile: 'academy' }, c.league).targetPosition);
    const p = academy.prospects[0].player;
    const report = prospectReport(p, team);
    expect(report.low).toBeLessThanOrEqual(p.potential!);
    expect(report.high).toBeGreaterThanOrEqual(p.potential!);
    expect(report.high).toBeGreaterThan(report.low);
  });

  it('narração corresponde aos chutes e mantém a equivalência entre avanço incremental e direto', () => {
    const c = setup();
    const [a, b] = c.league.teams;
    const session = startMatch({ ...a, lineup: autoPickLineup(a) }, { ...b, lineup: autoPickLineup(b) }, 123);
    let incremental = session;
    for (let i = 0; i < 90; i++) incremental = stepMatch(incremental);
    expect(incremental).toEqual(finishMatch(session));
    const match = matchSnapshot(incremental);
    const narration = match.commentary!.filter((e) => e.kind !== 'pressure');
    expect(narration.length + match.events.filter((e) => e.type === 'goal').length).toBe(match.statistics!.home.shots + match.statistics!.away.shots);
    expect(incremental.home.active.every((p) => p.fitness <= a.squad.find((q) => q.id === p.id)!.fitness)).toBe(true);
  });

  it('registra estreias e primeiros gols uma única vez e faz rivalidades crescerem em decisões', () => {
    const c = setup();
    const result = simulateCareerEvent(c, autoPickLineup(ownTeam(c))).career;
    const match = result.league.schedule[0].matches.find((m) => m.homeTeamId === c.selectedTeamId || m.awayTeamId === c.selectedTeamId)!;
    expect(result.systems.milestones.some((m) => m.kind === 'debut')).toBe(true);
    const replayed = recordMatchStories(c, result, match, 'league', 1);
    expect(replayed.systems.milestones).toEqual(result.systems.milestones);
    const rivalry = recordMatchStories(c, result, match, 'cup', 6);
    expect(rivalryBetween(rivalry, match.homeTeamId, match.awayTeamId)!.intensity).toBeGreaterThan(0);
    const [a, b] = c.league.teams;
    expect(initialRivalries([a, { ...b, city: a.city }])).toHaveLength(1);
    expect(initialRivalries([{ ...a, city: 'Cidade não informada' }, { ...b, city: 'Cidade não informada' }])).toHaveLength(0);
    const fixture = c.otherLeague.schedule[0].matches[0];
    const duel = { ...c, otherLeague: { ...c.otherLeague, standings: c.otherLeague.standings.map((r) => r.teamId === fixture.homeTeamId ? { ...r, points: 60, position: 3 } : r.teamId === fixture.awayTeamId ? { ...r, points: 61, position: 4 } : r) } };
    const withRivalry = recordMatchStories(duel, duel, { ...fixture, status: 'finished', score: { home: 0, away: 0 } }, 'league', 28);
    expect(rivalryBetween(withRivalry, fixture.homeTeamId, fixture.awayTeamId)).toBeDefined();
  });

  it('migra saves anteriores e rejeita referências falsas nos novos sistemas', () => {
    const c = setup();
    const old = JSON.parse(encodeSave({ career: c, lastRound: null, progress: null }));
    for (const key of ['savedLineups', 'watchlist', 'loans', 'milestones', 'rivalries']) delete old.data.career.systems[key];
    const migrated = decodeSave(JSON.stringify(old)).career;
    expect(migrated.systems.watchlist).toEqual([]);
    expect(ownTeam(migrated).budget).toBe(ownTeam(c).budget);
    const loaned = borrowPlayer(c, loanCandidate(c).id, 1);
    loaned.systems.loans[0].toId = 'unknown';
    expect(() => roundTrip(loaned)).toThrow('Empréstimos');
  });
});
