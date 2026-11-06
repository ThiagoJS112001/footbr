import type { League, Lineup, Player, Team } from '../models';
import type { CareerSource } from '../../data/catalog';
import { generateLeague } from '../generators/league';
import { generateTeam } from '../generators/team';
import { calculateOverall } from '../generators/player';
import { createRng, randomInt } from '../generators/random';
import { calculateStandings, generateSchedule, getTopScorers, formationSlots } from '../league';
import type { CareerSystems } from './types';
import { createSystems } from './bootstrap';
import { careerConfig as config } from './config';
import { replaceTeams, requireManagedClub } from './world';
import { appendTransfer, canSell, spendingRoom } from './market';
import { archiveSeason } from './history';
import { createAcademy } from './academy';
import { createBoard } from './board';
import { createCup } from './cup';

export interface FinanceEntry {
  teamId?: string;
  season: number;
  round: number;
  description: string;
  amount: number;
  balance: number;
}
export interface SeasonSummary {
  teamId?: string;
  teamName?: string;
  cupChampion?: string;
  season: number;
  division: number;
  position: number;
  points: number;
  champion: string;
  topScorer: string;
  promoted: string[];
  relegated: string[];
}
export interface Career {
  source?: CareerSource;
  systems: CareerSystems;
  league: League;
  otherLeague: League;
  selectedTeamId: string | null;
  seed: number;
  season: number;
  lineup: Lineup | null;
  finances: FinanceEntry[];
  history: SeasonSummary[];
  freeAgents: Player[];
  news: string[];
}

export const seasonSeed = (career: Pick<Career, 'seed' | 'season'>) => (career.seed ^ Math.imul(career.season - 1, 0x9e3779b9)) >>> 0;
export const isWindowOpen = (round: number) => round <= 4 || (round >= 20 && round <= 23);
export const payroll = (team: Team) => team.squad.reduce((sum, p) => sum + (p.contract?.salary ?? 0), 0);
export const playerValue = (player: Player) => Math.round(10000 * (player.overall / 10) ** 3
  * (player.age <= 23 ? 1.3 : Math.max(0.3, 1.15 - (player.age - 24) * 0.07)) / 1000) * 1000;
export const askingPrice = (player: Player) => Math.round(player.marketValue * 1.15 / 1000) * 1000;

function prepareLeague(base: League, teams: Team[], division: number, seed: number): League {
  const league: League = {
    ...base, id: `${base.id.replace(/-division-[12]/g, '')}-division-${division}`, name: `Liga dos Horizontes · Divisão ${division}`,
    teams: teams.map((team) => ({ ...team, division })),
    schedule: generateSchedule(teams.map((t) => t.id)), standings: [],
    rules: { promotionSpots: division === 2 ? 4 : 0, qualificationSpots: division === 2 ? 4 : 0, relegationSpots: division === 1 ? 4 : 0 },
  };
  league.standings = calculateStandings(league, seed);
  return league;
}

export function createCareer(seed: number): Career {
  const world = generateLeague(seed, 40);
  world.teams = world.teams.map((team) => ({ ...team, budget: Math.round(team.payroll * (config.initialCashMonths + team.reputation * config.initialCashReputationFactor)), squad: team.squad.map((p) => ({ ...p, potential: Math.max(p.overall, Math.min(94, p.overall + (p.age <= 23 ? 12 : p.age <= 27 ? 5 : 0))) })) }));
  const top = world.teams.filter((_, index) => index % 2 === 1);
  const bottom = world.teams.filter((_, index) => index % 2 === 0);
  const free = generateTeam((seed ^ 0xf4ee) >>> 0, 30).squad.map((p, i) => ({ ...p, id: `free-${seed}-${i}`, currentTeamId: null, contract: null, potential: Math.max(p.overall, Math.min(90, p.overall + (p.age < 24 ? 14 : 3))) }));
  const base = {
    league: prepareLeague(world, top, 1, seed), otherLeague: prepareLeague(world, bottom, 2, seed),
    selectedTeamId: null, seed, season: 1, lineup: null, finances: [], history: [], freeAgents: free, news: [],
  };
  return { ...base, systems: createSystems(base) };
}

