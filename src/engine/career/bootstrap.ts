import type { Career } from './career';
import type { CareerSystems } from './types';
import { createAcademy } from './academy';
import { createBoard } from './board';
import { createCup, createStateCups } from './cup';
import { completedRounds, worldTeams } from './world';
import { initialRivalries } from './stories';

export function createSystems(career: Pick<Career, 'league' | 'otherLeague' | 'extraLeague' | 'seed' | 'season' | 'selectedTeamId'>): CareerSystems {
  const team = worldTeams(career).find((t) => t.id === career.selectedTeamId);
  const round = completedRounds(career);
  return { marketRound: round, offers: [], transfers: [], academy: createAcademy(team, career.seed, career.season), board: createBoard(team, career.league, round),
    stateCups: career.extraLeague && round === 0 ? createStateCups(worldTeams(career), career.seed) : undefined,
    cup: createCup(worldTeams(career), career.seed, career.season, round > 0), playerHistory: [], clubHistory: [], lastSummary: null, jobs: [],
    savedLineups: [], watchlist: [], loans: [], milestones: [], rivalries: initialRivalries(worldTeams(career)) };
}
export const emptySystems: CareerSystems = { marketRound: 0, offers: [], transfers: [], academy: { teamId: null, season: 1, promoted: 0, prospects: [] },
  board: { teamId: null, targetPosition: 10, confidence: 65, status: 'active', appointedRound: 0, lastReviewRound: 0, reviews: [] },
  cup: { id: 'uninitialized', name: 'Copa dos Horizontes', status: 'deferred', rounds: [], byeTeamIds: [], championId: null }, playerHistory: [], clubHistory: [], lastSummary: null, jobs: [],
  savedLineups: [], watchlist: [], loans: [], milestones: [], rivalries: [] };
