import { allCups } from './cup';
import type { Match, Team } from '../models';
import type { Career } from './career';
import type { CareerSystems } from './types';
import { minutesPlayed } from '../league/season';
import { clubProfile } from '../models/personality';
import { worldLeagues, worldTeams } from './world';

export function initialRivalries(teams: Team[]): CareerSystems['rivalries'] {
  return teams.flatMap((team, i) => teams.slice(i + 1).filter((other) => team.city.trim().length > 0 && !/não informada|desconhecida|unknown/i.test(team.city) && other.city.trim().toLocaleLowerCase('pt-BR') === team.city.trim().toLocaleLowerCase('pt-BR'))
    .map((other) => ({ teamIds: [team.id, other.id] as [string, string], intensity: 30, reason: 'Rivalidade da cidade' })));
}
export const rivalryBetween = (career: Career, a: string, b: string) => career.systems.rivalries.find((r) => r.teamIds.includes(a) && r.teamIds.includes(b));
export function derbyAttendance(career: Career, a: Team, bId: string): number {
  return rivalryBetween(career, a.id, bId) ? clubProfile(a) === 'community' ? 1.2 : 1.1 : 1;
}

/** Registra somente histórias sustentadas por atuações e resultados confirmados. */
export function recordMatchStories(before: Career, after: Career, match: Match, competition: 'league' | 'cup', round: number): Career {
  if (match.forfeitTeamIds?.length) return after;
  const teams = worldTeams(after);
  const milestones = [...after.systems.milestones];
  const add = (kind: CareerSystems['milestones'][number]['kind'], playerId: string, playerName: string, teamId: string, text: string, suffix = '') => {
    const id = `${kind}-${playerId}-${teamId}${suffix}`;
    if (!milestones.some((m) => m.id === id)) milestones.push({ id, kind, playerId, playerName, teamId, season: after.season, round, text });
  };
  const past = [...worldLeagues(before).flatMap((league) => league.schedule), ...allCups(before).flatMap((cup) => cup.rounds)].flatMap((r) => r.matches).filter((m) => m.status === 'finished');
  for (const teamId of [match.homeTeamId, match.awayTeamId]) {
    const team = teams.find((t) => t.id === teamId);
    if (!team) continue;
    const opponentId = teamId === match.homeTeamId ? match.awayTeamId : match.homeTeamId;
    for (const [playerId, minutes] of minutesPlayed(match, teamId)) {
      if (!minutes) continue;
      const player = team.squad.find((p) => p.id === playerId) ?? worldTeams(before).find((t) => t.id === teamId)?.squad.find((p) => p.id === playerId);
      if (!player) continue;
      const played = before.systems.playerHistory.some((r) => r.playerId === playerId && r.teamId === teamId && r.appearances > 0)
        || past.some((m) => [m.homeTeamId, m.awayTeamId].includes(teamId) && minutesPlayed(m, teamId).has(playerId));
      if (!played) add('debut', playerId, player.name, teamId, `${player.name}${player.academyClubId === teamId ? ', formado na base,' : ''} estreou pelo ${team.name}.`);
      if (after.systems.transfers.some((t) => t.playerId === playerId && t.fromId === opponentId) || player.academyClubId === opponentId
        || after.systems.loans.some((l) => l.playerId === playerId && l.fromId === opponentId && l.status === 'active')) {
        add('reunion', playerId, player.name, teamId, `${player.name} reencontrou ${teams.find((t) => t.id === opponentId)!.name} em campo.`, `-${after.season}-${match.id}`);
      }
    }
  }
  for (const event of match.events) if (event.type === 'goal' && teams.some((team) => team.id === event.teamId)) {
    const scored = before.systems.playerHistory.some((r) => r.playerId === event.playerId && r.teamId === event.teamId && r.goals > 0)
      || past.some((m) => m.events.some((e) => e.type === 'goal' && e.playerId === event.playerId && e.teamId === event.teamId));
    if (!scored) add('first-goal', event.playerId, event.playerName ?? 'Jogador', event.teamId, `${event.playerName ?? 'Jogador'} marcou seu primeiro gol pelo ${teams.find((t) => t.id === event.teamId)!.name}.`);
  }
  const rivalries = after.systems.rivalries.map((r) => ({ ...r }));
  if (!teams.some((team) => team.id === match.homeTeamId) || !teams.some((team) => team.id === match.awayTeamId)) return { ...after, systems: { ...after.systems, milestones } };
  const table = worldLeagues(before).find((l) => l.teams.some((t) => t.id === match.homeTeamId))!.standings;
  const a = table.find((r) => r.teamId === match.homeTeamId);
  const b = table.find((r) => r.teamId === match.awayTeamId);
  const decisive = competition === 'cup' && round >= 5;
  const duel = competition === 'league' && round >= 28 && a && b && Math.abs(a.points - b.points) <= 3
    && (a.position <= 5 && b.position <= 5 || a.position >= 15 && b.position >= 15);
  let rivalry = rivalries.find((r) => r.teamIds.includes(match.homeTeamId) && r.teamIds.includes(match.awayTeamId));
  if (decisive || duel || rivalry) {
    if (!rivalry) { rivalry = { teamIds: [match.homeTeamId, match.awayTeamId], intensity: 0, reason: decisive ? 'Decisões de copa' : 'Disputas decisivas na liga' }; rivalries.push(rivalry); }
    rivalry.intensity = Math.min(100, rivalry.intensity + (decisive ? 25 : duel ? 15 : 5));
  }
  return { ...after, systems: { ...after.systems, milestones, rivalries } };
}

export function recordTransferStory(career: Career, playerId: string, playerName: string, fromName: string, toId: string, toName: string, round: number): Career {
  const id = `transfer-story-${career.season}-${round}-${playerId}-${career.systems.transfers.length}`;
  const fromId = career.systems.transfers.at(-1)?.fromId;
  return { ...career, systems: { ...career.systems, milestones: [...career.systems.milestones, { id, kind: 'transfer', playerId, playerName, teamId: toId, ...(fromId ? { relatedTeamId: fromId } : {}), season: career.season, round, text: `${playerName} deixou ${fromName} e acertou com ${toName}.` }] } };
}
