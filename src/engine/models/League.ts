import type { Match } from './Match';
import type { Team } from './Team';

export interface LeagueRound {
  round: number;
  matches: Match[];
}

export interface LeagueStanding {
  teamId: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  position: number;
  qualified: boolean;
  relegated: boolean;
}

export interface LeagueRules {
  promotionSpots: number;
  qualificationSpots: number;
  relegationSpots: number;
}

export interface League {
  id: string;
  name: string;
  teams: Team[];
  schedule: LeagueRound[];
  standings: LeagueStanding[];
  rules: LeagueRules;
}
