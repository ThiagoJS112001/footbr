import { describe, expect, it } from 'vitest';
import { agePrestige, captureAwardsContext, completeSeasonAwards, finalizeCupAwards, finalizeLeagueAwards, playerAwards, prestigeOf, withPrestige } from '../src/engine/career/awards';
import { pickCoachAward, pickPlayerAwards, rankCampaigns } from '../src/engine/career/awardRules';
import { awardConfig } from '../src/engine/career/awardTypes';
import type { AwardClub, AwardPlayer, AwardsContext } from '../src/engine/career/awardTypes';
import { createSystems } from '../src/engine/career/bootstrap';
import { createCareer, nextSeason, playerValue, seasonSeed, type Career } from '../src/engine/career/career';
import { coachOf, dismissCoach, setCoach } from '../src/engine/career/coach';
import { allCups, resolveBackgroundCup } from '../src/engine/career/cup';
import { refreshOffers } from '../src/engine/career/market';
import { advanceCoachWeek, seasonComplete } from '../src/engine/career/progression';
import { signSponsor } from '../src/engine/career/sponsors';
import { ownTeam, replaceTeams, worldLeagues, worldTeams } from '../src/engine/career/world';
import { calculateStandings, formationSlots, simulateSeason } from '../src/engine/league';
import type { Match, MatchEvent, PlayerPosition } from '../src/engine/models';
import { decodeSave, encodeSave } from '../src/engine/save/save';

const club = (teamId: string): AwardClub => ({ teamId, teamName: teamId });
const athlete = (id: string, position: PlayerPosition, age = 26): AwardPlayer => ({
  playerId: id, playerName: id, position, secondary: null, age,
});
const goal = (playerId: string, teamId: string, minute: number, assistPlayerId: string | null = null): MatchEvent =>
  ({ type: 'goal', playerId, teamId, minute, assistPlayerId });
const positionIds = formationSlots('4-3-3');
const line = (prefix: string) => positionIds.map((position, index) => athlete(prefix + index, position));
const home = line('a');
const away = line('b');
const lineup = (players: AwardPlayer[]): NonNullable<Match['homeLineup']> => ({
  starterIds: players.map((player) => player.playerId), substituteIds: [],
  tactic: { formation: '4-3-3', markingIntensity: 'medium', style: 'balanced' },
});
const context = (...extra: AwardPlayer[]): AwardsContext => ({
  season: 1, players: [...home, ...away, ...extra],
  clubs: [{ ...club('A'), strength: 55, reputation: 35, budget: 2e6, target: 15 },
    { ...club('B'), strength: 78, reputation: 80, budget: 20e6, target: 4 }],
});
const clubs = new Map([['A', club('A')], ['B', club('B')]]);
const match = (index: number, events: MatchEvent[] = [], changes: Partial<Match> = {}): Match => ({
  id: `fixture-${index}`, homeTeamId: 'A', awayTeamId: 'B', status: 'finished', homeLineup: lineup(home),
  awayLineup: lineup(away), events, statistics: null,
  score: { home: events.filter((e) => e.type === 'goal' && e.teamId === 'A').length,
    away: events.filter((e) => e.type === 'goal' && e.teamId === 'B').length }, ...changes,
});
const campaign = (matches: Match[], identities = context()) => rankCampaigns(matches.map((item) => ({ matches: [item] })), identities, clubs, false);
const winner = (rows: ReturnType<typeof campaign>, kind: ReturnType<typeof pickPlayerAwards>['players'][number]['kind']) =>
  pickPlayerAwards(rows).players.find((award) => award.kind === kind)?.winner;

function setup(expanded = false, seed = 42): Career {
  let career = createCareer(seed, expanded);
  career = { ...career, selectedTeamId: career.league.teams[0].id };
  return { ...career, systems: createSystems(career) };
}
const reload = (career: Career) => decodeSave(encodeSave({ career, progress: null, lastRound: null })).career;

