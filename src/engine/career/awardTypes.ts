import type { PlayerPosition } from '../models';

export const playerAwardKinds = ['golden-ball', 'golden-boot', 'breakthrough', 'golden-glove', 'selection'] as const;
export type PlayerAwardKind = typeof playerAwardKinds[number];
export const sponsorAwardKinds = ['title', 'golden-ball', 'golden-boot', 'breakthrough', 'coach'] as const;
export type SponsorAwardKind = typeof sponsorAwardKinds[number];
export type AwardCompetition = 'league' | 'state' | 'cup' | 'continental' | 'continental-secondary';

export const awardLabels = {
  title: 'Título', 'golden-ball': 'Bola de Ouro', 'golden-boot': 'Chuteira de Ouro',
  breakthrough: 'Revelação', 'golden-glove': 'Luva de Ouro', coach: 'Melhor Técnico', selection: 'Seleção do Campeonato',
} as const;

export const awardConfig = {
  prestige: { 'golden-ball': .13, 'golden-boot': .10, breakthrough: .15, 'golden-glove': .08, selection: .025 },
  morale: { 'golden-ball': 7, 'golden-boot': 5, breakthrough: 4, 'golden-glove': 5, selection: 2 },
  maxPrestige: .30, youthAge: 21, coachReputation: 5,
  participationShare: .4, minutesShare: .3, strongSeasonRating: 6.65, strongSeasonMinutes: 270,
  prestigeRetention: { strong: .65, ordinary: .35 },
} as const;

export interface AwardClub { teamId: string; teamName: string }
export interface AwardPlayer {
  playerId: string; playerName: string; age: number; position: PlayerPosition; secondary: PlayerPosition | null;
}
export interface AwardCampaign extends AwardPlayer, AwardClub {
  games: number; minutes: number; average: number; goals: number; assists: number;
  cleanSheets: number; goalsConceded: number; goalkeeperMinutes: number; saves: number;
  clubs: (AwardClub & { games: number; minutes: number; goals: number; assists: number })[];
}
export interface AwardSelection {
  formation: string;
  players: (AwardCampaign & { slot: PlayerPosition })[];
}
export interface CoachAward extends AwardClub {
  name: string; user: boolean; position: number; expected: number; games: number; pointsRate: number;
}
export interface CompetitionAwards {
  id: string; season: number; name: string; kind: AwardCompetition; division?: number;
  champion: AwardClub; runnerUp: AwardClub; promoted: AwardClub[]; relegated: AwardClub[];
  players: { kind: Exclude<PlayerAwardKind, 'selection'>; winner: AwardCampaign }[];
  selection: AwardSelection | null; coach: CoachAward | null;
}
export interface SeasonAwards {
  season: number; selection: AwardSelection | null; coachedClubs: string[];
}
export interface AwardsContext {
  season: number; players: AwardPlayer[];
  clubs: (AwardClub & { strength: number; reputation: number; budget: number; target: number })[];
  competitionsInProgress?: string[];
}
