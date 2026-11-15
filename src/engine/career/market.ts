import type { Player, PlayerPosition, Team } from '../models';
import type { Career } from './career';
import { addFinance, isWindowOpen, seasonSeed } from './career';
import { careerConfig as config } from './config';
import { monthlyPayroll, ownTeam, replaceTeams, worldTeams, requireManagedClub } from './world';
import { formationSlots } from '../league/lineup';
import { clubProfile } from '../models/personality';
import { recordTransferStory } from './stories';

export const activeLoan = (career: Career, playerId: string) => career.systems.loans.find((l) => l.playerId === playerId && l.status === 'active');
export const rosterSize = (career: Career, teamId: string) => worldTeams(career).find((t) => t.id === teamId)!.squad.length + career.systems.loans.filter((l) => l.fromId === teamId && l.status === 'active').length;

export function signingInterest(player: Player, buyer: Team, seller?: Team) {
  const competition = buyer.squad.filter((p) => p.primaryPosition === player.primaryPosition && p.overall > player.overall).length;
  const reputationGap = Math.max(0, (seller?.reputation ?? buyer.reputation) - buyer.reputation - 15);
  const surcharge = Math.min(.5, reputationGap / 150 + (competition >= 3 ? .15 : 0));
  const salary = Math.max(100, Math.ceil((player.contract?.salary ?? player.marketValue * .012) * (1.1 + surcharge) / 100) * 100);
  const role = competition === 0 ? 'Disputa a titularidade' : competition < 3 ? 'Opção de rotação' : 'Concorrência forte pela posição';
  return { salary, role, description: `${role}. ${surcharge > 0 ? 'Pede compensação salarial por reputação ou espaço no time.' : 'Vê espaço para atuar e aceita negociar pelo salário habitual.'}` };
}

