import type { Player, PlayerPosition, Team } from '../models';
import type { Career } from './career';
import { addFinance, isWindowOpen, seasonSeed } from './career';
import { careerConfig as config } from './config';
import { monthlyPayroll, ownTeam, replaceTeams, worldTeams, requireManagedClub } from './world';
import { formationSlots } from '../league/lineup';

export const canSell = (team: Team, player: Player) => team.squad.length > 18 && team.squad.filter((p) => p.primaryPosition === player.primaryPosition).length > Math.max(1, formationSlots(team.defaultTactic.formation).filter((p) => p === player.primaryPosition).length);
export const spendingRoom = (team: Team) => Math.max(0, team.budget - monthlyPayroll(team) * config.salaryReserveMonths);
export function appendTransfer(career: Career, player: Player, seller: Team | undefined, buyer: Team, fee: number, round: number): Career {
  const record = { id: `transfer-${career.season}-${round}-${career.systems.transfers.length}`, playerId: player.id, playerName: player.name,
    fromId: seller?.id ?? null, fromName: seller?.name ?? 'Sem clube', toId: buyer.id, toName: buyer.name, fee, season: career.season, round };
  return { ...career, systems: { ...career.systems, transfers: [...career.systems.transfers, record] } };
}
function executeTransfer(career: Career, playerId: string, buyerId: string, fee: number, salary: number, round: number): Career {
  const teams = worldTeams(career);
  const buyer = teams.find((t) => t.id === buyerId);
  const seller = teams.find((t) => t.squad.some((p) => p.id === playerId));
  const player = seller?.squad.find((p) => p.id === playerId) ?? career.freeAgents.find((p) => p.id === playerId);
  if (!buyer || !player || buyer.id === seller?.id || buyer.squad.length >= 35 || spendingRoom(buyer) < fee + salary * config.salaryReserveMonths || fee < 0) throw new Error('Transferência indisponível.');
  if (seller && !canSell(seller, player)) throw new Error('O elenco não tem cobertura para liberar esse jogador.');
  const signed = { ...player, currentTeamId: buyer.id, contract: { salary, yearsRemaining: 3 } };
  let next = replaceTeams(career, [{ ...buyer, squad: [...buyer.squad, signed] }, ...(seller ? [{ ...seller, squad: seller.squad.filter((p) => p.id !== playerId) }] : [])]);
  next = addFinance(next, buyer.id, round, `Compra · ${player.name}`, -fee);
  if (seller) next = addFinance(next, seller.id, round, `Venda · ${player.name}`, fee);
  next = appendTransfer(next, player, seller, buyer, fee, round);
  return { ...next, freeAgents: next.freeAgents.filter((p) => p.id !== playerId), lineup: seller?.id === next.selectedTeamId ? null : next.lineup };
}
function needs(team: Team): PlayerPosition[] {
  const positions: PlayerPosition[] = ['GK', 'CB', 'LB', 'RB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST'];
  const quality = (position: PlayerPosition) => {
    const players = team.squad.filter((p) => p.primaryPosition === position).sort((a, b) => b.overall - a.overall);
    const required = position === 'CB' || position === 'CM' ? 3 : 2;
    return players.length < required ? -100 + players.length : players.slice(0, required).reduce((s, p) => s + p.overall, 0) / required;
  };
  return positions.sort((a, b) => quality(a) - quality(b) || a.localeCompare(b));
}
export function refreshOffers(career: Career, round: number): Career {
  const offers = career.systems.offers.map((o) => o.status === 'pending' && (o.expiresRound < round || !isWindowOpen(round)) ? { ...o, status: 'expired' as const } : o);
  if (!isWindowOpen(round) || career.systems.board.status === 'dismissed') return { ...career, systems: { ...career.systems, offers } };
  const team = ownTeam(career);
  const interested = worldTeams(career).filter((t) => t.id !== team.id && spendingRoom(t) > 0 && t.squad.length < 35).sort((a, b) => spendingRoom(b) - spendingRoom(a) || a.id.localeCompare(b.id));
  for (const buyer of interested) {
    if (offers.filter((o) => o.status === 'pending').length >= config.maxIncomingOffers) break;
    const position = needs(buyer)[0];
    const options = team.squad.filter((p) => canSell(team, p) && !offers.some((o) => o.playerId === p.id && o.status === 'pending'))
      .sort((a, b) => Number(b.primaryPosition === position) - Number(a.primaryPosition === position) || (b.potential ?? b.overall) - (a.potential ?? a.overall) || a.id.localeCompare(b.id));
    const player = options.find((p) => p.marketValue * .9 + (p.contract?.salary ?? 1000) * config.salaryReserveMonths <= spendingRoom(buyer));
    if (!player) continue;
    const id = `offer-${career.season}-${round}-${buyer.id}-${player.id}`;
    if (offers.some((o) => o.id === id)) continue;
    offers.push({ id, playerId: player.id, playerName: player.name, buyerId: buyer.id, amount: Math.round(player.marketValue * .9 / 1000) * 1000,
      season: career.season, round, expiresRound: Math.min(round + 1, round <= 4 ? 4 : 23), status: 'pending' });
  }
  return { ...career, systems: { ...career.systems, offers } };
}

