import type { League, Match, Player, Team } from '../models';
import { createBoard } from './board';
import { addFinance, type Career } from './career';
import { setCoach, coachOf } from './coach';
import { allCups, cupGuests } from './cup';
import { activeSponsor, sponsorBrands } from './sponsors';
import { completedRounds, replaceTeams, worldLeagues, worldTeams } from './world';
import { matchRatings } from './ratings';
import { pickAwardSelection, pickCoachAward, pickPlayerAwards, rankCampaigns } from './awardRules';
import { awardConfig, awardLabels } from './awardTypes';
import type { AwardClub, AwardPlayer, AwardsContext, CompetitionAwards, PlayerAwardKind, SponsorAwardKind } from './awardTypes';
import type { Cup } from './types';

const clubInfo = (team: Team): AwardClub => ({ teamId: team.id, teamName: team.name });
const playerInfo = (player: Player): AwardPlayer => ({ playerId: player.id, playerName: player.name,
  age: player.age, position: player.primaryPosition, secondary: player.secondaryPosition });

/** O retrato inicial do elenco e orçamento permanece estável após transferências e receitas. */
export function captureAwardsContext(career: Career): Career {
  const prior = career.systems.awardsContext;
  const current = prior?.season === career.season ? prior : undefined;
  const teams = worldTeams(career);
  const players = new Map(current?.players.map((player) => [player.playerId, player]));
  for (const player of [...teams.flatMap((team) => team.squad), ...career.freeAgents]) {
    if (!players.has(player.id)) players.set(player.id, playerInfo(player));
  }
  if (current && current.players.length === players.size) return career;
  const clubs = current?.clubs ?? worldLeagues(career).flatMap((league) => league.teams.map((team) =>
    clubContext(team, career.systems.board.teamId === team.id ? career.systems.board.targetPosition : createBoard(team, league).targetPosition)));
  const competitionsInProgress = current ? current.competitionsInProgress : [
    ...worldLeagues(career).map(({ id, schedule }) => ({ id, rounds: schedule })), ...allCups(career),
  ].filter(({ rounds }) => rounds.some((round) => round.matches.some((match) => match.status === 'finished'))).map(({ id }) => id);
  return { ...career, systems: { ...career.systems, awardsContext: { season: career.season, clubs, players: [...players.values()], competitionsInProgress } } };
}

const clubContext = (team: Team, target: number) => {
  const starters = team.squad.map((player) => player.overall).sort((a, b) => b - a).slice(0, 11);
  return { ...clubInfo(team), target, budget: team.budget, reputation: team.reputation,
    strength: starters.reduce((sum, value) => sum + value, 0) / Math.max(1, starters.length) };
};

const withGuests = (context: AwardsContext, guests: Team[]): AwardsContext => ({ ...context,
  clubs: [...context.clubs, ...guests.map((team) => clubContext(team, 1))],
  players: [...context.players, ...guests.flatMap((team) => team.squad.map(playerInfo))] });
const awardClubs = (context: AwardsContext) => new Map(context.clubs.map(({ teamId, teamName }) => [teamId, { teamId, teamName }]));

export function noteManagedCoach(match: Match, teamId: string | null, name?: string): Match {
  return name && teamId && (match.homeTeamId === teamId || match.awayTeamId === teamId) ? { ...match, managedCoach: { teamId, name } } : match;
}

export const competitionEdition = (career: Career, id: string) => (career.systems.competitionAwards ?? [])
  .find((edition) => edition.season === career.season && edition.id === id);

export function finalizeLeagueAwards(career: Career, league: League): Career {
  if (!league.schedule.length || league.schedule.some((round) => round.matches.some((match) => match.status !== 'finished'))
    || competitionEdition(career, league.id)) return career;
  const ranking = league.standings.map((row) => row.teamId);
  const leaders = league.rules.promotionSpots;
  const bottom = league.rules.relegationSpots;
  return finalizeCompetition(career, {
    id: league.id, name: league.name, kind: 'league', division: league.teams[0].division, ranking, rounds: league.schedule,
    promoted: ranking.slice(0, leaders), relegated: bottom ? ranking.slice(-bottom) : [],
  });
}

