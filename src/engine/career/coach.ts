import type { Match, Team } from '../models';
import { identityHash } from '../models/personality';
import { addFinance, type Career } from './career';
import { allCups } from './cup';
import type { CoachBet, CoachProfile, CoachStint } from './types';
import { completedRounds, ownTeam, worldLeagues, worldTeams } from './world';

export const minimumIntegrity = 15;
const clamp = (value: number) => Math.max(0, Math.min(100, value));
export const careerWeek = (career: Career) => (career.season - 1) * career.league.schedule.length + completedRounds(career);
export const coachSuspended = (career: Career) => coachOf(career).suspendedUntil > careerWeek(career);
export const offeredSalary = (team: Team) => Math.round((1800 + team.reputation * 48 + (3 - team.division) * 900) / 100) * 100;
const stint = (career: Career, teamId: string, round: number): CoachStint =>
  ({ teamId, season: career.season, started: round, games: 0, wins: 0, draws: 0, losses: 0, titles: [] });

export function coachOf(career: Career): CoachProfile {
  if (career.systems.coach) return career.systems.coach;
  const stints = career.history.flatMap((year): CoachStint[] => {
    const teamId = year.teamId ?? career.selectedTeamId;
    if (!teamId) return [];
    const record = career.systems.clubHistory.find((row) => row.teamId === teamId && row.season === year.season);
    return [{ ...stint({ ...career, season: year.season }, teamId, 0), ended: 38,
      titles: [...(record?.leagueTitle ? ['Liga dos Horizontes'] : []), ...(record?.cupTitle ? ['Copa dos Horizontes'] : [])],
      movement: year.promoted.includes(year.teamName ?? '') ? 'promotion' : year.relegated.includes(year.teamName ?? '') ? 'relegation' : undefined }];
  });
  if (career.selectedTeamId) {
    const appointed = career.systems.board.appointedRound;
    const resigned = career.systems.board.status === 'dismissed';
    const date = resigned ? career.systems.board.lastReviewRound : completedRounds(career);
    const teamId = career.selectedTeamId;
    const results = [
      ...career.league.schedule.filter((round) => round.round > appointed && round.round <= date).flatMap((round) => round.matches),
      ...allCups(career).flatMap((cup) => cup.rounds.filter((round) => round.afterRound >= appointed && round.afterRound <= date).flatMap((round) => round.matches)),
    ].flatMap((match) => match.status !== 'finished' || !match.score ? [] : match.homeTeamId === teamId
      ? [match.score.home - match.score.away] : match.awayTeamId === teamId ? [match.score.away - match.score.home] : []);
    const titles = allCups(career).filter((cup) => cup.championId === teamId && cup.rounds.at(-1)!.afterRound >= appointed
      && cup.rounds.at(-1)!.afterRound <= date).map((cup) => cup.name);
    stints.push({ ...stint(career, teamId, appointed), games: results.length, wins: results.filter((score) => score > 0).length,
      draws: results.filter((score) => score === 0).length, losses: results.filter((score) => score < 0).length, titles,
      ...(resigned ? { ended: date, exit: 'performance' as const } : {}) });
  }
  return { name: 'Treinador FootBR', reputation: 30, integrity: 85, cash: 12_000,
    salary: career.selectedTeamId && career.systems.board.status === 'active' ? offeredSalary(ownTeam(career)) : 0,
    suspendedUntil: 0, lastWeek: careerWeek(career), stints, incidents: [], bets: [], approaches: [] };
}

export const setCoach = (career: Career, coach: CoachProfile): Career => ({ ...career, systems: { ...career.systems, coach } });
export function nameCoach(career: Career, value: string): Career {
  const name = value.trim();
  if (!name || name.length > 60) throw new Error('Informe um nome de até 60 caracteres.');
  return setCoach(career, { ...coachOf(career), name });
}

