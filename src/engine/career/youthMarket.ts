import type { Team } from '../models';
import { clubProfile, identityHash } from '../models/personality';
import { clubAcademy, promoteForClub, prospectSalary, saveAcademy } from './academy';
import { addFinance, isWindowOpen, type Career } from './career';
import { appendTransfer, rosterSize, spendingRoom } from './market';
import type { Prospect } from './types';
import { ownTeam, requireManagedClub, worldTeams } from './world';

const capacity = 8;
const activeProspects = (career: Career, team: Team) => clubAcademy(career, team).prospects.filter((p) => p.status === 'available');

export function youthEvaluation(career: Career, buyerId: string, prospect: Prospect) {
  const { player } = prospect;
  const level = career.systems.youthReports?.find((item) => item.teamId === buyerId && item.playerId === player.id)?.level ?? 0;
  const estimate = (player.potential ?? player.overall) + (identityHash(player.id) % 9 - 4) * (1 - level * .18);
  const spread = 10 - level * 2;
  return { level, low: Math.max(player.overall, Math.floor(estimate - spread)), high: Math.max(player.overall, Math.min(99, Math.ceil(estimate + spread))),
    confidence: 35 + level * 18, price: Math.round((player.overall * 950 + Math.max(0, estimate - player.overall) * 2500 + (20 - player.age) * 4000) / 1000) * 1000 };
}

export function youthCandidates(career: Career) {
  return worldTeams(career).filter((team) => team.id !== career.selectedTeamId).flatMap((team) =>
    activeProspects(career, team).map((prospect) => ({ team, prospect })));
}

export function scoutYouth(career: Career, id: string, round: number): Career {
  requireManagedClub(career);
  const buyer = ownTeam(career);
  const row = youthCandidates(career).find(({ prospect }) => prospect.player.id === id);
  if (!row) throw new Error('Jovem indisponível para observação.');
  const level = youthEvaluation(career, buyer.id, row.prospect).level;
  const fee = (level + 1) * 3500;
  if (level >= 3 || buyer.budget < fee) throw new Error('Não é possível realizar outra observação.');
  const next = addFinance(career, buyer.id, round, `Observação de jovem · ${row.prospect.player.name}`, -fee);
  return { ...next, systems: { ...next.systems, youthReports: [...(next.systems.youthReports ?? []).filter((item) => item.teamId !== buyer.id || item.playerId !== id),
    { teamId: buyer.id, playerId: id, level: level + 1 }] } };
}

export function youthRivals(career: Career, seller: Team, prospect: Prospect, round: number) {
  return worldTeams(career).filter((team) => team.id !== seller.id && team.id !== career.selectedTeamId && clubProfile(team) === 'academy'
    && spendingRoom(team) > 140_000 && identityHash(`${team.id}:${prospect.player.id}:${round}`) % 32 === 0).slice(0, 2);
}

function transferYouth(career: Career, buyer: Team, seller: Team, prospect: Prospect, fee: number, round: number): Career {
  const source = clubAcademy(career, seller);
  const destination = clubAcademy(career, buyer);
  const player = { ...prospect.player, academyClubId: prospect.player.academyClubId ?? seller.id };
  let next = saveAcademy(career, { ...source, prospects: source.prospects.filter((item) => item.player.id !== player.id) });
  next = saveAcademy(next, { ...destination, prospects: [...destination.prospects, { ...prospect, player, assessed: false }] });
  next = addFinance(next, buyer.id, round, `Direitos de jovem · ${player.name}`, -fee);
  next = addFinance(next, seller.id, round, `Direitos de jovem · ${player.name}`, fee);
  return appendTransfer(next, player, seller, buyer, fee, round);
}

export function offerYouth(career: Career, id: string, fee: number, round: number): { career: Career; message: string } {
  requireManagedClub(career);
  const buyer = ownTeam(career);
  if (!isWindowOpen(round)) throw new Error('A janela de contratações está fechada.');
  if (clubAcademy(career, buyer).prospects.length >= capacity) throw new Error('A base tem espaço para até oito atletas por temporada.');
  if (!Number.isSafeInteger(fee) || fee < 1000 || fee > spendingRoom(buyer)) throw new Error('Informe um valor válido que preserve a reserva da folha.');
  const row = youthCandidates(career).find(({ prospect }) => prospect.player.id === id);
  if (!row) throw new Error('Este jovem já não está disponível.');
  const { team: seller, prospect } = row;
  const evaluation = youthEvaluation(career, buyer.id, prospect);
  const asking = evaluation.price * (1 + youthRivals(career, seller, prospect, round).length * .12);
  if (fee < asking || activeProspects(career, seller).length <= 2) return { career, message: `${seller.name} recusou a proposta pelos direitos de ${prospect.player.name}.` };
  return { career: transferYouth(career, buyer, seller, prospect, fee, round), message: `${prospect.player.name} integrou as categorias de base.` };
}

export function processAiYouth(career: Career, round: number): Career {
  if (round !== 3 && round !== 22) return career;
  let next = career;
  const teams = worldTeams(career).filter((team) => team.id !== career.selectedTeamId || career.systems.board.status === 'dismissed');
  const buyers = teams.filter((team) => clubProfile(team) === 'academy').sort((a, b) => identityHash(`${a.id}:${career.season}:${round}`) - identityHash(`${b.id}:${career.season}:${round}`));
  for (const buyer of buyers.slice(0, 2)) {
    if (clubAcademy(next, buyer).prospects.length >= capacity) continue;
    const seller = teams.find((team) => team.id !== buyer.id && activeProspects(next, team).length >= 4);
    const prospect = seller && activeProspects(next, seller).filter((p) => p.player.age <= 18).sort((a, b) => b.player.overall - a.player.overall)[0];
    if (!seller || !prospect) continue;
    const fee = youthEvaluation(next, buyer.id, prospect).price;
    if (fee <= spendingRoom(buyer) * .2) next = transferYouth(next, buyer, seller, prospect, fee, round);
  }
  for (const original of buyers.slice(0, 4)) {
    const team = worldTeams(next).find((club) => club.id === original.id)!;
    const academy = clubAcademy(next, team);
    const prospect = activeProspects(next, team).filter((p) => p.player.age >= 18).sort((a, b) => b.player.overall - a.player.overall)[0];
    if (prospect && academy.promoted < 3 && rosterSize(next, team.id) < 30 && spendingRoom(team) >= 2 * prospectSalary(prospect.player.overall)) {
      next = promoteForClub(next, team, academy, prospect.player.id, round);
    }
  }
  return next;
}