export function finalizeCupAwards(career: Career, cup: Cup): Career {
  if (cup.status !== 'active' || !cup.championId || competitionEdition(career, cup.id)) return career;
  const ranking = [cup.championId, ...[...cup.rounds].reverse().flatMap((round) => round.matches.flatMap((match) =>
    match.winnerTeamId ? [match.winnerTeamId === match.homeTeamId ? match.awayTeamId : match.homeTeamId] : []))];
  if (ranking.length < 2) return career;
  const kind = career.systems.cup.id === cup.id ? 'cup' : career.systems.continentalCups?.[0]?.id === cup.id ? 'continental'
    : career.systems.continentalCups?.[1]?.id === cup.id ? 'continental-secondary' : 'state';
  return finalizeCompetition(career, { id: cup.id, name: cup.name, kind, ranking, rounds: cup.rounds,
    promoted: [], relegated: [], guests: cupGuests(cup) });
}

function finalizeCompetition(career: Career, event: Pick<CompetitionAwards, 'id' | 'name' | 'kind' | 'division'> & {
  ranking: string[]; rounds: { matches: Match[] }[]; promoted: string[]; relegated: string[]; guests?: Team[];
}): Career {
  career = captureAwardsContext(career);
  const context = withGuests(career.systems.awardsContext!, event.guests ?? []);
  const clubs = awardClubs(context);
  const lookup = (id: string) => clubs.get(id)!;
  const knockout = event.kind !== 'league';
  const rows = rankCampaigns(event.rounds, context, clubs, knockout);
  const { players, selection } = pickPlayerAwards(rows);
  const coach = !context.competitionsInProgress?.includes(event.id) && rows.some((row) => row.eligible)
    ? pickCoachAward(event.rounds, event.ranking, context, knockout) : null;
  const { id, name, kind, division } = event;
  const edition: CompetitionAwards = { id, name, kind, division, season: career.season, players, selection, coach,
    champion: lookup(event.ranking[0]), runnerUp: lookup(event.ranking[1]),
    promoted: event.promoted.map(lookup), relegated: event.relegated.map(lookup) };
  let next: Career = { ...career, systems: { ...career.systems, competitionAwards: [...(career.systems.competitionAwards ?? []), edition] } };
  next = applyPlayerBenefits(next, edition);
  if (coach?.user) {
    const profile = coachOf(next);
    next = setCoach(next, { ...profile, reputation: Math.min(100, profile.reputation + awardConfig.coachReputation) });
  }
  const bonuses: { kind: SponsorAwardKind; club: AwardClub }[] = [{ kind: 'title', club: edition.champion }];
  for (const { kind, winner } of players) if (kind !== 'golden-glove') bonuses.push({ kind, club: winner });
  if (coach) bonuses.push({ kind: 'coach', club: coach });
  for (const { kind, club } of bonuses) {
    const sponsor = activeSponsor(next, club.teamId);
    const clause = sponsor?.awardBonuses?.find((entry) => entry.kind === kind);
    if (sponsor && clause) next = addFinance(next, club.teamId, completedRounds(next),
      `Bônus de patrocínio · ${sponsorBrands[sponsor.sponsorId].name} · ${awardLabels[kind]} · ${edition.name}`, Math.round(sponsor.annual * clause.rate), true);
  }
  return next;
}

function applyPlayerBenefits(career: Career, edition: CompetitionAwards): Career {
  const effects = new Map<string, PlayerAwardKind[]>();
  for (const { kind, winner } of edition.players) effects.set(winner.playerId, [...(effects.get(winner.playerId) ?? []), kind]);
  for (const player of edition.selection?.players ?? []) effects.set(player.playerId, [...(effects.get(player.playerId) ?? []), 'selection']);
  const apply = (player: Player) => {
    const kinds = effects.get(player.id);
    if (!kinds) return player;
    const rate = Math.min(awardConfig.maxPrestige, prestigeOf(player) + kinds.reduce((sum, kind) => sum + awardConfig.prestige[kind], 0));
    const morale = Math.min(100, player.morale + Math.min(14, kinds.reduce((sum, kind) => sum + awardConfig.morale[kind], 0)));
    return { ...withPrestige(player, edition.season, rate), morale };
  };
  const teams = worldTeams(career).filter((team) => team.squad.some((player) => effects.has(player.id)));
  return { ...replaceTeams(career, teams.map((team) => ({ ...team, squad: team.squad.map(apply) }))), freeAgents: career.freeAgents.map(apply) };
}

