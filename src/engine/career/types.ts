import type { Match, Player } from '../models';

export interface TransferOffer {
  id: string; playerId: string; playerName: string; buyerId: string; amount: number;
  season: number; round: number; expiresRound: number; status: 'pending' | 'accepted' | 'rejected' | 'expired';
}
export interface TransferRecord {
  id: string; playerId: string; playerName: string; fromId: string | null; fromName: string;
  toId: string; toName: string; fee: number; season: number; round: number;
}
export interface Prospect {
  player: Player; assessed: boolean; status: 'available' | 'promoted' | 'released';
}
export interface Academy {
  teamId: string | null; season: number; promoted: number; prospects: Prospect[];
}
export interface BoardReview { round: number; confidence: number; note: string }
export interface Board {
  teamId: string | null; targetPosition: number; confidence: number; status: 'active' | 'dismissed';
  lastReviewRound: number; appointedRound: number; reviews: BoardReview[];
  startingPoints?: number;
}
export interface CupRound { round: number; name: string; afterRound: number; matches: Match[] }
export interface Cup {
  id: string; name: string; status: 'active' | 'deferred'; rounds: CupRound[]; byeTeamIds: string[]; championId: string | null;
}
export interface PlayerSeasonRecord {
  playerId: string; playerName: string; teamId: string; teamName: string; season: number; division: number;
  appearances: number; minutes: number; goals: number; titles: string[];
}
export interface ClubSeasonRecord {
  teamId: string; teamName: string; season: number; division: number; position: number; points: number;
  goalsFor: number; goalsAgainst: number; leagueTitle: boolean; cupTitle: boolean; biggestWin: string; biggestWinMargin: number;
}
export interface RoundSummary {
  competition: 'league' | 'cup'; round: number; title: string; result: string; teamId: string;
  position: number; positionChange: number; points: number; moneyChange: number; absences: string[]; notes: string[];
}
export interface CareerSystems {
  marketRound: number; offers: TransferOffer[]; transfers: TransferRecord[]; academy: Academy; board: Board; cup: Cup;
  playerHistory: PlayerSeasonRecord[]; clubHistory: ClubSeasonRecord[]; lastSummary: RoundSummary | null;
  jobs: { season: number; round: number; fromId: string; toId: string }[];
}