export const canSell = (team: Team, player: Player) => team.squad.length > 18 && team.squad.filter((p) => p.primaryPosition === player.primaryPosition).length > Math.max(1, formationSlots(team.defaultTactic.formation).filter((p) => p === player.primaryPosition).length);
export const spendingRoom = (team: Team) => Math.max(0, team.budget - monthlyPayroll(team) * config.salaryReserveMonths);
export function appendTransfer(career: Career, player: Player, seller: Team | undefined, buyer: Team, fee: number, round: number): Career {
  const record = { id: `transfer-${career.season}-${round}-${career.systems.transfers.length}`, playerId: player.id, playerName: player.name,
    fromId: seller?.id ?? null, fromName: seller?.name ?? 'Sem clube', toId: buyer.id, toName: buyer.name, fee, season: career.season, round };
  return recordTransferStory({ ...career, systems: { ...career.systems, transfers: [...career.systems.transfers, record] } }, player.id, player.name, record.fromName, buyer.id, buyer.name, round);
}
function executeTransfer(career: Career, playerId: string, buyerId: string, fee: number, salary: number, round: number): Career {
  const teams = worldTeams(career);
  const buyer = teams.find((t) => t.id === buyerId);
  const seller = teams.find((t) => t.squad.some((p) => p.id === playerId));
  const player = seller?.squad.find((p) => p.id === playerId) ?? career.freeAgents.find((p) => p.id === playerId);
  if (activeLoan(career, playerId)) throw new Error('Jogador emprestado não pode ser transferido antes do retorno.');
  if (!buyer || !player || buyer.id === seller?.id || rosterSize(career, buyer.id) >= 35 || spendingRoom(buyer) < fee + salary * config.salaryReserveMonths || fee < 0) throw new Error('Transferência indisponível.');
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
  const interested = worldTeams(career).filter((t) => t.id !== team.id && spendingRoom(t) > 0 && rosterSize(career, t.id) < 35).sort((a, b) => spendingRoom(b) - spendingRoom(a) || a.id.localeCompare(b.id));
  for (const buyer of interested) {
    if (offers.filter((o) => o.status === 'pending').length >= config.maxIncomingOffers) break;
    const position = needs(buyer)[0];
    const options = team.squad.filter((p) => !activeLoan(career, p.id) && canSell(team, p) && !offers.some((o) => o.playerId === p.id && o.status === 'pending'))
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
    if (rosterSize(next, buyer.id) >= 30 || spendingRoom(buyer) <= 0) continue;
    const positions = needs(buyer).slice(0, 3);
    const pool = [...next.freeAgents, ...teams.filter((t) => t.id !== buyer.id && t.id !== next.selectedTeamId).flatMap((t) => t.squad.filter((p) => canSell(t, p)))];
    const candidates = pool.filter((p) => !activeLoan(next, p.id) && positions.includes(p.primaryPosition) && !p.injury && !p.discipline.suspendedMatches)
      .map((p) => {
        const current = buyer.squad.filter((q) => q.primaryPosition === p.primaryPosition).sort((a, b) => b.overall - a.overall);
        const baseline = current.length < 2 ? 0 : current[Math.min(current.length - 1, 1)].overall;
        const fee = p.currentTeamId ? Math.round(p.marketValue * 1.05 / 1000) * 1000 : 0;
        const salary = Math.ceil((p.contract?.salary ?? p.marketValue * .012) * 1.05 / 100) * 100;
        const profile = clubProfile(buyer);
        const development = p.age <= 22 ? Math.min(profile === 'academy' ? 8 : profile === 'traditional' ? 1 : 4, ((p.potential ?? p.overall) - p.overall) / (profile === 'academy' ? 2 : 3)) : 0;
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
  if (!player || activeLoan(career, player.id) || rosterSize(career, buyer.id) >= 35 || spendingRoom(buyer) < offer.amount + (player.contract?.salary ?? 1000) * config.salaryReserveMonths) throw new Error('O comprador não tem mais orçamento disponível para esta proposta.');
  const next = executeTransfer(career, player.id, buyer.id, offer.amount, player.contract?.salary ?? 1000, round);
  return { ...next, news: [`Proposta aceita: ${player.name} segue para ${buyer.name}.`, ...next.news].slice(0, 20),
    systems: { ...next.systems, offers: next.systems.offers.map((o) => o.id === offerId ? { ...o, status: 'accepted' } : o.playerId === player.id && o.status === 'pending' ? { ...o, status: 'expired' } : o) } };
}

export function toggleWatchPlayer(career: Career, playerId: string): Career {
  const list = career.systems.watchlist;
  if (list.some((p) => p.playerId === playerId)) return { ...career, systems: { ...career.systems, watchlist: list.filter((p) => p.playerId !== playerId) } };
  const player = [...worldTeams(career).flatMap((t) => t.squad), ...career.freeAgents].find((p) => p.id === playerId);
  if (!player || player.currentTeamId === career.selectedTeamId) throw new Error('Escolha um atleta de outro clube ou sem contrato.');
  if (list.length >= 100) throw new Error('Sua lista de observação já tem 100 jogadores.');
  return { ...career, systems: { ...career.systems, watchlist: [...list, { playerId, playerName: player.name, value: player.marketValue, clubId: player.currentTeamId }] } };
}

export function counterOffer(career: Career, offerId: string, amount: number, round: number): Career {
  requireManagedClub(career);
  const offer = career.systems.offers.find((o) => o.id === offerId);
  if (!offer || offer.status !== 'pending' || offer.season !== career.season || offer.expiresRound < round || !isWindowOpen(round)) throw new Error('Esta proposta expirou ou já foi respondida.');
  if (offer.countered) throw new Error('Este clube já apresentou sua resposta final.');
  if (!Number.isSafeInteger(amount) || amount <= offer.amount || amount > 1e12) throw new Error('Peça um valor inteiro maior que a proposta atual.');
  const player = ownTeam(career).squad.find((p) => p.id === offer.playerId);
  const buyer = worldTeams(career).find((t) => t.id === offer.buyerId)!;
  if (!player || activeLoan(career, player.id)) throw new Error('Jogador indisponível.');
  const limit = Math.max(offer.amount, Math.min(Math.round(player.marketValue * 1.15 / 1000) * 1000, spendingRoom(buyer) - (player.contract?.salary ?? 1000) * config.salaryReserveMonths));
  const negotiated = { ...offer, amount: Math.min(amount, limit), countered: true };
  const note = amount <= limit ? `${buyer.name} aceitou negociar por R$ ${amount.toLocaleString('pt-BR')}. Confirme a venda quando estiver pronto.`
    : `${buyer.name} apresentou sua oferta final de R$ ${negotiated.amount.toLocaleString('pt-BR')}.`;
  return { ...career, news: [note, ...career.news].slice(0, 20), systems: { ...career.systems, offers: career.systems.offers.map((o) => o.id === offer.id ? negotiated : o) } };
}

export function loanAvailability(career: Career, player: Player): string | null {
  const seller = worldTeams(career).find((t) => t.id === player.currentTeamId);
  if (!seller || seller.id === career.selectedTeamId || !player.contract || activeLoan(career, player.id)) return 'Indisponível para empréstimo.';
  if (!canSell(seller, player)) return 'O clube precisa manter cobertura para a posição.';
  const better = seller.squad.filter((p) => p.primaryPosition === player.primaryPosition && p.overall > player.overall).length;
  if (!better) return 'O clube só empresta opções que tenham concorrência mais forte na posição.';
  return null;
}
export const loanFee = (player: Player) => Math.round(player.marketValue * .05 / 1000) * 1000;

export function borrowPlayer(career: Career, playerId: string, round: number): Career {
  requireManagedClub(career);
  if (!isWindowOpen(round)) throw new Error('Janela fechada. Negocie nas rodadas 1–4 ou 20–23.');
  const seller = worldTeams(career).find((t) => t.squad.some((p) => p.id === playerId));
  const player = seller?.squad.find((p) => p.id === playerId);
  const buyer = ownTeam(career);
  if (!player || !seller) throw new Error('Jogador indisponível.');
  const reason = loanAvailability(career, player);
  if (reason) throw new Error(reason);
  if (rosterSize(career, buyer.id) >= 35) throw new Error('Seu elenco atingiu o limite de 35 jogadores.');
  const fee = loanFee(player);
  const salary = player.contract!.salary;
  if (buyer.budget < fee + salary * 2) throw new Error('Reserve a taxa e dois salários para concluir o empréstimo.');
  let next = replaceTeams(career, [{ ...seller, squad: seller.squad.filter((p) => p.id !== player.id) }, { ...buyer, squad: [...buyer.squad, { ...player, currentTeamId: buyer.id }] }]);
  next = addFinance(next, buyer.id, round, `Taxa de empréstimo · ${player.name}`, -fee);
  next = addFinance(next, seller.id, round, `Empréstimo · ${player.name}`, fee);
  return { ...next, news: [`${player.name} chega por empréstimo até o fim da temporada. ${buyer.name} assume o salário integral.`, ...next.news].slice(0, 20),
    systems: { ...next.systems, loans: [...next.systems.loans, { id: `loan-${career.season}-${round}-${player.id}`, playerId: player.id, playerName: player.name, fromId: seller.id, toId: buyer.id, season: career.season, round, fee, contract: { ...player.contract! }, status: 'active' }] } };
}

/** Devolve o atleta antes de envelhecer e renovar os elencos da próxima temporada. */
export function returnLoans(career: Career): Career {
  let next = career;
  for (const loan of career.systems.loans.filter((l) => l.status === 'active')) {
    const teams = worldTeams(next);
    const borrower = teams.find((t) => t.id === loan.toId)!;
    const owner = teams.find((t) => t.id === loan.fromId)!;
    const player = borrower.squad.find((p) => p.id === loan.playerId);
    if (!player) throw new Error('Empréstimo inconsistente: atleta ausente.');
    next = replaceTeams(next, [{ ...borrower, squad: borrower.squad.filter((p) => p.id !== player.id) }, { ...owner, squad: [...owner.squad, { ...player, currentTeamId: owner.id, contract: { ...loan.contract } }] }]);
  }
  return { ...next, lineup: null, systems: { ...next.systems, loans: next.systems.loans.map((l) => l.status === 'active' ? { ...l, status: 'returned' } : l) } };
}