const changeTeams = replaceTeams;

export function addFinance(career: Career, teamId: string, round: number, description: string, amount: number): Career {
  const team = [...career.league.teams, ...career.otherLeague.teams].find((t) => t.id === teamId)!;
  const balance = team.budget + amount;
  const next = changeTeams(career, [{ ...team, budget: balance }]);
  if (teamId === career.selectedTeamId) next.finances = [...career.finances, { teamId, season: career.season, round, description, amount, balance }];
  return next;
}

/** Receitas e despesas aplicadas uma única vez, ao confirmar uma rodada completa. */
export function settleRound(career: Career, round: number): Career {
  let next = career;
  for (const league of [career.league, career.otherLeague]) {
    for (const team of league.teams) {
      const match = league.schedule.find((r) => r.round === round)?.matches.find((m) => m.homeTeamId === team.id);
      const position = league.standings.find((r) => r.teamId === team.id)!.position;
      const attendance = Math.round(team.stadium.capacity * Math.max(.35, Math.min(.95, .45 + team.reputation / 200 + (10 - position) * .008)));
      if (match && !match.forfeitTeamIds?.length) next = addFinance(next, team.id, round, `Bilheteria líquida · ${attendance.toLocaleString('pt-BR')} torcedores`, Math.round(attendance * team.stadium.ticketPrice * config.netGateShare));
      next = addFinance(next, team.id, round, 'Patrocínio semanal', Math.round(config.sponsorBase + team.reputation * config.sponsorPerReputation));
      next = addFinance(next, team.id, round, 'Salários · 1/4 da folha mensal', -Math.round(payroll(team) / 4));
      next = addFinance(next, team.id, round, 'Manutenção do estádio', -Math.round(team.stadium.capacity * config.stadiumCostPerSeat));
      if (team.budget < 0) next = addFinance(next, team.id, round, 'Juros da dívida · 1%', -Math.ceil(Math.abs(team.budget) * config.weeklyDebtInterest));
      if (round === league.schedule.length) {
        next = addFinance(next, team.id, round, `Premiação · ${position}º lugar`, Math.round((league.teams.length - position + 1) * 150000 / team.division));
      }
    }
  }
  return next;
}

/** Proposta e contrato são validados juntos; nenhuma movimentação parcial de dinheiro. */
export function buyPlayer(career: Career, playerId: string, offer: number, salary: number, years: number, round: number): Career {
  requireManagedClub(career);
  if (!isWindowOpen(round)) throw new Error('Janela fechada. Negocie nas rodadas 1–4 ou 20–23.');
  if (![offer, salary, years].every(Number.isSafeInteger) || offer < 0 || offer > 1e12 || salary < 100 || salary > 1e10 || years < 1 || years > 5) throw new Error('Informe valores válidos e contrato de 1 a 5 anos.');
  const teams = [...career.league.teams, ...career.otherLeague.teams];
  const buyer = teams.find((t) => t.id === career.selectedTeamId)!;
  const seller = teams.find((t) => t.squad.some((p) => p.id === playerId));
  const player = seller?.squad.find((p) => p.id === playerId) ?? career.freeAgents.find((p) => p.id === playerId);
  if (!player || seller?.id === buyer.id) throw new Error('Jogador indisponível para compra.');
  if (buyer.squad.length >= 35) throw new Error('Seu elenco atingiu o limite de 35 jogadores.');
  if (buyer.budget < offer || buyer.budget < 0) throw new Error('Saldo insuficiente para contratar. Venda jogadores para equilibrar as contas.');
  if (seller && !canSell(seller, player)) throw new Error('O clube não aceita perder a cobertura necessária para essa formação.');
  const ask = seller ? askingPrice(player) : 0;
  if (offer < ask) throw new Error(`Contraproposta do clube: R$ ${ask.toLocaleString('pt-BR')}.`);
  const wantedSalary = Math.ceil((player.contract?.salary ?? player.marketValue * 0.012) * 1.1 / 100) * 100;
  if (salary < wantedSalary) throw new Error(`O jogador pede salário de R$ ${wantedSalary.toLocaleString('pt-BR')} por mês.`);
  const signed = { ...player, currentTeamId: buyer.id, contract: { salary, yearsRemaining: years } };
  let next = changeTeams(career, [
    { ...buyer, squad: [...buyer.squad, signed] },
    ...(seller ? [{ ...seller, squad: seller.squad.filter((p) => p.id !== playerId) }] : []),
  ]);
  next = addFinance(next, buyer.id, round, `Compra · ${player.name}`, -offer);
  if (seller) next = addFinance(next, seller.id, round, `Venda · ${player.name}`, offer);
  next = appendTransfer(next, player, seller, buyer, offer, round);
  return { ...next, freeAgents: next.freeAgents.filter((p) => p.id !== playerId), news: [`${player.name} contratado por ${buyer.name}.`, ...next.news].slice(0, 20) };
}

