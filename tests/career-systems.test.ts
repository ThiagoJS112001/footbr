import { describe, expect, it } from 'vitest';
import { advanceAcademies, clubAcademy, promoteProspect } from '../src/engine/career/academy';
import { availableJobs, takeJob } from '../src/engine/career/board';
import { createSystems } from '../src/engine/career/bootstrap';
import { createCareer, nextSeason, type Career } from '../src/engine/career/career';
import { careerWeek, coachBetFixtures, coachOf, dismissCoach, offeredSalary, respondBet, setCoach } from '../src/engine/career/coach';
import { resolveBackgroundCup } from '../src/engine/career/cup';
import { advanceCoachWeek, simulateCareerEvent } from '../src/engine/career/progression';
import { activeSponsor, prepareAiSponsors, signSponsor, sponsorshipOffers, sponsorWeekly } from '../src/engine/career/sponsors';
import { completedRounds, ownTeam, worldLeagues, worldTeams } from '../src/engine/career/world';
import { offerYouth, processAiYouth, scoutYouth, youthCandidates, youthEvaluation, youthRivals } from '../src/engine/career/youthMarket';
import { simulateSeason } from '../src/engine/league';
import { decodeSave, encodeSave } from '../src/engine/save/save';

function setup(seed = 42): Career {
  const career = createCareer(seed);
  career.selectedTeamId = career.league.teams[0].id;
  career.systems = createSystems(career);
  return career;
}
const reload = (career: Career) => decodeSave(encodeSave({ career, progress: null, lastRound: null })).career;
const completeWorld = (career: Career) => resolveBackgroundCup({ ...career,
  league: simulateSeason(career.league, 42).league, otherLeague: simulateSeason(career.otherLeague, 42).league }, true);

describe('patrocínios', () => {
  it('oferece três durações, paga o valor anual exato e permite renovar após vencer', () => {
    let career = prepareAiSponsors(setup());
    const team = ownTeam(career);
    const offers = sponsorshipOffers(career, team);
    expect(offers.map((offer) => offer.end - offer.start + 1)).toEqual([1, 2, 3]);
    expect(offers[2].annual).toBeGreaterThan(offers[0].annual);
    career = reload(signSponsor(career, 'raiz'));
    const payments = career.league.schedule.map((stage) => sponsorWeekly(career, team, stage.round));
    expect(payments.reduce((sum, value) => sum + value, 0)).toBe(offers[0].annual);
    expect(career.systems.sponsors).toHaveLength(worldTeams(career).length);
    career = nextSeason(completeWorld(career));
    expect(career.season).toBe(2);
    expect(activeSponsor(career, team.id)).toBeUndefined();
    career = signSponsor(career, 'raiz');
    expect(activeSponsor(career, team.id)).toMatchObject({ sponsorId: 'raiz', start: 2, end: 2 });
  });

  it('preserva moral ao assinar e cobra rescisão com perda de confiança', () => {
    const career = setup();
    const signed = signSponsor(career, 'pulso');
    expect(signed.systems.board.confidence).toBe(career.systems.board.confidence);
    expect(ownTeam(signed).squad).toEqual(ownTeam(career).squad);
    const changed = signSponsor(signed, 'vertice', true);
    expect(ownTeam(changed).budget).toBeLessThan(ownTeam(signed).budget);
    expect(changed.systems.board.confidence).toBeLessThan(signed.systems.board.confidence);
    expect(changed.finances.at(-1)?.description).toBe('Rescisão de patrocínio');
  });
});

describe('mercado de jovens', () => {
  it('observa, recebe recusa, compra direitos e promove sem duplicar o jovem após carregar', () => {
    let career = setup();
    const buyer = ownTeam(career);
    const { team: seller, prospect } = youthCandidates(career)[0];
    const id = prospect.player.id;
    const first = youthEvaluation(career, buyer.id, prospect);
    career = scoutYouth(career, id, 1);
    const observed = youthEvaluation(career, buyer.id, prospect);
    expect(observed.confidence).toBeGreaterThan(first.confidence);
    expect(observed.high - observed.low).toBeLessThan(first.high - first.low);
    expect(offerYouth(career, id, 1000, 1).career).toBe(career);
    const fee = Math.ceil(observed.price * (1 + youthRivals(career, seller, prospect, 1).length * .12));
    career = reload(offerYouth(career, id, fee, 1).career);
    expect(clubAcademy(career, seller).prospects.some((p) => p.player.id === id)).toBe(false);
    expect(clubAcademy(career, ownTeam(career)).prospects.some((p) => p.player.id === id)).toBe(true);
    expect(ownTeam(career).squad.some((p) => p.id === id)).toBe(false);
    const aged = advanceAcademies(career, { ...career, season: 2, systems: { ...career.systems, academies: [] } });
    const developed = aged.systems.academy.prospects.find((p) => p.player.id === id)!.player;
    expect(developed.age).toBe(prospect.player.age + 1);
    expect(developed.overall).toBeGreaterThanOrEqual(prospect.player.overall);
    const promoted = reload(promoteProspect(career, id, 1));
    expect(ownTeam(promoted).squad.find((p) => p.id === id)?.academyClubId).toBe(seller.id);
  });

  it('limita compras da IA e registra academias de destino e promoções', () => {
    const career = setup();
    const next = processAiYouth(career, 3);
    expect(next.systems.transfers.length).toBeGreaterThan(0);
    expect(next.systems.transfers.length).toBeLessThanOrEqual(2);
    expect(next.systems.academies?.some((academy) => academy.promoted > 0)).toBe(true);
    expect(reload(next).systems.academies).toEqual(next.systems.academies);
  });
});

