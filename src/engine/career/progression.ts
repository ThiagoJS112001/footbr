import type { Lineup } from '../models';
import { autoPickLineup, LineupUnavailableError, playRound } from '../league';
import { finishRound, startRound } from '../league/season';
import type { RoundSession } from '../league/season';
import { finishMatch } from '../simulation/simulateMatch';
import type { Career } from './career';
import { seasonSeed, settleRound } from './career';
import { allCups, competitionTeams, dueCupRound, finishCupRound, managedCup, resolveBackgroundCup, startCupRound } from './cup';
import { evaluateBoard } from './board';
import { processAiMarket } from './market';
import { arrangeDivisions, completedRounds, ownTeam, worldLeagues } from './world';
import { matchInsights } from './insights';
import { recordMatchStories } from './stories';

export const cupKinds = ['state', 'cup', 'continental', 'continental-secondary'] as const;
export type Competition = 'league' | typeof cupKinds[number];
export function nextCupEvent(career: Career) {
  for (const kind of cupKinds) {
    const cup = managedCup(career, kind);
    const round = cup && dueCupRound(career, cup);
    if (cup && round && round.matches.some((m) => m.homeTeamId === career.selectedTeamId || m.awayTeamId === career.selectedTeamId)) return { kind, cup, round };
  }
}
export const nextCompetition = (career: Career): Competition => nextCupEvent(career)?.kind ?? 'league';
export const seasonComplete = (career: Career) => completedRounds(career) === career.league.schedule.length && allCups(career).every((cup) => cup.status === 'deferred' || !!cup.championId);
export function repairLineup(career: Career, preferred?: Lineup | null): Career {
  try {
    const lineup = autoPickLineup(ownTeam(career), preferred ?? undefined, !preferred);
    if (preferred) {
      const previous = new Set([...preferred.starterIds, ...preferred.substituteIds]);
      lineup.substituteIds = lineup.substituteIds.filter((id) => previous.has(id));
    }
    return { ...career, lineup };
  } catch (error) { if (error instanceof LineupUnavailableError) return { ...career, lineup: null }; throw error; }
}
export function startCareerEvent(career: Career, lineup: Lineup | null): { competition: Competition; session: RoundSession } {
  if (career.systems.board.status === 'dismissed') throw new Error('Seu vínculo foi encerrado. Escolha uma proposta na Diretoria para continuar.');
  const competition = nextCompetition(career);
  const session = competition !== 'league' ? startCupRound(career, lineup, {}, managedCup(career, competition)) : startRound(career.league, seasonSeed(career), lineup ? { [career.selectedTeamId!]: lineup } : {});
  return { competition, session };
}
export function finishCareerEvent(career: Career, competition: Competition, session: RoundSession): Career {
  const previous = career.league.standings.find((r) => r.teamId === career.selectedTeamId)!;
  const beforeBalance = ownTeam(career).budget;
  let next: Career;
  if (competition !== 'league') next = finishCupRound(career, session, managedCup(career, competition));
  else {
    const league = finishRound(career.league, session);
    const divisions = worldLeagues(career).map((division) => division === career.league ? league : playRound(division, seasonSeed(career)));
    next = settleRound({ ...career, ...arrangeDivisions(divisions, league) }, session.round);
    next = evaluateBoard(next, session.round);
    next = resolveBackgroundCup(next);
    if (session.round < career.league.schedule.length) next = processAiMarket(next, session.round + 1);
  }
  next = resolveBackgroundCup(next);
  const previouslyFinished = new Set([...worldLeagues(career).flatMap((league) => league.schedule), ...allCups(career).flatMap((cup) => cup.rounds)].flatMap((r) => r.matches).filter((m) => m.status === 'finished').map((m) => m.id));
  const newlyFinished = [...worldLeagues(next).flatMap((l) => l.schedule.flatMap((r) => r.matches.map((m) => ({ match: m, round: r.round, competition: 'league' as const })))),
    ...allCups(next).flatMap((cup) => cup.rounds).flatMap((r) => r.matches.map((m) => ({ match: m, round: r.round, competition: 'cup' as const })))].filter(({ match: m }) => m.status === 'finished' && !previouslyFinished.has(m.id));
  for (const event of newlyFinished) next = recordMatchStories(career, next, event.match, event.competition, event.round);
  const cup = competition === 'league' ? undefined : managedCup(next, competition);
  const stage = cup?.rounds.find((round) => round.round === session.round);
  const matches = stage?.matches ?? next.league.schedule.find((r) => r.round === session.round)!.matches;
  const match = matches.find((m) => m.homeTeamId === career.selectedTeamId || m.awayTeamId === career.selectedTeamId);
  const team = ownTeam(next);
  const row = next.league.standings.find((r) => r.teamId === career.selectedTeamId)!;
  const name = (id: string) => competitionTeams(next).find((t) => t.id === id)!.name;
  const result = match ? `${name(match.homeTeamId)} ${match.score!.home}–${match.score!.away} ${name(match.awayTeamId)}${match.penalties ? ` (pênaltis ${match.penalties.home}–${match.penalties.away})` : ''}` : 'Seu clube folgou nesta rodada.';
  const title = stage ? (cup!.weeks ? cup!.name + ' · ' + stage.name : stage.name) : `Rodada ${session.round}`;
  const summary = { competition, round: session.round, teamId: team.id, title, result, position: row.position, positionChange: previous.position - row.position, points: row.points,
    moneyChange: team.budget - beforeBalance, absences: team.squad.filter((p) => p.injury || p.discipline.suspendedMatches).map((p) => `${p.name}: ${p.injury ? `${p.injury.remainingDays} dias de lesão` : `${p.discipline.suspendedMatches} jogo(s) de suspensão`}`), notes: match ? matchInsights(match, team.id) : [] };
  return repairLineup({ ...next, systems: { ...next.systems, lastSummary: summary }, news: [`${title}: ${result}`, ...next.news].slice(0, 20) }, career.lineup);
}
export function simulateCareerEvent(career: Career, lineup: Lineup | null): { career: Career; competition: Competition; round: number } {
  const { competition, session } = startCareerEvent(career, lineup);
  const finished = { ...session, games: session.games.map(finishMatch) };
  return { career: finishCareerEvent(career, competition, finished), competition, round: finished.round };
}
export function financeForecast(career: Career) {
  const team = ownTeam(career);
  const entries = career.finances.filter((e) => e.season === career.season && (!e.teamId || e.teamId === team.id));
  const paidWeeks = entries.filter((e) => e.description === 'Patrocínio semanal').length;
  const operating = entries.filter((e) => /Bilheteria líquida|Patrocínio semanal|Salários|Manutenção|Juros/.test(e.description)).reduce((s, e) => s + e.amount, 0);
  const weekly = paidWeeks ? operating / paidWeeks : (50000 + team.reputation * 1200) + team.stadium.capacity * .7 * team.stadium.ticketPrice * .2 / 2 - team.payroll / 4 - team.stadium.capacity * 1.8;
  return { weekly: Math.round(weekly), fourWeeks: Math.round(team.budget + weekly * 4), salaryReserve: team.payroll * 2, spendingRoom: Math.max(0, team.budget - team.payroll * 2),
    note: paidWeeks ? 'Estimativa pela média operacional das semanas sob seu comando, sem compras, vendas e prêmios.' : 'Estimativa inicial de operação; público e desempenho podem alterar a receita.' };
}
