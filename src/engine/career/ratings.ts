import type { Match } from '../models';
import type { Career } from './career';
import { allCups } from './cup';
import { worldLeagues } from './world';

export interface PlayerMatchRating {
  playerId: string;
  teamId: string;
  minutes: number;
  rating: number;
}

export function matchRatings(match: Match): PlayerMatchRating[] {
  if (match.status !== 'finished' || !match.score || match.forfeitTeamIds?.length || !match.homeLineup || !match.awayLineup) return [];
  const players = new Map<string, { teamId: string; startedAt: number; minutes: number; impact: number }>();
  const active = new Set<string>();
  const enter = (playerId: string, teamId: string, minute: number) => {
    players.set(playerId, { teamId, startedAt: minute, minutes: 0, impact: 0 });
    active.add(playerId);
  };
  const leave = (id: string, minute: number) => {
    const player = players.get(id);
    if (player && active.delete(id)) player.minutes = minute - player.startedAt;
  };
  const add = (id: string, impact: number) => {
    const player = players.get(id);
    if (player) player.impact += impact;
  };
  for (const id of match.homeLineup.starterIds) enter(id, match.homeTeamId, 0);
  for (const id of match.awayLineup.starterIds) enter(id, match.awayTeamId, 0);
  for (const event of match.events) {
    switch (event.type) {
      case 'substitution':
        leave(event.playerOutId, event.minute);
        enter(event.playerInId, event.teamId, event.minute);
        break;
      case 'injury':
        leave(event.playerId, event.minute);
        break;
      case 'card':
        add(event.playerId, event.card === 'red' ? -1.5 : -.35);
        if (event.card === 'red') leave(event.playerId, event.minute);
        break;
      case 'goal':
        for (const id of active) add(id, players.get(id)!.teamId === event.teamId ? .15 : -.2);
        add(event.playerId, 1.1);
        if (event.assistPlayerId) add(event.assistPlayerId, .7);
        break;
    }
  }
  for (const id of active) leave(id, 90);
  for (const event of match.commentary ?? []) {
    if (event.playerId && event.kind !== 'pressure') add(event.playerId, event.kind === 'save' ? .1 : .03);
  }
  return [...players].flatMap(([playerId, { teamId, minutes, impact }]) => minutes > 0 || impact !== 0
    ? [{ playerId, teamId, minutes, rating: Math.round(Math.max(1, Math.min(10, 6 + impact)) * 10) / 10 }]
    : []);
}

export function clubSeasonRatings(career: Career, teamId: string): Map<string, number> {
  const totals = new Map<string, { score: number; minutes: number }>();
  const schedules = [...worldLeagues(career).map((league) => league.schedule), ...allCups(career).map((cup) => cup.rounds)];
  for (const schedule of schedules) for (const round of schedule) for (const match of round.matches) {
    if (match.homeTeamId !== teamId && match.awayTeamId !== teamId) continue;
    for (const entry of matchRatings(match)) {
      if (entry.teamId !== teamId || !entry.minutes) continue;
      const total = totals.get(entry.playerId) ?? { score: 0, minutes: 0 };
      total.score += entry.rating * entry.minutes;
      total.minutes += entry.minutes;
      totals.set(entry.playerId, total);
    }
  }
  return new Map([...totals].map(([id, total]) => [id, Math.round(total.score / total.minutes * 10) / 10]));
}
