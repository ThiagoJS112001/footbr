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
}

export interface LeagueRules {
  promotionSpots: number;
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
