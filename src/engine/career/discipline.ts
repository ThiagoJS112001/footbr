import type { Player } from '../models';
import { addFinance, type Career } from './career';
import { ownTeam, replaceTeams, requireManagedClub } from './world';

export function redCardFine(player: Player, teamId: string): number {
  const sanction = player.discipline.redSuspension;
  return player.discipline.suspendedMatches && sanction?.teamId === teamId && sanction.games >= 3 && !sanction.fined
    ? Math.floor((player.contract?.salary ?? 0) / 4) : 0;
}

export function finePlayer(career: Career, playerId: string, round: number): Career {
  requireManagedClub(career);
  const team = ownTeam(career);
  const player = team.squad.find((p) => p.id === playerId);
  const amount = player ? redCardFine(player, team.id) : 0;
  if (!player || !amount || !player.discipline.redSuspension) throw new Error('Este jogador não tem multa disponível por expulsão.');
  const updated = { ...player, discipline: { ...player.discipline, redSuspension: { ...player.discipline.redSuspension, fined: true } } };
  const next = replaceTeams(career, [{ ...team, squad: team.squad.map((p) => p.id === playerId ? updated : p) }]);
  return addFinance(next, team.id, round, `Multa disciplinar · ${player.name}`, amount);
}