export function sellPlayer(career: Career, playerId: string, round: number): Career {
  requireManagedClub(career);
  if (!isWindowOpen(round)) throw new Error('Janela fechada. Negocie nas rodadas 1–4 ou 20–23.');
  const seller = career.league.teams.find((t) => t.id === career.selectedTeamId)!;
  const player = seller.squad.find((p) => p.id === playerId);
  if (!player) throw new Error('Jogador fora do seu elenco.');
  if (!canSell(seller, player)) throw new Error('Mantenha pelo menos 18 jogadores e cobertura para sua formação.');
  const price = Math.round(player.marketValue * 0.85 / 1000) * 1000;
  const buyer = [...career.league.teams, ...career.otherLeague.teams]
    .filter((t) => t.id !== seller.id && spendingRoom(t) >= price + (player.contract?.salary ?? 1000) * config.salaryReserveMonths && t.squad.length < 35)
    .sort((a, b) => a.squad.filter((p) => p.primaryPosition === player.primaryPosition).length - b.squad.filter((p) => p.primaryPosition === player.primaryPosition).length || b.budget - a.budget)[0];
  if (!buyer) throw new Error('Nenhum clube tem orçamento para essa compra agora.');
  let next = changeTeams(career, [
    { ...seller, squad: seller.squad.filter((p) => p.id !== playerId) },
    { ...buyer, squad: [...buyer.squad, { ...player, currentTeamId: buyer.id }] },
  ]);
  next = addFinance(next, seller.id, round, `Venda · ${player.name}`, price);
  next = addFinance(next, buyer.id, round, `Compra · ${player.name}`, -price);
  next = appendTransfer(next, player, seller, buyer, price, round);
  return { ...next, lineup: null, news: [`${player.name} vendido para ${buyer.name}.`, ...next.news].slice(0, 20) };
}

export function renewContract(career: Career, playerId: string, round: number): Career {
  requireManagedClub(career);
  const team = career.league.teams.find((t) => t.id === career.selectedTeamId)!;
  const player = team.squad.find((p) => p.id === playerId);
  if (!player?.contract) throw new Error('Contrato indisponível.');
  if (team.budget < 0) throw new Error('Equilibre o saldo antes de renovar contratos.');
  if (player.contract.yearsRemaining >= 3) throw new Error('O contrato já tem três anos ou mais.');
  const salary = Math.ceil(player.contract.salary * 1.1 / 100) * 100;
  if (team.budget < salary) throw new Error('Saldo insuficiente para pagar as luvas da renovação.');
  let next = changeTeams(career, [{ ...team, squad: team.squad.map((p) => p.id === playerId ? { ...p, contract: { salary, yearsRemaining: 3 } } : p) }]);
  next = addFinance(next, team.id, round, `Luvas de renovação · ${player.name}`, -salary);
  return { ...next, news: [`${player.name} renovou por três anos.`, ...next.news].slice(0, 20) };
}

