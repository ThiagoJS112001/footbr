import type { Match, Player } from '../models';
import { minutesPlayed } from '../league/season';
import type { Career } from './career';
import type { ClubSeasonRecord, PlayerSeasonRecord } from './types';
import { worldTeams } from './world';

export const seasonMatches = (career: Career): Match[] => [...career.league.schedule, ...career.otherLeague.schedule, ...career.systems.cup.rounds].flatMap((r) => r.matches).filter((m) => m.status === 'finished');
export function recentClubMatches(career: Career): Match[] {
  return [...career.league.schedule.flatMap((r) => r.matches.map((match) => ({ match, order: r.round * 2 }))),
    ...career.systems.cup.rounds.flatMap((r) => r.matches.map((match) => ({ match, order: r.afterRound * 2 + 1 })))]
    .filter(({ match }) => match.status === 'finished' && (match.homeTeamId === career.selectedTeamId || match.awayTeamId === career.selectedTeamId))
    .sort((a, b) => a.order - b.order).slice(-5).map(({ match }) => match);
}
export function currentPlayerRecords(career: Career): PlayerSeasonRecord[] {
  const teams = worldTeams(career);
  const names = new Map([...teams.flatMap((t) => t.squad), ...career.freeAgents].map((p) => [p.id, p.name]));
  for (const transfer of career.systems.transfers) names.set(transfer.playerId, transfer.playerName);
  const records = new Map<string, PlayerSeasonRecord>();
  const get = (playerId: string, teamId: string): PlayerSeasonRecord => {
    const key = `${playerId}/${teamId}`;
    let record = records.get(key);
    if (!record) {
      const team = teams.find((t) => t.id === teamId)!;
      const league = [career.league, career.otherLeague].find((l) => l.teams.some((t) => t.id === teamId))!;
      const titles = league.standings[0]?.teamId === teamId && league.schedule.every((r) => r.matches.every((m) => m.status === 'finished')) ? [`Liga · Divisão ${team.division}`] : [];
      if (career.systems.cup.championId === teamId) titles.push(career.systems.cup.name);
      record = { playerId, playerName: names.get(playerId) ?? 'Jogador transferido', teamId, teamName: team.name, season: career.season, division: team.division, appearances: 0, minutes: 0, goals: 0, titles };
      records.set(key, record);
    }
    return record;
  };
  for (const match of seasonMatches(career)) {
    for (const teamId of [match.homeTeamId, match.awayTeamId]) {
      for (const [id, minutes] of minutesPlayed(match, teamId)) { const r = get(id, teamId); r.appearances++; r.minutes += minutes; }
    }
    for (const event of match.events) if (event.type === 'goal') { const r = get(event.playerId, event.teamId); r.goals++; if (event.playerName) r.playerName = event.playerName; }
  }
  return [...records.values()];
}
export function archiveSeason(career: Career): Career {
  if (career.systems.clubHistory.some((r) => r.season === career.season)) return career;
  const matches = seasonMatches(career);
  const clubs: ClubSeasonRecord[] = [career.league, career.otherLeague].flatMap((league) => league.standings.map((row) => {
    const team = league.teams.find((t) => t.id === row.teamId)!;
    const wins = matches.filter((m) => m.score && (m.homeTeamId === team.id && m.score.home > m.score.away || m.awayTeamId === team.id && m.score.away > m.score.home))
      .sort((a, b) => Math.abs(b.score!.home - b.score!.away) - Math.abs(a.score!.home - a.score!.away));
    const best = wins[0];
    const name = (id: string) => worldTeams(career).find((t) => t.id === id)!.name;
    return { teamId: team.id, teamName: team.name, season: career.season, division: team.division, position: row.position, points: row.points,
      goalsFor: row.goalsFor, goalsAgainst: row.goalsAgainst, leagueTitle: row.position === 1, cupTitle: career.systems.cup.championId === team.id,
      biggestWin: best ? `${name(best.homeTeamId)} ${best.score!.home}–${best.score!.away} ${name(best.awayTeamId)}` : 'Sem vitórias', biggestWinMargin: best ? Math.abs(best.score!.home - best.score!.away) : 0 };
  }));
  return { ...career, systems: { ...career.systems, playerHistory: [...career.systems.playerHistory, ...currentPlayerRecords(career)], clubHistory: [...career.systems.clubHistory, ...clubs] } };
}
export function playerCareerTotals(career: Career, playerId: string) {
  const rows = [...career.systems.playerHistory, ...currentPlayerRecords(career)].filter((p) => p.playerId === playerId);
  return { appearances: rows.reduce((s, p) => s + p.appearances, 0), minutes: rows.reduce((s, p) => s + p.minutes, 0), goals: rows.reduce((s, p) => s + p.goals, 0), titles: [...new Set(rows.flatMap((p) => p.titles.map((title) => `${title} · T${p.season}`)))] };
}
/** Comparação usa os mesmos atributos do motor; não inventa notas adicionais. */
export function comparePlayers(left: Player, right: Player): { label: string; left: number; right: number; higherIsBetter: boolean }[] {
  return [
    { label: 'Força', left: left.overall, right: right.overall, higherIsBetter: true },
    { label: 'Idade', left: left.age, right: right.age, higherIsBetter: false },
    { label: 'Condição', left: left.fitness, right: right.fitness, higherIsBetter: true },
    ...Object.entries({ attack: 'Ataque', midfield: 'Meio-campo', defense: 'Defesa', goalkeeping: 'Goleiro', speed: 'Velocidade', passing: 'Passe', finishing: 'Finalização', stamina: 'Fôlego' }).map(([key, label]) => ({ label, left: left.attributes[key as keyof Player['attributes']], right: right.attributes[key as keyof Player['attributes']], higherIsBetter: true })),
    { label: 'Salário mensal', left: left.contract?.salary ?? 0, right: right.contract?.salary ?? 0, higherIsBetter: false },
    { label: 'Valor de mercado', left: left.marketValue, right: right.marketValue, higherIsBetter: false },
  ];
}
