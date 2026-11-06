import type { Tactic } from './Tactic';
import type { PlayerPosition } from './Player';

export interface Lineup {
  starterIds: string[];
  substituteIds: string[];
  tactic: Tactic;
  /** Posição ocupada por titular, quando diferente de sua posição principal. */
  positions?: Record<string, PlayerPosition>;
}

export interface MatchScore {
  home: number;
  away: number;
}

export interface TeamMatchStatistics {
  /** Porcentagem de posse de bola, de 0 a 100. */
  possession: number;
  shots: number;
  shotsOnTarget: number;
  corners: number;
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
  | { type: 'goal'; playerId: string; playerName?: string; assistPlayerId: string | null }
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
  /** W.O. por falta de escalação elegível; não gera gols para artilheiros. */
  forfeitTeamIds?: string[];
  penalties?: MatchScore;
  winnerTeamId?: string;
  styleChanges?: { minute: number; teamId: string; style: Tactic['style'] }[];
}