export function nextSeason(career: Career): Career {
  if ([career.league, career.otherLeague].some((l) => l.schedule.some((r) => r.matches.some((m) => m.status !== 'finished')))) throw new Error('Conclua a temporada antes de continuar.');
  if (career.systems.board.status === 'dismissed') throw new Error('Aceite um novo emprego para continuar sua carreira.');
  if (career.systems.cup.status === 'active' && !career.systems.cup.championId) throw new Error('Conclua a copa antes de começar a próxima temporada.');
  career = archiveSeason(career);
  const first = career.league.teams[0].division === 1 ? career.league : career.otherLeague;
  const second = first === career.league ? career.otherLeague : career.league;
  const relegatedIds = first.standings.slice(-4).map((r) => r.teamId);
  const promotedIds = second.standings.slice(0, 4).map((r) => r.teamId);
  const allTeams = [...first.teams, ...second.teams];
  const names = (ids: string[]) => ids.map((id) => allTeams.find((t) => t.id === id)!.name);
  const row = career.league.standings.find((r) => r.teamId === career.selectedTeamId)!;
  const top = getTopScorers(career.league)[0];
  const summary: SeasonSummary = { teamId: career.selectedTeamId!, teamName: career.league.teams.find((t) => t.id === career.selectedTeamId)!.name,
    cupChampion: allTeams.find((t) => t.id === career.systems.cup.championId)?.name ?? 'Não disputada', season: career.season, division: career.league.teams[0].division, position: row.position, points: row.points,
    champion: career.league.teams.find((t) => t.id === career.league.standings[0].teamId)!.name,
    topScorer: top ? `${top.playerName} · ${top.goals} gols` : 'Sem gols', promoted: names(promotedIds), relegated: names(relegatedIds) };
  const seed = seasonSeed({ ...career, season: career.season + 1 });
  const rng = createRng(seed);
  const released: Player[] = [];
  const news: string[] = [];
  const updated = allTeams.map((team) => {
    const squad = team.squad.flatMap((player): Player[] => {
      if (player.age >= 37) { if (team.id === career.selectedTeamId) news.push(`${player.name} se aposentou.`); return []; }
      const played = career.systems.playerHistory.filter((r) => r.season === career.season && r.playerId === player.id).reduce((s, r) => s + r.minutes, 0);
      const potential = player.potential ?? Math.max(player.overall, Math.min(94, player.overall + (player.age < 24 ? 12 : 3)));
      const gain = player.age < 24 ? randomInt(rng, 0, played >= 900 ? 3 : 1) : player.age >= 30 ? -randomInt(rng, 1, 2) : randomInt(rng, -1, 1);
      const change = Math.min(gain, Math.max(0, potential - player.overall));
      const attributes = Object.fromEntries(Object.entries(player.attributes).map(([key, value]) => [key, Math.max(1, Math.min(99, value + change))])) as unknown as Player['attributes'];
      const evolved = { ...player, potential, age: player.age + 1, attributes, overall: calculateOverall(attributes, player.primaryPosition), fitness: 100, morale: 75, injury: null, discipline: { yellowCards: 0, suspendedMatches: 0 } };
      evolved.marketValue = playerValue(evolved);
      const remaining = (player.contract?.yearsRemaining ?? 1) - 1;
      if (remaining <= 0 && team.id === career.selectedTeamId) {
        released.push({ ...evolved, currentTeamId: null, contract: null });
        news.push(`${player.name} saiu ao fim do contrato.`);
        return [];
      }
      return [{ ...evolved, contract: { salary: player.contract?.salary ?? 10000, yearsRemaining: remaining > 0 ? remaining : 3 } }];
    });
    // Reposição emergencial preserva posições e 18 atletas; promoções especiais são escolhas do técnico.
    const academy = generateTeam(randomInt(rng, 0, 0xffff_ffff), Math.max(5, team.reputation - 25));
    const desired = new Map(academy.squad.map((p) => [p.primaryPosition, academy.squad.filter((q) => q.primaryPosition === p.primaryPosition).length]));
    const required = formationSlots(team.defaultTactic.formation);
    let youthIndex = 0;
    for (const [position, defaultCount] of desired) {
      const count = team.id === career.selectedTeamId ? Math.min(defaultCount, Math.max(1, required.filter((slot) => slot === position).length)) : defaultCount;
      while (squad.filter((p) => p.primaryPosition === position).length < count) {
        const options = academy.squad.filter((p) => p.primaryPosition === position);
        const youth = options[squad.filter((p) => p.primaryPosition === position).length % options.length];
        squad.push({ ...youth, id: `${team.id}-youth-${career.season + 1}-${++youthIndex}`, age: 18, currentTeamId: team.id, contract: { salary: Math.round(youth.contract!.salary * 0.6), yearsRemaining: 3 } });
      }
    }
    while (squad.length < 18) {
      const youth = academy.squad[youthIndex % academy.squad.length];
      squad.push({ ...youth, id: `${team.id}-youth-${career.season + 1}-${++youthIndex}`, age: 18, currentTeamId: team.id, potential: Math.min(90, youth.overall + 8), contract: { salary: Math.round(youth.contract!.salary * .6), yearsRemaining: 3 } });
    }
    return { ...team, squad, payroll: payroll({ ...team, squad }), reputation: Math.max(1, Math.min(99, team.reputation + (team.id === career.selectedTeamId ? row.position <= 4 ? 3 : row.position > 16 ? -3 : 0 : 0))) };
  });
  const topTeams = updated.filter((t) => (t.division === 1 && !relegatedIds.includes(t.id)) || promotedIds.includes(t.id));
  const bottomTeams = updated.filter((t) => !topTeams.includes(t));
  const leagues = [prepareLeague(first, topTeams, 1, seed), prepareLeague(second, bottomTeams, 2, seed)];
  const own = leagues.find((l) => l.teams.some((t) => t.id === career.selectedTeamId))!;
  const ownClub = own.teams.find((t) => t.id === career.selectedTeamId)!;
  const newcomers = generateTeam(randomInt(rng, 0, 0xffff_ffff), 25).squad.slice(0, 10).map((p, i) => ({ ...p, id: `free-${seed}-season-${career.season + 1}-${i}`, currentTeamId: null, contract: null }));
  const remainingFree = career.freeAgents.filter((p) => p.age < 36).map((p) => ({ ...p, age: p.age + 1, fitness: 100, injury: null, discipline: { yellowCards: 0, suspendedMatches: 0 } }));
  return { ...career, league: own, otherLeague: leagues.find((l) => l !== own)!, season: career.season + 1, lineup: null,
    finances: [...career.finances, { teamId: ownClub.id, season: career.season + 1, round: 0, description: 'Saldo inicial da temporada', amount: 0, balance: ownClub.budget }],
    history: [...career.history, summary], freeAgents: [...remainingFree, ...released, ...newcomers], news: [`Temporada ${career.season + 1}: elenco atualizado e calendário pronto.`, ...news].slice(0, 20),
    systems: { ...career.systems, lastSummary: null, marketRound: 0, offers: career.systems.offers.map((o) => o.status === 'pending' ? { ...o, status: 'expired' } : o),
      academy: createAcademy(ownClub, seed, career.season + 1), board: createBoard(ownClub, own), cup: createCup([...topTeams, ...bottomTeams], seed, career.season + 1) } };
}