function updateStint(coach: CoachProfile, change: (entry: CoachStint) => CoachStint): CoachProfile {
  return { ...coach, stints: coach.stints.map((entry, index) => index === coach.stints.length - 1 && entry.ended === undefined ? change(entry) : entry) };
}
export function dismissCoach(career: Career, reason: 'performance' | 'discipline'): Career {
  let coach = coachOf(career);
  coach = updateStint(coach, (entry) => ({ ...entry, ended: completedRounds(career), exit: reason }));
  coach.salary = 0;
  if (reason === 'performance') coach.reputation = clamp(coach.reputation - 9);
  return setCoach({ ...career, lineup: null, systems: { ...career.systems,
    board: { ...career.systems.board, status: 'dismissed' },
    offers: career.systems.offers.map((offer) => offer.status === 'pending' ? { ...offer, status: 'expired' } : offer),
  } }, coach);
}

export function appointCoach(before: Career, after: Career, team: Team, salary = offeredSalary(team)): Career {
  const coach = updateStint(coachOf(before), (entry) => ({ ...entry, ended: completedRounds(before), exit: 'transfer' }));
  return setCoach(after, { ...coach, salary, stints: [...coach.stints, stint(after, team.id, completedRounds(after))] });
}

export function negotiatedSalary(career: Career, team: Team, salary?: number): number {
  const base = offeredSalary(team);
  if (salary === undefined) return base;
  const coach = coachOf(career);
  const premium = Math.max(0, coach.reputation - jobRequirements(team).reputation) * .003;
  const maximum = Math.min(Math.round(base * (1 + premium)), Math.max(base, Math.floor(team.budget / 10)));
  if (!Number.isSafeInteger(salary) || salary < base || salary > maximum) throw new Error(`${team.name} recusou a contraproposta salarial. A oferta original continua disponível.`);
  return salary;
}

export function recordCoachMatch(career: Career, match: Match | undefined, title?: string): Career {
  if (!match?.score || career.systems.board.status !== 'active') return career;
  const home = match.homeTeamId === career.selectedTeamId;
  const result = (home ? match.score.home - match.score.away : match.score.away - match.score.home);
  const coach = updateStint(coachOf(career), (entry) => ({ ...entry, games: entry.games + 1,
    wins: entry.wins + Number(result > 0), draws: entry.draws + Number(result === 0), losses: entry.losses + Number(result < 0),
    titles: title ? [...entry.titles, title] : entry.titles }));
  return setCoach(career, { ...coach, reputation: clamp(coach.reputation + Math.sign(result) + (title ? 7 : 0)) });
}

export function coachSeasonEnd(career: Career, after: Career): Career {
  if (career.systems.board.status !== 'active') return setCoach(after, coachOf(career));
  const row = career.league.standings.find((r) => r.teamId === career.selectedTeamId)!;
  const diff = ownTeam(career).division - ownTeam(after).division;
  const title = row.position === 1;
  const coach = updateStint(coachOf(career), (entry) => ({ ...entry, ended: career.league.schedule.length,
    movement: diff > 0 ? 'promotion' : diff < 0 ? 'relegation' : undefined, titles: title ? [...entry.titles, career.league.name] : entry.titles }));
  const academyPlayers = new Set(ownTeam(career).squad.filter((player) => player.age <= 21 && player.academyClubId).map((player) => player.id));
  const youthMinutes = career.systems.playerHistory.filter((record) => record.season === career.season && record.teamId === career.selectedTeamId
    && academyPlayers.has(record.playerId)).reduce((total, record) => total + record.minutes, 0);
  const change = (title ? 7 : 0) + (diff > 0 ? 6 : diff < 0 ? -7 : 0) + (row.position < career.systems.board.targetPosition ? 3 : -2)
    + career.systems.academy.promoted + Number(youthMinutes >= 900) * 2;
  const clean = !coach.bets.some((bet) => bet.week >= careerWeek(career) - career.league.schedule.length);
  return setCoach(after, { ...coach, reputation: clamp(coach.reputation + change), integrity: clamp(coach.integrity + (clean ? 4 : 0)),
    stints: [...coach.stints, stint(after, ownTeam(after).id, 0)] });
}

export function jobRequirements(team: Team) {
  return { reputation: Math.max(10, team.reputation - (team.division === 1 ? 20 : 32)),
    integrity: team.reputation >= 75 ? 65 : team.reputation >= 60 ? 32 : minimumIntegrity };
}

