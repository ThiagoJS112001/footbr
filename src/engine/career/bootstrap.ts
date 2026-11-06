import type { Career } from './career';
import type { CareerSystems } from './types';
import { createAcademy } from './academy';
import { createBoard } from './board';
import { createCup } from './cup';
import { completedRounds, worldTeams } from './world';

export function createSystems(career: Pick<Career, 'league' | 'otherLeague' | 'seed' | 'season' | 'selectedTeamId'>): CareerSystems {
  const team = worldTeams(career).find((t) => t.id === career.selectedTeamId);
  const round = completedRounds(career);
  return { marketRound: round, offers: [], transfers: [], academy: createAcademy(team, career.seed, career.season), board: createBoard(team, career.league, round),
    cup: createCup(worldTeams(career), career.seed, career.season, round > 0), playerHistory: [], clubHistory: [], lastSummary: null, jobs: [] };
}
export const emptySystems: CareerSystems = { marketRound: 0, offers: [], transfers: [], academy: { teamId: null, season: 1, promoted: 0, prospects: [] },
  board: { teamId: null, targetPosition: 10, confidence: 65, status: 'active', appointedRound: 0, lastReviewRound: 0, reviews: [] },
  cup: { id: 'uninitialized', name: 'Copa dos Horizontes', status: 'deferred', rounds: [], byeTeamIds: [], championId: null }, playerHistory: [], clubHistory: [], lastSummary: null, jobs: [] };
