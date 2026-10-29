import type { Tactic } from './Tactic';

export interface Lineup {
  starterIds: string[];
  substituteIds: string[];
  tactic: Tactic;
}

export interface MatchScore {
  home: number;
  away: number;
}

export interface TeamMatchStatistics {
  /** Porcentagem de posse de bola, de 0 a 100. */
  possession: number;
  shots: number;
  xG: number;
}

export interface MatchStatistics {
  home: TeamMatchStatistics;
  away: TeamMatchStatistics;
}

export interface MatchEventBase {
  minute: number;
  teamId: string;
}

export type MatchEvent = MatchEventBase & (
  | { type: 'goal'; playerId: string; assistPlayerId: string | null }
  | { type: 'card'; playerId: string; card: 'yellow' | 'red' }
  | { type: 'injury'; playerId: string; description: string }
  | { type: 'substitution'; playerOutId: string; playerInId: string }
);

export interface Match {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  status: 'scheduled' | 'in-progress' | 'finished';
  homeLineup: Lineup | null;
  awayLineup: Lineup | null;
  /** null até o início da partida. */
  score: MatchScore | null;
  events: MatchEvent[];
  statistics: MatchStatistics | null;
}