export function openCoachVacancies(career: Career) {
  return worldLeagues(career).flatMap((league) => league.standings.slice(-5).flatMap((row) => {
    const team = league.teams.find((club) => club.id === row.teamId);
    return team && team.id !== career.selectedTeamId ? [{ team, position: row.position }] : [];
  }));
}

export function coachJobs(career: Career): Team[] {
  const coach = coachOf(career);
  if (coach.integrity < minimumIntegrity || coachSuspended(career)) return [];
  const employed = career.systems.board.status === 'active';
  if (employed && (completedRounds(career) < 4 || coach.reputation < 40)) return [];
  const changed = career.systems.jobs.at(-1);
  if (employed && changed?.season === career.season && completedRounds(career) - changed.round < 4) return [];
  const recently = new Set(career.systems.jobs.filter((job) => job.season === career.season && completedRounds(career) - job.round < 3)
    .flatMap((job) => [job.fromId, job.toId]));
  const lowestDivision = Math.max(...worldTeams(career).map((team) => team.division));
  return worldLeagues(career).flatMap((league) => league.teams.filter((team) => {
    const criteria = jobRequirements(team);
    const row = league.standings.find((standing) => standing.teamId === team.id)!;
    return team.id !== career.selectedTeamId && !recently.has(team.id)
      && coach.integrity >= criteria.integrity && (coach.reputation >= criteria.reputation || (!employed && team.division === lowestDivision && team.reputation < 55))
      && (coach.integrity >= 30 || team.division === lowestDivision && team.reputation < 60)
      && (!employed || row.position >= 12 || team.reputation >= ownTeam(career).reputation + 5);
  })).sort((a, b) => employed ? b.reputation - a.reputation || a.id.localeCompare(b.id) : a.reputation - b.reputation || a.id.localeCompare(b.id)).slice(0, 3);
}

export function coachBetFixtures(career: Career) {
  const coach = coachOf(career);
  if (career.systems.board.status !== 'active' || coachSuspended(career)) return [];
  const round = career.league.schedule.find((item) => item.matches.some((match) => match.status === 'scheduled'));
  if (!round) return [];
  const teams = worldTeams(career);
  return round.matches.filter((match) => match.status === 'scheduled' && !coach.bets.some((bet) => bet.matchId === match.id && bet.week === careerWeek(career))
    && !coach.approaches.some((item) => item.matchId === `${career.season}:${match.id}`))
    .sort((a, b) => Number(b.homeTeamId === career.selectedTeamId || b.awayTeamId === career.selectedTeamId)
      - Number(a.homeTeamId === career.selectedTeamId || a.awayTeamId === career.selectedTeamId)).slice(0, 3).map((match) => {
    const home = teams.find((team) => team.id === match.homeTeamId)!;
    const away = teams.find((team) => team.id === match.awayTeamId)!;
    const chance = Math.max(.17, Math.min(.59, .40 + (home.reputation - away.reputation) / 190));
    const odds = { home: Math.round(92 / chance) / 100, draw: 3.4, away: Math.round(92 / (.73 - chance)) / 100 };
    return { match, label: `${home.name} × ${away.name}`, odds };
  });
}

export function respondBet(career: Career, matchId: string, response: CoachBet['selection'] | 'declined' | 'reported', stake = 0): Career {
  const fixture = coachBetFixtures(career).find((item) => item.match.id === matchId);
  if (!fixture) throw new Error('Abordagem indisponível.');
  const coach = coachOf(career);
  const week = careerWeek(career);
  if (response === 'reported' || response === 'declined') return setCoach(career, { ...coach,
    approaches: [...coach.approaches, { matchId: `${career.season}:${matchId}`, response }],
    incidents: response === 'reported' ? [...coach.incidents, { week, kind: 'report', text: 'Abordagem suspeita denunciada à comissão disciplinar.' }] : coach.incidents });
  if (!Number.isSafeInteger(stake) || stake < 100 || stake > Math.min(coach.cash, 5000)) throw new Error('A aposta fictícia deve ficar entre R$ 100 e R$ 5.000, dentro do seu patrimônio.');
  const affiliated = fixture.match.homeTeamId === career.selectedTeamId || fixture.match.awayTeamId === career.selectedTeamId;
  return setCoach(career, { ...coach, cash: coach.cash - stake, bets: [...coach.bets, { id: `${career.season}:${matchId}`, matchId,
    label: fixture.label, selection: response, odds: fixture.odds[response], stake, status: 'pending', discovered: false, week,
    evidence: (affiliated ? 75 : 40) + Math.floor(stake / 350) }] });
}