describe('critérios por competição', () => {
  it('premia quem fez mais gols, inclusive artilheiro que não tem jogos suficientes para a Bola de Ouro', () => {
    const lone = athlete('lone', 'ST', 19);
    const four = [15, 25, 35, 45].map((minute) => goal(lone.playerId, 'A', minute));
    const rows = campaign([match(1, four, { homeLineup: lineup([...home.slice(0, 9), lone, home[10]]) }),
      match(2, [goal('a9', 'A', 20)]), match(3, [goal('a9', 'A', 20)]), match(4)], context(lone));
    expect(winner(rows, 'golden-boot')).toMatchObject({ playerId: 'lone', goals: 4, games: 1 });
    expect(winner(rows, 'golden-ball')?.playerId).toBe('a9');
    expect(winner(rows, 'breakthrough')).toBeUndefined();
  });

  it('desempata a artilharia por jogos, minutos, nota e identidade estável', () => {
    const entry = winner(campaign([match(1, [goal('a8', 'A', 10), goal('a9', 'A', 11), goal('a10', 'A', 20),
      { type: 'injury', teamId: 'A', playerId: 'a9', minute: 70, description: '' }]),
    match(2, [], { homeLineup: lineup(home.filter(({ playerId }) => !['a8', 'a9'].includes(playerId))) })]), 'golden-boot');
    expect(entry?.playerId).toBe('a9');
    const notes = [{ playerId: 'b9', teamId: 'B', minute: 70, kind: 'miss' as const, text: '' }];
    expect(winner(campaign([match(1, [goal('a9', 'A', 20), goal('b9', 'B', 30)], {
      commentary: Array.from({ length: 4 }, () => notes[0]),
    })]), 'golden-boot')?.playerId).toBe('b9');
    expect(winner(campaign([match(1, [goal('a9', 'A', 20), goal('b9', 'B', 30)])]), 'golden-boot')?.playerId).toBe('a9');
  });

  it('escolhe a melhor campanha sub-21 pelos lances, respeitando o corte de idade', () => {
    const ids = context();
    ids.players = ids.players.map((p) => p.playerId === 'a9' ? { ...p, age: 22 }
      : p.playerId === 'a8' ? { ...p, age: 21 } : p.playerId === 'a10' ? { ...p, age: 18 } : p);
    const games = [1, 2, 3].map((round) => match(round, [goal('a9', 'A', 10, 'a8')]));
    const revelation = winner(campaign(games, ids), 'breakthrough');
    expect(revelation).toMatchObject({ playerId: 'a8', age: 21, assists: 3 });
  });

  it('premia o goleiro de campanha sólida e contabiliza apenas defesas registradas', () => {
    const games = [1, 2, 3].map((round) => match(round, [goal('a9', 'A', 33)], {
      commentary: [{ minute: 21, teamId: 'B', kind: 'save', playerId: 'b9', keeperId: 'a0', text: '' },
        { minute: 41, teamId: 'B', kind: 'save', playerId: 'b9', text: 'Registro antigo' }],
    }));
    expect(winner(campaign(games), 'golden-glove')).toMatchObject({ playerId: 'a0', cleanSheets: 3, goalsConceded: 0, saves: 3, goalkeeperMinutes: 270 });
  });

  it('monta onze titulares diferentes com posições naturais e formação válida', () => {
    const selection = pickPlayerAwards(campaign([match(1), match(2)])).selection!;
    expect(selection.formation).toBe('4-3-3');
    expect(new Set(selection.players.map((p) => p.playerId)).size).toBe(11);
    expect(selection.players.map((p) => p.slot)).toEqual(positionIds);
    expect(selection.players.every((p) => p.position === p.slot)).toBe(true);
  });

  it('reconhece o técnico que supera muito a expectativa mesmo sem conquistar a competição', () => {
    const fixtures = [match(1, [], { score: { home: 1, away: 1 }, managedCoach: { teamId: 'A', name: 'Joana' } }),
      match(2, [], { score: { home: 0, away: 1 }, managedCoach: { teamId: 'A', name: 'Joana' } })];
    const ranking = ['B', 'A', ...Array.from({ length: 14 }, (_, index) => `other-${index}`)];
    const award = pickCoachAward([{ matches: fixtures }], ranking, context(), false);
    expect(award).toMatchObject({ teamId: 'A', name: 'Joana', user: true, position: 2, expected: 15 });
  });

  it('conserva em uma só campanha jogos, gols e assistências de antes e depois da transferência', () => {
    const transferred = home[9];
    const rows = campaign([match(1, [goal(transferred.playerId, 'A', 15, 'a8')]), match(2, [goal(transferred.playerId, 'B', 60, 'b8')], {
      homeLineup: lineup(home.filter((player) => player !== transferred)), awayLineup: lineup([...away.slice(0, 9), transferred, away[10]]),
    })]);
    expect(winner(rows, 'golden-boot')?.clubs).toEqual([
      { ...club('A'), games: 1, minutes: 90, goals: 1, assists: 0 }, { ...club('B'), games: 1, minutes: 90, goals: 1, assists: 0 },
    ]);
  });
});

