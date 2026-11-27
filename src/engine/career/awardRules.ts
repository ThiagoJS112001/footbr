import type { Match, PlayerPosition } from '../models';
import { identityHash } from '../models/personality';
import { formationSlots, formations, minimumCostAssignment } from '../league/lineup';
import { matchRatings } from './ratings';
import { awardConfig } from './awardTypes';
import type { AwardCampaign, AwardClub, AwardsContext, AwardSelection, CoachAward } from './awardTypes';

type ClubCampaign = AwardCampaign['clubs'][number];
interface Totals {
  clubs: Map<string, ClubCampaign>;
  games: number; minutes: number; weight: number; score: number; squares: number; decisive: number;
  goals: number; assists: number; cleanSheets: number; goalsConceded: number; goalkeeperMinutes: number; saves: number;
}

const byPlayerId = (a: AwardCampaign, b: AwardCampaign) => a.playerId.localeCompare(b.playerId);
const byClubMinutes = (a: ClubCampaign, b: ClubCampaign) => b.minutes - a.minutes || b.games - a.games || b.goals - a.goals || a.teamId.localeCompare(b.teamId);
const newTotals = (): Totals => ({
  clubs: new Map(), games: 0, minutes: 0, weight: 0, score: 0, squares: 0, decisive: 0,
  goals: 0, assists: 0, cleanSheets: 0, goalsConceded: 0, goalkeeperMinutes: 0, saves: 0,
});
const roundAverage = (rating: number) => Math.round(rating * 100) / 100;
const goalkeeperScore = (p: AwardCampaign) => p.average
  + Math.min(.5, p.cleanSheets / Math.max(1, p.goalkeeperMinutes / 90) * .5)
  - Math.min(.7, p.goalsConceded * 90 / Math.max(90, p.goalkeeperMinutes) * .16)
  + Math.min(.42, p.saves * 90 / Math.max(90, p.goalkeeperMinutes) * .07);
const outfieldScore = (p: AwardCampaign) => p.average + Math.min(1.25,
  (p.goals * .75 + p.assists * .6) * 90 / Math.max(90, p.minutes));
const performance = (p: AwardCampaign) => p.position === 'GK' ? goalkeeperScore(p) : outfieldScore(p);