export function progressCoach(before: Career, after: Career): Career {
  const week = careerWeek(after);
  let coach = coachOf(after);
  // Legacy careers need a clock from before the round to receive that week's payment.
  if (!after.systems.coach) coach = { ...coach, lastWeek: careerWeek(before) };
  const elapsed = Math.max(0, week - coach.lastWeek);
  if (!elapsed) return after;
  const employed = before.systems.board.status === 'active';
  const wages = employed ? coachOf(before).salary * elapsed : 0;
  let next = wages && before.systems.coach ? addFinance(after, before.selectedTeamId!, completedRounds(after), 'Salário da comissão técnica', -wages) : after;
  const matches = worldLeagues(after).flatMap((league) => league.schedule.flatMap((round) => round.matches));
  let cash = coach.cash + wages;
  let integrity = !employed && coach.integrity < minimumIntegrity ? Math.min(minimumIntegrity, coach.integrity + elapsed * 2) : coach.integrity;
  let suspendedUntil = coach.suspendedUntil;
  let confidence = next.systems.board.confidence;
  const incidents = [...coach.incidents];
  let dismissal = false;
  const bets = coach.bets.map((bet): CoachBet => {
    if (bet.status !== 'pending') return bet;
    const match = matches.find((entry) => entry.id === bet.matchId && entry.status === 'finished');
    if (!match?.score) return bet;
    const result = match.score.home > match.score.away ? 'home' : match.score.home < match.score.away ? 'away' : 'draw';
    const won = result === bet.selection;
    if (won) cash += Math.floor(bet.stake * bet.odds);
    return { ...bet, status: won ? 'won' : 'lost' };
  }).map((bet): CoachBet => {
    if (bet.discovered || bet.status === 'pending' || week <= bet.week) return bet;
    const age = week - bet.week;
    const repeat = coach.bets.filter((entry) => entry.week <= bet.week).length - 1;
    const threshold = Math.min(96, bet.evidence + Math.min(age, 6) * 5 + repeat * 7);
    const draw = identityHash(`${after.seed}:${bet.id}`) % 100;
    if (age === 1 && draw >= threshold) {
      if (draw < threshold + 20) incidents.push({ week, kind: 'suspicion', text: 'A comissão recebeu uma denúncia sobre apostas na competição.' });
      return bet;
    }
    if (draw >= threshold) return bet;
    const penalty = Math.min(95, (bet.evidence >= 75 ? 68 : 24) + repeat * 11 + Math.floor(bet.stake / 700));
    incidents.push({ week, kind: 'investigation', text: `A investigação comprovou uma aposta proibida em ${bet.label}.` });
    integrity = clamp(integrity - penalty);
    confidence = clamp(confidence - (bet.evidence >= 75 ? 30 : 12));
    suspendedUntil = Math.max(suspendedUntil, week + (bet.evidence >= 75 ? 4 : 2));
    dismissal ||= integrity < minimumIntegrity || bet.evidence >= 75;
    incidents.push({ week, kind: 'sanction', text: `Suspensão até a semana ${suspendedUntil}. Integridade após a punição: ${integrity}/100.` });
    return { ...bet, discovered: true };
  });
  coach = { ...coach, cash, integrity, suspendedUntil, lastWeek: week, bets, incidents };
  next = setCoach({ ...next, systems: { ...next.systems, board: { ...next.systems.board, confidence } } }, coach);
  if (dismissal && next.systems.board.status === 'active') return dismissCoach({ ...next,
    news: ['A diretoria encerrou seu vínculo após uma infração disciplinar comprovada.', ...next.news].slice(0, 20),
  }, 'discipline');
  return next;
}

export function cupTitlesEarned(before: Career, after: Career): string | undefined {
  return allCups(after).find((cup) => cup.championId === after.selectedTeamId
    && !allCups(before).some((old) => old.id === cup.id && old.championId === cup.championId))?.name;
}