/** Uma passagem por semana; compras usam necessidade, melhoria e reserva de salários. */
export function processAiMarket(career: Career, round: number): Career {
  if (round <= career.systems.marketRound) return career;
  let next = { ...career, systems: { ...career.systems, marketRound: round } };
  if (!isWindowOpen(round)) return refreshOffers(next, round);
  const buyers = worldTeams(next).filter((t) => t.id !== next.selectedTeamId).sort((a, b) => {
    const rank = (t: Team) => (t.reputation * 7919 + seasonSeed(next) + round * t.id.length) % 101;
    return rank(a) - rank(b) || a.id.localeCompare(b.id);
  });
  let transfers = 0;
  for (const original of buyers) {
    if (transfers >= config.maxAiTransfersPerRound) break;
    const teams = worldTeams(next);
    const buyer = teams.find((t) => t.id === original.id)!;
    if (buyer.squad.length >= 30 || spendingRoom(buyer) <= 0) continue;
    const positions = needs(buyer).slice(0, 3);
    const pool = [...next.freeAgents, ...teams.filter((t) => t.id !== buyer.id && t.id !== next.selectedTeamId).flatMap((t) => t.squad.filter((p) => canSell(t, p)))];
    const candidates = pool.filter((p) => positions.includes(p.primaryPosition) && !p.injury && !p.discipline.suspendedMatches)
      .map((p) => {
        const current = buyer.squad.filter((q) => q.primaryPosition === p.primaryPosition).sort((a, b) => b.overall - a.overall);
        const baseline = current.length < 2 ? 0 : current[Math.min(current.length - 1, 1)].overall;
        const fee = p.currentTeamId ? Math.round(p.marketValue * 1.05 / 1000) * 1000 : 0;
        const salary = Math.ceil((p.contract?.salary ?? p.marketValue * .012) * 1.05 / 100) * 100;
        const development = p.age <= 22 ? Math.min(4, ((p.potential ?? p.overall) - p.overall) / 3) : 0;
        return { p, fee, salary, improvement: p.overall + development - baseline };
      }).filter(({ fee, salary, improvement }) => improvement >= 3 && fee + salary * config.salaryReserveMonths <= spendingRoom(buyer) && salary * 8 < buyer.budget - fee)
      .sort((a, b) => b.improvement - a.improvement || a.fee - b.fee || a.p.id.localeCompare(b.p.id));
    const candidate = candidates[0];
    if (!candidate) continue;
    next = executeTransfer(next, candidate.p.id, buyer.id, candidate.fee, candidate.salary, round);
    next = { ...next, news: [`Mercado: ${candidate.p.name} acertou com ${buyer.name}.`, ...next.news].slice(0, 20) };
    transfers++;
  }
  return refreshOffers(next, round);
}
export function respondToOffer(career: Career, offerId: string, accept: boolean, round: number): Career {
  requireManagedClub(career);
  const offer = career.systems.offers.find((o) => o.id === offerId);
  if (!offer || offer.status !== 'pending' || offer.season !== career.season || offer.expiresRound < round || !isWindowOpen(round)) throw new Error('Esta proposta expirou ou já foi respondida.');
  if (!accept) return { ...career, systems: { ...career.systems, offers: career.systems.offers.map((o) => o.id === offerId ? { ...o, status: 'rejected' } : o) } };
  const buyer = worldTeams(career).find((t) => t.id === offer.buyerId)!;
  const player = ownTeam(career).squad.find((p) => p.id === offer.playerId);
  if (!player || spendingRoom(buyer) < offer.amount + (player.contract?.salary ?? 1000) * config.salaryReserveMonths) throw new Error('O comprador não tem mais orçamento disponível para esta proposta.');
  const next = executeTransfer(career, player.id, buyer.id, offer.amount, player.contract?.salary ?? 1000, round);
  return { ...next, news: [`Proposta aceita: ${player.name} segue para ${buyer.name}.`, ...next.news].slice(0, 20),
    systems: { ...next.systems, offers: next.systems.offers.map((o) => o.id === offerId ? { ...o, status: 'accepted' } : o.playerId === player.id && o.status === 'pending' ? { ...o, status: 'expired' } : o) } };
}