export const prestigeOf = (player: Player) => player.marketPrestige?.rate ?? 0;
export const marketInterestBonus = (player: Player, buyer: Team) => prestigeOf(player) * (player.age <= awardConfig.youthAge && buyer.budget >= 10_000_000 ? 32
  : ['ST', 'LW', 'RW'].includes(player.primaryPosition) ? 26 : 20);

export function withPrestige(player: Player, season: number, rate: number): Player {
  const value = prestigeOf(player) === rate ? player.marketValue
    : Math.round(player.marketValue / (1 + prestigeOf(player)) * (1 + rate) / 1000) * 1000;
  return { ...player, marketValue: value, marketPrestige: rate ? { rate, season } : undefined };
}

export function retainedPrestige(career: Career) {
  const candidates = new Set([...worldTeams(career).flatMap((team) => team.squad), ...career.freeAgents]
    .filter((player) => prestigeOf(player)).map((player) => player.id));
  const totals = new Map<string, { points: number; minutes: number }>();
  if (!candidates.size) return totals;
  for (const rounds of [...worldLeagues(career).map((league) => league.schedule), ...allCups(career).map((cup) => cup.rounds)]) {
    for (const { matches } of rounds) for (const match of matches) for (const row of matchRatings(match)) if (candidates.has(row.playerId)) {
      const entry = totals.get(row.playerId) ?? { points: 0, minutes: 0 };
      entry.points += row.rating * row.minutes;
      entry.minutes += row.minutes;
      totals.set(row.playerId, entry);
    }
  }
  return totals;
}

export function agePrestige(player: Player, season: number, totals: ReturnType<typeof retainedPrestige>): Player {
  if (!player.marketPrestige || player.marketPrestige.season === season) return player;
  const performance = totals.get(player.id);
  const strong = performance && performance.minutes >= awardConfig.strongSeasonMinutes && performance.points / performance.minutes >= awardConfig.strongSeasonRating;
  const rate = Math.round(prestigeOf(player) * (strong ? awardConfig.prestigeRetention.strong : awardConfig.prestigeRetention.ordinary) * 1000) / 1000;
  return withPrestige(player, player.marketPrestige.season, rate < .005 ? 0 : rate);
}

export function completeSeasonAwards(career: Career): Career {
  if (career.systems.seasonAwards?.some((entry) => entry.season === career.season)
    || worldLeagues(career).some((league) => league.schedule.some((round) => round.matches.some((match) => match.status !== 'finished')))
    || allCups(career).some((cup) => cup.status === 'active' && !cup.championId)) return career;
  let next = captureAwardsContext(career);
  for (const league of worldLeagues(next)) next = finalizeLeagueAwards(next, league);
  for (const cup of allCups(next)) next = finalizeCupAwards(next, cup);
  const cups = allCups(next);
  const context = withGuests(next.systems.awardsContext!, cups.flatMap(cupGuests));
  const leagues = worldLeagues(next);
  const rounds = [...leagues.flatMap((league) => league.schedule), ...cups.flatMap((cup) => cup.rounds)];
  const seasonMinimum = Math.ceil(Math.max(...leagues.map((league) => league.schedule.length)) * .18);
  const ranking = rankCampaigns(rounds, context, awardClubs(context), false)
    .filter((row) => row.eligible && row.campaign.games >= seasonMinimum);
  const selection = pickAwardSelection(ranking.map((row) => row.campaign), new Map(ranking.map((row) => [row.campaign.playerId, row.score])));
  const coachedClubs = [...new Set(coachOf(next).stints.filter((entry) => entry.season === next.season).map((entry) => entry.teamId))];
  return { ...next, systems: { ...next.systems, seasonAwards: [...(next.systems.seasonAwards ?? []), { season: next.season, selection, coachedClubs }] } };
}

export function playerAwards(career: Pick<Career, 'systems'>, playerId: string) {
  return [...(career.systems.competitionAwards ?? [])].reverse().flatMap((edition) => [
    ...edition.players.filter(({ winner }) => winner.playerId === playerId),
    ...(edition.selection?.players ?? []).filter((player) => player.playerId === playerId).map((winner) => ({ kind: 'selection' as const, winner })),
  ].map((entry) => ({ ...entry, edition })));
}
