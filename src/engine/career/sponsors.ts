import type { Team } from '../models';
import { clubProfile } from '../models/personality';
import { addFinance, type Career } from './career';
import { careerConfig } from './config';
import type { SponsorContract, SponsorId } from './types';
import { ownTeam, requireManagedClub, worldLeagues, worldTeams } from './world';
import { allCups } from './cup';
import { recentClubMatches } from './history';
import type { SponsorAwardKind } from './awardTypes';

export const sponsorBrands = {
  raiz: { name: 'Rede Raiz', profile: 'Conservador', years: 1, multiplier: .92, bonus: 0 },
  vertice: { name: 'Vértice Energia', profile: 'Equilibrado', years: 2, multiplier: 1.03, bonus: .10 },
  pulso: { name: 'Pulso Urbano', profile: 'Alto investimento', years: 3, multiplier: 1.15, bonus: .17 },
} as const;

const awardTerms: Record<SponsorId, { kind: SponsorAwardKind; rate: number }[]> = {
  raiz: [],
  vertice: [{ kind: 'title', rate: .025 }, { kind: 'golden-boot', rate: .015 }],
  pulso: [{ kind: 'title', rate: .035 }, { kind: 'golden-ball', rate: .025 },
    { kind: 'coach', rate: .02 }, { kind: 'breakthrough', rate: .02 }],
};

const baseWeekly = (team: Team) => careerConfig.sponsorBase + team.reputation * careerConfig.sponsorPerReputation;
export const activeSponsor = (career: Career, teamId: string) =>
  career.systems.sponsors?.find((contract) => contract.teamId === teamId && contract.start <= career.season && contract.end >= career.season);

export const seasonSponsorMessage = 'Assine um contrato de patrocínio em Finanças antes de jogar a primeira partida da temporada.';

export function needsSeasonSponsor(career: Career): boolean {
  const id = career.selectedTeamId;
  return !!id && career.systems.board.status === 'active' && !activeSponsor(career, id)
    && recentClubMatches(career).length === 0;
}

export function sponsorshipOffers(career: Career, team: Team): SponsorContract[] {
  const previous = career.systems.clubHistory.find((row) => row.season === career.season - 1 && row.teamId === team.id);
  const progress = previous ? (previous.division - team.division) * .07 + Number(previous.leagueTitle) * .07
    + Number(previous.cupTitle) * .05 + (previous.position <= 5 ? .035 : previous.position >= 16 ? -.055 : 0) : 0;
  const budgetFactor = team.budget < 0 ? .91 : 1;
  const base = baseWeekly(team) * career.league.schedule.length * (1.04 - (team.division - 1) * .035) * (1 + progress) * budgetFactor;
  const target = 1 + worldLeagues(career).find((league) => league.teams.some((club) => club.id === team.id))!.teams.filter((club) => club.reputation > team.reputation).length;
  return (Object.keys(sponsorBrands) as SponsorId[]).map((sponsorId) => {
    const brand = sponsorBrands[sponsorId];
    return { teamId: team.id, sponsorId, annual: Math.round(base * brand.multiplier / 1000) * 1000,
      start: career.season, end: career.season + brand.years - 1, awardBonuses: awardTerms[sponsorId],
      target: sponsorId === 'raiz' ? null : Math.max(3, Math.min(16, target + (sponsorId === 'vertice' ? 3 : -2))) };
  });
}

export const sponsorWeekly = (career: Career, team: Team, round?: number): number => {
  const contract = activeSponsor(career, team.id);
  if (!contract) return baseWeekly(team);
  const weekly = contract.annual / career.league.schedule.length;
  return round ? Math.round(weekly * round) - Math.round(weekly * (round - 1)) : Math.round(weekly);
};

function saveContract(career: Career, contract: SponsorContract): Career {
  return { ...career, systems: { ...career.systems, sponsors: [...(career.systems.sponsors ?? []).filter((item) => item.teamId !== contract.teamId), contract] } };
}

export function signSponsor(career: Career, id: SponsorId, breakContract = false): Career {
  requireManagedClub(career);
  const team = ownTeam(career);
  const current = activeSponsor(career, team.id);
  if (career.systems.sponsors?.some((item) => item.teamId === team.id && item.start > career.season)) throw new Error('Já há um patrocínio agendado.');
  if (current && !breakContract || !current && breakContract) throw new Error('Confira a vigência do contrato.');
  const offer = sponsorshipOffers(career, team).find((item) => item.sponsorId === id);
  if (!offer || current?.sponsorId === id) throw new Error('Escolha uma proposta disponível.');
  const round = career.league.schedule.filter((r) => r.matches.every((m) => m.status === 'finished')).length;
  if (!current && round > 0) {
    offer.start = career.season + 1;
    offer.end++;
  }
  let next = career;
  if (current) {
    const fee = sponsorBreakFee(current);
    if (team.budget < fee) throw new Error('Saldo insuficiente para a multa de rescisão.');
    next = addFinance(career, team.id, round, 'Rescisão de patrocínio', -fee);
    next = sponsorConfidence(next, clubProfile(team) === 'community' ? -6 : -4);
  }
  return saveContract(next, offer);
}
export const sponsorBreakFee = (contract: SponsorContract) => Math.round(contract.annual * .12);

export function prepareAiSponsors(career: Career): Career {
  const retained = new Map((career.systems.sponsors ?? []).map((entry) => [entry.teamId, entry]));
  for (const team of worldTeams(career)) {
    if (team.id === career.selectedTeamId && career.systems.board.status === 'active' || activeSponsor(career, team.id)) continue;
    const offers = sponsorshipOffers(career, team);
    retained.set(team.id, team.budget < 0 || clubProfile(team) === 'community' ? offers[0]
      : clubProfile(team) === 'traditional' && team.reputation >= 72 ? offers[2] : offers[1]);
  }
  return { ...career, systems: { ...career.systems, sponsors: [...retained.values()] } };
}

function sponsorConfidence(career: Career, change: number): Career {
  return { ...career, systems: { ...career.systems, board: { ...career.systems.board, confidence: Math.max(0, Math.min(100, career.systems.board.confidence + change)) } } };
}

export function settleSponsors(career: Career): Career {
  let next = career;
  const cups = allCups(career);
  for (const league of worldLeagues(career)) for (const row of league.standings) {
    const sponsor = activeSponsor(career, row.teamId);
    if (!sponsor || sponsor.target === null) continue;
    const titles = cups.filter((cup) => cup.championId === row.teamId).length + Number(row.position === 1);
    if (row.position <= sponsor.target || titles) next = addFinance(next, row.teamId, league.schedule.length,
      `Bônus do patrocinador · ${sponsorBrands[sponsor.sponsorId].name}`, Math.round(sponsor.annual * sponsorBrands[sponsor.sponsorId].bonus));
    else if (row.teamId === career.selectedTeamId && career.systems.board.status === 'active' && sponsor.sponsorId === 'pulso') {
      next = sponsorConfidence(next, clubProfile(ownTeam(career)) === 'community' ? -6 : -3);
      next = { ...next, news: ['A meta do patrocinador ficou abaixo do esperado e reduziu a confiança da diretoria.', ...next.news].slice(0, 20) };
    }
  }
  return next;
}