/** Usa escalação, entradas e saídas, notas e lances persistidos de uma só competição. */
export function rankCampaigns(rounds: { matches: Match[] }[], context: AwardsContext, clubs: Map<string, AwardClub>, knockout: boolean) {
  const playedByTeam = new Map<string, number>();
  const totals = new Map<string, Totals>();
  const identities = new Map(context.players.map((player) => [player.playerId, player]));
  for (const [stage, round] of rounds.entries()) for (const match of round.matches) {
    if (match.status !== 'finished' || !match.score || match.forfeitTeamIds?.length) continue;
    for (const teamId of [match.homeTeamId, match.awayTeamId]) playedByTeam.set(teamId, (playedByTeam.get(teamId) ?? 0) + 1);
    const ratings = matchRatings(match);
    if (!ratings.length) continue;
    const goals = match.events.filter((event) => event.type === 'goal');
    const saves = new Map<string, number>();
    for (const event of match.commentary ?? []) if (event.kind === 'save' && event.keeperId) {
      saves.set(event.keeperId, (saves.get(event.keeperId) ?? 0) + 1);
    }
    const homeGoals = goals.filter((goal) => goal.teamId === match.homeTeamId).length;
    const completeGoalLog = homeGoals === match.score.home && goals.length - homeGoals === match.score.away;
    const decisive = knockout ? (stage + 1) / rounds.length : 0;
    for (const { playerId, teamId, minutes, startedAt, rating } of ratings) {
      const identity = identities.get(playerId);
      const club = clubs.get(teamId);
      if (!identity || !club) continue;
      const total = totals.get(playerId) ?? newTotals();
      const split = total.clubs.get(teamId) ?? { ...club, games: 0, minutes: 0, goals: 0, assists: 0 };
      const weight = Math.max(1, minutes);
      total.games++;
      total.minutes += minutes;
      total.weight += weight;
      total.score += rating * weight;
      total.squares += rating ** 2 * weight;
      total.decisive += (rating - 6) * decisive * weight;
      split.games++;
      split.minutes += minutes;
      const home = teamId === match.homeTeamId;
      const lineup = home ? match.homeLineup : match.awayLineup;
      const isKeeper = (lineup?.positions?.[playerId] ?? identity.position) === 'GK';
      if (isKeeper && minutes > 0 && (completeGoalLog || minutes === 90)) {
        const conceded = minutes === 90 ? (home ? match.score.away : match.score.home)
          : goals.filter((goal) => goal.teamId !== teamId && goal.minute > startedAt && goal.minute <= startedAt + minutes).length;
        total.goalsConceded += conceded;
        total.cleanSheets += Number(minutes >= 60 && conceded === 0);
        total.goalkeeperMinutes += minutes;
      }
      if (isKeeper) total.saves += saves.get(playerId) ?? 0;
      for (const goal of goals) if (goal.teamId === teamId) {
        if (goal.playerId === playerId) { total.goals++; split.goals++; }
        if (goal.assistPlayerId === playerId) { total.assists++; split.assists++; }
      }
      total.clubs.set(teamId, split);
      totals.set(playerId, total);
    }
  }
  const shortestEligible = Math.min(2, Math.max(0, ...playedByTeam.values()));
  return [...totals].map(([id, total]) => {
    const splits = [...total.clubs.values()].sort(byClubMinutes);
    const { teamId, teamName } = splits[0];
    const matches = Math.max(...splits.map((split) => playedByTeam.get(split.teamId) ?? 1));
    const weight = total.weight;
    const average = total.score / weight;
    const variation = Math.sqrt(Math.max(0, total.squares / weight - average ** 2));
    const minutesRequired = Math.ceil(matches * 90 * awardConfig.minutesShare);
    const eligible = total.games >= Math.max(shortestEligible, Math.ceil(matches * awardConfig.participationShare)) && total.minutes >= minutesRequired;
    const { games, minutes, goals, assists, cleanSheets, goalsConceded, goalkeeperMinutes, saves } = total;
    const campaign = { ...identities.get(id)!, teamId, teamName, clubs: splits,
      games, minutes, goals, assists, cleanSheets, goalsConceded, goalkeeperMinutes, saves, average: roundAverage(average) };
    const involvement = Math.min(1, minutes / (90 * matches));
    const form = .65 * involvement - .2 * variation + .12 * total.decisive / weight;
    return { campaign, eligible, goalkeeperEligible: eligible && goalkeeperMinutes >= minutesRequired, score: performance(campaign) + form, form };
  });
}

export function pickPlayerAwards(rows: ReturnType<typeof rankCampaigns>) {
  const ranking = rows.filter((row) => row.eligible).sort((a, b) => b.score - a.score
    || b.campaign.minutes - a.campaign.minutes || byPlayerId(a.campaign, b.campaign));
  const ball = ranking[0]?.campaign;
  const youth = ranking.find((row) => row.campaign.age <= awardConfig.youthAge)?.campaign;
  const glove = ranking.filter((row) => row.campaign.position === 'GK' && row.goalkeeperEligible)
    .sort((a, b) => goalkeeperScore(b.campaign) + b.form - goalkeeperScore(a.campaign) - a.form
      || b.campaign.minutes - a.campaign.minutes || byPlayerId(a.campaign, b.campaign))[0]?.campaign;
  // Artilharia: gols, menos jogos, menos minutos, maior nota e ID estável.
  const boot = rows.map((row) => row.campaign).filter((p) => p.goals > 0).sort((a, b) => b.goals - a.goals
    || a.games - b.games || a.minutes - b.minutes || b.average - a.average || byPlayerId(a, b))[0];
  const selectionPool = rows.filter((row) => row.eligible || row.campaign.minutes >= 45);
  return {
    players: ([
      ['golden-ball', ball], ['golden-boot', boot], ['breakthrough', youth], ['golden-glove', glove],
    ] as const).flatMap(([kind, winner]) => winner ? [{ kind, winner }] : []),
    selection: pickAwardSelection(selectionPool.map((row) => row.campaign),
      new Map(selectionPool.map((row) => [row.campaign.playerId, row.score - (row.eligible ? 0 : 25)]))),
  };
}