describe('trajetória do treinador', () => {
  it('investiga uma aposta no próprio jogo, demite e preserva a reputação esportiva separada', () => {
    let career = setup();
    career = setCoach(career, { ...coachOf(career), name: 'Joana Silva', integrity: 60 });
    const fixture = coachBetFixtures(career)[0];
    const bet = respondBet(career, fixture.match.id, 'home', 5000);
    expect(coachOf(bet).cash).toBe(coachOf(career).cash - 5000);
    expect(coachOf(bet).integrity).toBe(60);
    expect(ownTeam(bet).budget).toBe(ownTeam(career).budget);
    const original = simulateCareerEvent(career, null).career;
    career = simulateCareerEvent(bet, null).career;
    expect(career.league.schedule[0].matches).toEqual(original.league.schedule[0].matches);
    for (let i = 0; i < 6 && career.systems.board.status === 'active'; i++) career = simulateCareerEvent(career, null).career;
    const restored = reload(career);
    expect(restored.systems.board.status).toBe('dismissed');
    expect(coachOf(restored).stints.at(-1)?.exit).toBe('discipline');
    expect(coachOf(restored).incidents.map((entry) => entry.kind)).toContain('investigation');
    expect(coachOf(restored).name).toBe('Joana Silva');
    expect(coachOf(restored).integrity).toBeLessThan(15);
    expect(coachOf(restored).reputation).toBeGreaterThan(coachOf(restored).integrity);
    expect(availableJobs(restored)).toEqual([]);
  });

  it('avança o mesmo mundo sem emprego, recupera exatamente 15 e aguarda o fim da suspensão', () => {
    let career = setup();
    const oldClub = ownTeam(career).id;
    career = dismissCoach(setCoach(career, { ...coachOf(career), reputation: 15, integrity: 12, suspendedUntil: 4 }), 'discipline');
    const cash = coachOf(career).cash;
    expect(availableJobs(career)).toEqual([]);
    career = advanceCoachWeek(career);
    expect(coachOf(career).integrity).toBe(14);
    career = advanceCoachWeek(career);
    expect(coachOf(career).integrity).toBe(15);
    expect(coachOf(career).cash).toBe(cash);
    expect(availableJobs(career)).toEqual([]);
    career = advanceCoachWeek(advanceCoachWeek(career));
    expect(careerWeek(career)).toBe(4);
    expect(coachOf(career).integrity).toBe(15);
    expect(coachOf(career).stints[0].exit).toBe('discipline');
    expect(worldLeagues(career).every((league) => completedRounds({ league }) === 4)).toBe(true);
    const offer = availableJobs(career)[0];
    expect(offer.division).toBe(Math.max(...worldTeams(career).map((team) => team.division)));
    const hired = reload(takeJob(career, offer.id));
    expect(hired.selectedTeamId).not.toBe(oldClub);
    expect(completedRounds(hired)).toBe(4);
    expect(hired.systems.board.status).toBe('active');
    expect(coachOf(hired).stints).toHaveLength(2);
    expect(coachOf(hired).integrity).toBe(15);
  });

  it('inicializa perfil para saves sem os novos campos e conserva os resultados', () => {
    const legacy = setup();
    const restored = reload(legacy);
    expect(restored.league).toEqual(legacy.league);
    expect(coachOf(restored).integrity).toBe(85);
    expect(sponsorshipOffers(restored, ownTeam(restored))).toHaveLength(3);
    expect(youthCandidates(restored).length).toBeGreaterThan(0);
  });

  it('passa de temporada sem emprego e continua a recuperação na primeira semana seguinte', () => {
    const complete = completeWorld(setup());
    const coach = coachOf(complete);
    let career = dismissCoach(setCoach(complete, { ...coach, integrity: 9, suspendedUntil: careerWeek(complete) + 4 }), 'discipline');
    const before = careerWeek(career);
    career = reload(advanceCoachWeek(career));
    expect(career.season).toBe(2);
    expect(careerWeek(career)).toBe(before);
    expect(career.systems.board.status).toBe('dismissed');
    expect(career.systems.clubHistory).toHaveLength(40);
    expect(coachOf(career).stints[0].exit).toBe('discipline');
    career = advanceCoachWeek(career);
    expect(coachOf(career).integrity).toBe(11);
    expect(availableJobs(career)).toEqual([]);
  });

  it('negocia salário e mantém a passagem anterior ao trocar de clube empregado', () => {
    let career = setup();
    career = setCoach(career, { ...coachOf(career), reputation: 78 });
    for (let i = 0; i < 4; i++) career = simulateCareerEvent(career, null).career;
    const offer = availableJobs(career)[0];
    const salary = offeredSalary(offer) + 100;
    expect(() => takeJob(career, offer.id, salary * 10)).toThrow('recusou a contraproposta');
    const moved = reload(takeJob(career, offer.id, salary));
    expect(coachOf(moved).salary).toBe(salary);
    expect(coachOf(moved).stints[0]).toMatchObject({ exit: 'transfer', games: 4, ended: 4 });
    expect(coachOf(moved).stints[1]).toMatchObject({ started: 4, teamId: offer.id });
  });
});