describe('integração com carreira e mercado', () => {
  function completedWithStar(fullySimulated = false) {
    let career = setup();
    const team = ownTeam(career);
    const star = team.squad.find((p) => p.primaryPosition === 'ST')!;
    career = replaceTeams(career, [{ ...team, squad: team.squad.map((p) => p.id === star.id ? { ...p, age: 21, morale: 60 } : p) }]);
    career = captureAwardsContext(setCoach(career, { ...coachOf(career), reputation: 35, integrity: 50 }));
    const finish = (league: Career['league'], mine: boolean) => {
      const schedule = league.schedule.map((round) => ({ ...round, matches: round.matches.map((item) => {
        const home = item.homeTeamId === team.id;
        const participates = mine && (home || item.awayTeamId === team.id);
        const goals = participates ? [20, 40, 60].map((minute) => goal(star.id, team.id, minute)) : [];
        const starters = (teamId: string) => lineup(league.teams.find((club) => club.id === teamId)!.squad
          .filter((p) => p.id === star.id || p.id !== team.squad.filter((p) => p.primaryPosition === 'ST').at(-1)?.id)
          .sort((p, q) => Number(q.id === star.id) - Number(p.id === star.id)).slice(0, 11).map((p) => athlete(p.id, p.primaryPosition)));
        return { ...item, status: 'finished' as const, events: goals, score: { home: home ? goals.length : 0, away: home ? 0 : goals.length },
          homeLineup: participates ? starters(item.homeTeamId) : null, awayLineup: participates ? starters(item.awayTeamId) : null,
          managedCoach: participates ? { teamId: team.id, name: coachOf(career).name } : undefined };
      }) }));
      const result = { ...league, schedule };
      return { ...result, standings: calculateStandings(result, seasonSeed(career)) };
    };
    const league = finish(career.league, true);
    const otherLeague = fullySimulated ? simulateSeason(career.otherLeague, 42).league : finish(career.otherLeague, false);
    return { career: { ...career, league, otherLeague }, star: ownTeam(career).squad.find((p) => p.id === star.id)! };
  }

  it('eleva preço e moral, respeita o teto e mantém força, potencial e integridade', () => {
    const { career, star } = completedWithStar();
    const next = finalizeLeagueAwards(career, career.league);
    const improved = ownTeam(next).squad.find((p) => p.id === star.id)!;
    expect(prestigeOf(improved)).toBe(awardConfig.maxPrestige);
    expect(improved.marketValue).toBeCloseTo(star.marketValue * 1.3, -3);
    const baseValue = playerValue(star);
    for (let check = 0; check < 4; check++) expect(playerValue(improved)).toBeCloseTo(baseValue * 1.3, -3);
    expect(improved).toMatchObject({ overall: star.overall, potential: star.potential, attributes: star.attributes });
    expect(improved.morale).toBeGreaterThan(star.morale);
    expect(coachOf(next)).toMatchObject({ integrity: 50, reputation: 40 });
    expect(next.systems.competitionAwards?.[0].coach?.user).toBe(true);
    const faded = agePrestige(improved, 2, new Map());
    expect(prestigeOf(faded)).toBeCloseTo(.105);
    expect(faded.marketValue).toBeLessThan(improved.marketValue);
    expect(prestigeOf(agePrestige(improved, 2, new Map([[improved.id, { points: 2160, minutes: 300 }]])))).toBeCloseTo(.195);
  });

  it('favorece um jogador premiado nas propostas da IA sem exceder orçamento ou ignorar a posição', () => {
    const career = setup();
    const seller = ownTeam(career);
    const buyer = worldTeams(career).find((team) => team.id !== seller.id)!;
    const strikers = seller.squad.filter((p) => p.primaryPosition === 'ST').sort((a, b) => a.id.localeCompare(b.id));
    const [favorite, candidate] = strikers;
    const eligible = replaceTeams(career, worldTeams(career).map((team) => ({
      ...team, budget: team.id === buyer.id ? 30e6 : 0,
      defaultTactic: team.id === seller.id ? { ...team.defaultTactic, formation: '4-3-3' } : team.defaultTactic,
      squad: team.squad.map((p) => team.id === buyer.id && p.primaryPosition === 'ST' ? { ...p, overall: 10 }
        : team.id === seller.id ? { ...p, overall: 65, potential: p.id === favorite.id ? 95 : p.id === candidate.id ? 93 : 65,
          marketValue: p.primaryPosition === 'ST' ? 2e6 : 80e6 } : p),
    })));
    const initial = refreshOffers(eligible, 1);
    expect(initial.systems.offers[0]?.playerId).toBe(favorite.id);
    const club = ownTeam(eligible);
    const rewarded = replaceTeams(eligible, [{ ...club, squad: club.squad.map((p) => p.id === candidate.id ? withPrestige(p, 1, .15) : p) }]);
    const offers = refreshOffers(rewarded, 1).systems.offers;
    expect(offers[0]).toMatchObject({ playerId: candidate.id, amount: 2_070_000, buyerId: buyer.id });
    expect(refreshOffers(replaceTeams(rewarded, [{ ...worldTeams(rewarded).find((t) => t.id === buyer.id)!, budget: 500 }]), 1).systems.offers).toEqual([]);
  });

  it('paga cláusulas explícitas no extrato uma vez e mantém os vencedores após exportar e importar', () => {
    const { career, star } = completedWithStar();
    const pending = signSponsor(setup(), 'pulso');
    const sponsored = { ...career, systems: { ...career.systems, sponsors: pending.systems.sponsors } };
    const first = finalizeLeagueAwards(sponsored, sponsored.league);
    const bonus = first.finances.filter((entry) => entry.description.startsWith('Bônus de patrocínio'));
    expect(bonus.map((entry) => entry.description.split(' · ')[2])).toEqual(['Título', 'Bola de Ouro', 'Revelação', 'Melhor Técnico']);
    expect(reload(first).systems.competitionAwards).toEqual(first.systems.competitionAwards);
    const restored = reload(first);
    expect(finalizeLeagueAwards(restored, restored.league)).toBe(restored);
    expect(playerAwards(restored, star.id).some((entry) => entry.kind === 'golden-boot')).toBe(true);
    expect(finalizeLeagueAwards(career, career.league).finances).toEqual(career.finances);
  });

  it('preserva o histórico depois de mudar de clube e de se aposentar', () => {
    const { career, star } = completedWithStar(true);
    const awarded = resolveBackgroundCup(finalizeLeagueAwards(career, career.league), true);
    const seller = ownTeam(awarded);
    const buyer = awarded.otherLeague.teams[0];
    const moving = seller.squad.find((p) => p.id === star.id)!;
    const moved = replaceTeams(awarded, [{ ...seller, squad: seller.squad.filter((p) => p.id !== moving.id) },
      { ...buyer, squad: [...buyer.squad, { ...moving, currentTeamId: buyer.id, age: 37 }] }]);
    expect(playerAwards(moved, star.id)[0].winner.teamId).toBe(seller.id);
    const retirement = reload(nextSeason(moved));
    expect(worldTeams(retirement).every((team) => !team.squad.some((p) => p.id === star.id))).toBe(true);
    expect(playerAwards(retirement, star.id).map((entry) => entry.kind)).toContain('golden-boot');
  }, 30000);

  it('migra uma edição antiga com apenas placares e mantém a memória coletiva sem criar vencedores', () => {
    const { career } = completedWithStar();
    delete career.systems.awardsContext;
    const legacy = reload(career);
    expect(legacy.systems.competitionAwards).toBeUndefined();
    const archived = finalizeLeagueAwards(legacy, legacy.otherLeague);
    expect(archived.systems.competitionAwards?.[0]).toMatchObject({ players: [], coach: null, selection: null });
    expect(archived.systems.competitionAwards?.[0].champion.teamId).toBe(legacy.otherLeague.standings[0].teamId);
  });

  it('fecha estaduais reservando as estatísticas de cada chave antes da primeira rodada nacional', () => {
    const start = captureAwardsContext(setup(true));
    const next = resolveBackgroundCup(start, true);
    const editions = next.systems.competitionAwards!;
    expect(editions).toHaveLength(15);
    expect(editions.every((entry) => entry.kind === 'state' && entry.selection?.players.length === 11)).toBe(true);
    const one = editions[0];
    const finished = allCups(next).find((cup) => cup.id === one.id)!;
    const participants = new Set(finished.rounds[0].matches.flatMap((m) => [m.homeTeamId, m.awayTeamId]));
    expect(one.selection?.players.every((p) => participants.has(p.teamId) && p.games <= 2)).toBe(true);
    expect(finalizeCupAwards(next, finished)).toBe(next);
    expect(completeSeasonAwards(next)).toBe(next);
  });

  it('simula cinco temporadas consecutivas com premiações distintas, divisão continental e preços sob controle', () => {
    let career = setup(true, 124);
    career = dismissCoach(setCoach(career, coachOf(career)), 'performance');
    const champions = new Set<string>();
    for (let season = 1; season <= 5; season++) {
      for (let week = 0; week < 40 && !seasonComplete(career); week++) career = advanceCoachWeek(career);
      expect(seasonComplete(career)).toBe(true);
      const editions = career.systems.competitionAwards!.filter((edition) => edition.season === season);
      expect(editions).toHaveLength(season === 1 ? 19 : 21);
      expect(new Set(editions.map((edition) => edition.id)).size).toBe(editions.length);
      const divisions = editions.filter((edition) => edition.kind === 'league');
      expect(divisions.map((edition) => edition.division).sort()).toEqual([1, 2, 3]);
      for (const edition of editions) {
        expect(edition.selection?.players).toHaveLength(11);
        expect(edition.players.some((entry) => entry.kind === 'golden-ball'), `${season} · ${edition.name}`).toBe(true);
        if (edition.kind === 'league') champions.add(edition.champion.teamId);
      }
      expect(career.systems.seasonAwards?.at(-1)?.selection?.players).toHaveLength(11);
      expect(worldLeagues(career).every((league) => league.teams.every((team) => team.squad.every((p) =>
        prestigeOf(p) >= 0 && prestigeOf(p) <= awardConfig.maxPrestige && Number.isFinite(p.marketValue))))).toBe(true);
      expect(completeSeasonAwards(career)).toBe(career);
      career = reload(advanceCoachWeek(career));
      expect(career.season).toBe(season + 1);
      expect(career.systems.seasonAwards?.map((entry) => entry.season)).toEqual(Array.from({ length: season }, (_, i) => i + 1));
      const rated = worldTeams(career).flatMap((team) => team.squad).filter((p) => prestigeOf(p));
      expect(rated.length).toBeGreaterThan(0);
      expect(rated.every((p) => p.marketValue / Math.max(1, playerValue({ ...p, marketPrestige: undefined })) <= 1.302)).toBe(true);
    }
    expect(champions.size).toBeGreaterThan(3);
  }, 120000);
});