export function pickAwardSelection(campaigns: AwardCampaign[], scores?: Map<string, number>): AwardSelection | null {
  if (campaigns.length < 11) return null;
  const score = (p: AwardCampaign) => scores?.get(p.playerId) ?? performance(p) + Math.min(.55, Math.log1p(p.minutes / 90) * .13);
  const ranked = [...campaigns].sort((a, b) => score(b) - score(a) || byPlayerId(a, b));
  const positionCost = (p: AwardCampaign, slot: PlayerPosition) => p.position === slot ? 0
    : p.secondary === slot ? 12 : p.position === 'GK' || slot === 'GK' ? 10000 : 150;
  let bestCost = Infinity;
  let best: AwardSelection | null = null;
  for (const formation of ['4-3-3', ...formations.filter((item) => item !== '4-3-3')]) {
    const slots = formationSlots(formation);
    const candidates = [...new Set(slots.flatMap((slot) => ranked.filter((p) => positionCost(p, slot) < 150).slice(0, 11))
      .concat(ranked.filter((p) => p.position !== 'GK' && p.secondary !== 'GK').slice(0, 11)))];
    if (candidates.length < slots.length) continue;
    const costs = slots.map((slot) => candidates.map((p) => positionCost(p, slot) - score(p)));
    const indices = minimumCostAssignment(costs);
    const cost = indices.reduce((sum, index, slot) => sum + costs[slot][index], 0);
    if (cost >= bestCost || indices.some((index, slot) => positionCost(candidates[index], slots[slot]) === 10000)) continue;
    bestCost = cost;
    best = { formation, players: indices.map((index, slot) => ({ ...candidates[index], slot: slots[slot] })) };
  }
  return best;
}

const firstNames = ['Carlos', 'Marcelo', 'Raul', 'Fernando', 'Miguel', 'Rafael', 'Sérgio', 'Paulo', 'Júlio', 'Renato'];
const lastNames = ['Ferreira', 'Monteiro', 'Barreto', 'Ribeiro', 'Siqueira', 'Cardoso', 'Vieira', 'Rezende', 'Oliveira', 'Medeiros', 'Pereira'];
const aiCoachName = (teamId: string) => {
  const hash = identityHash(teamId);
  return `${firstNames[hash % firstNames.length]} ${lastNames[Math.floor(hash / firstNames.length) % lastNames.length]}`;
};

export function pickCoachAward(rounds: { matches: Match[] }[], ranking: string[], context: AwardsContext, knockout: boolean): CoachAward | null {
  const byTeam = new Map<string, { games: number; points: number; userGames: number; name?: string }>();
  for (const round of rounds) for (const match of round.matches) {
    if (match.status !== 'finished' || !match.score) continue;
    for (const [teamId, margin] of [[match.homeTeamId, match.score.home - match.score.away], [match.awayTeamId, match.score.away - match.score.home]] as const) {
      const entry = byTeam.get(teamId) ?? { games: 0, points: 0, userGames: 0 };
      entry.games++;
      entry.points += margin > 0 ? 3 : margin === 0 ? 1 : 0;
      if (match.managedCoach?.teamId === teamId) { entry.userGames++; entry.name = match.managedCoach.name; }
      byTeam.set(teamId, entry);
    }
  }
  const size = ranking.length;
  const clubs = context.clubs.filter((club) => ranking.includes(club.teamId));
  const quality = (club: typeof clubs[number]) => club.strength + club.reputation * .16
    + Math.log10(Math.max(10000, club.budget)) * 1.2;
  const expectations = [...clubs].sort((a, b) => quality(b) - quality(a) || a.teamId.localeCompare(b.teamId));
  const candidates = clubs.flatMap((club) => {
    const position = ranking.indexOf(club.teamId) + 1;
    const relativeRank = expectations.indexOf(club) + 1;
    const expected = knockout ? relativeRank : club.target;
    const results = byTeam.get(club.teamId);
    if (!results || results.games < 2) return [];
    const pointsRate = results.points / (3 * results.games);
    const overachieved = (expected * .7 + relativeRank * .3 - position) / size;
    const score = overachieved * 1.55 + pointsRate * .75 + (1 - (position - 1) / size) * .34 + Number(position === 1) * .22;
    const user = results.userGames >= Math.max(2, Math.ceil(results.games * .5));
    const award = { teamId: club.teamId, teamName: club.teamName, name: user ? results.name! : aiCoachName(club.teamId),
      user, position, expected, games: results.games, pointsRate: roundAverage(pointsRate) };
    return [{ score, award }];
  }).sort((a, b) => b.score - a.score || a.award.position - b.award.position || a.award.teamId.localeCompare(b.award.teamId));
  return candidates[0]?.award ?? null;
}
