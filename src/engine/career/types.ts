import type { Lineup, Match, Player, PlayerContract } from '../models';

export interface TransferOffer {
  countered?: boolean;
  id: string; playerId: string; playerName: string; buyerId: string; amount: number;
  season: number; round: number; expiresRound: number; status: 'pending' | 'accepted' | 'rejected' | 'expired';
}
export interface TransferRecord {
  id: string; playerId: string; playerName: string; fromId: string | null; fromName: string;
  toId: string; toName: string; fee: number; season: number; round: number;
}
export interface RenewalTerms { years: number; salary: number; bonus: number }
export type RenewalNegotiation = { teamId: string; playerId: string } & (
  { status: 'counter'; attempts: number; demand: RenewalTerms } |
  { status: 'blocked'; availableAfterRound: number }
);
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
  weeks?: number[];
  guestIds?: string[];
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
  competition: import('./progression').Competition; round: number; title: string; result: string; teamId: string;
  position: number; positionChange: number; points: number; moneyChange: number; absences: string[]; notes: string[];
}
export interface CareerSystems {
  renewals?: RenewalNegotiation[];
  savedLineups: { teamId: string; name: 'main' | 'reserve' | 'cup'; lineup: Lineup }[];
  watchlist: { playerId: string; playerName: string; value: number; clubId: string | null }[];
  loans: { id: string; playerId: string; playerName: string; fromId: string; toId: string; season: number; round: number; fee: number; contract: PlayerContract; status: 'active' | 'returned' }[];
  rivalries: { teamIds: [string, string]; intensity: number; reason: string }[];
  milestones: { id: string; playerId: string; playerName: string; teamId: string; relatedTeamId?: string; season: number; round: number; kind: 'debut' | 'first-goal' | 'title' | 'transfer' | 'reunion'; text: string }[];
  stateCups?: Cup[];
  continentalCups?: Cup[];
  marketRound: number; offers: TransferOffer[]; transfers: TransferRecord[]; academy: Academy; board: Board; cup: Cup;
  playerHistory: PlayerSeasonRecord[]; clubHistory: ClubSeasonRecord[]; lastSummary: RoundSummary | null;
  jobs: { season: number; round: number; fromId: string; toId: string }[];
}
