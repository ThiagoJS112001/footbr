import type { Player } from '../models';
import { addFinance, type Career } from './career';
import { activeLoan } from './market';
import { clubSeasonRatings } from './ratings';
import type { RenewalNegotiation, RenewalTerms } from './types';
import { completedRounds, ownTeam, replaceTeams, requireManagedClub } from './world';

export const maxRenewalAttempts = 3;
const waitWeeks = 2;
const roundUpSalary = (value: number) => Math.ceil(value / 100) * 100;

export function renewalDemand(player: Player, average?: number): RenewalTerms {
  const quality = Math.max(0, player.overall - 45) / 100;
  const form = Math.max(0, (average ?? 6) - 6) * .14;
  const age = Math.max(0, player.age - 32);
  const salary = Math.max(100, Math.min(1e10, roundUpSalary(player.contract!.salary * Math.max(.7, 1 + quality + form - age * .065))));
  return {
    years: age >= 4 ? 1 : age > 0 ? 2 : player.overall >= 78 || (average ?? 0) >= 7.3 ? 3 : 2,
    salary,
    bonus: roundUpSalary(salary * Math.max(.35, 1 + quality * 2 + form * 2 - age * .18)),
  };
}

export function renewalStatus(career: Career, playerId: string): RenewalNegotiation | undefined {
  return career.systems.renewals?.find((item) => item.teamId === career.selectedTeamId && item.playerId === playerId
    && (item.status === 'counter' || item.availableAfterRound > completedRounds(career)));
}

function updateNegotiation(career: Career, playerId: string, update?: RenewalNegotiation): Career {
  const records = (career.systems.renewals ?? []).filter((item) => item.teamId !== career.selectedTeamId || item.playerId !== playerId);
  return { ...career, systems: { ...career.systems, renewals: update ? [...records, update] : records } };
}

export function negotiateRenewal(career: Career, playerId: string, terms: RenewalTerms | null): { career: Career; message: string } {
  requireManagedClub(career);
  const team = ownTeam(career);
  const player = team.squad.find((p) => p.id === playerId);
  if (!player?.contract) throw new Error('Contrato indisponível.');
  if (activeLoan(career, playerId)) throw new Error('O contrato pertence ao clube que cedeu o jogador.');
  if (player.contract.yearsRemaining !== 1) throw new Error('Somente contratos com um ano restante podem ser negociados.');
  const status = renewalStatus(career, playerId);
  if (status?.status === 'blocked') throw new Error('Aguarde duas semanas de liga após a recusa para voltar a negociar.');

  const identity = { teamId: team.id, playerId };
  const block = (message: string) => ({
    career: updateNegotiation(career, playerId, { ...identity, status: 'blocked', availableAfterRound: completedRounds(career) + waitWeeks }),
    message: `${message} A negociação pode ser retomada em duas semanas de liga.`,
  });
  if (!terms) {
    if (status?.status !== 'counter') throw new Error('Não há contraproposta para recusar.');
    return block(`A contraproposta de ${player.name} foi recusada.`);
  }
  if (!Number.isInteger(terms.years) || terms.years < 1 || terms.years > 4
    || !Number.isInteger(terms.salary) || terms.salary < 100 || terms.salary > 1e10
    || !Number.isInteger(terms.bonus) || terms.bonus < 0 || terms.bonus > 1e12) throw new Error('Confira a duração, o salário e as luvas da proposta.');
  if (team.budget < terms.bonus) throw new Error('Saldo insuficiente para pagar as luvas.');

  const demand = status?.demand ?? renewalDemand(player, clubSeasonRatings(career, team.id).get(playerId));
  const meetsDemand = terms.years >= demand.years && terms.salary >= demand.salary && terms.bonus >= demand.bonus;
  const makesTradeoff = status?.status === 'counter' && terms.salary >= demand.salary * .92
    && terms.bonus >= demand.bonus * .65 && terms.years >= demand.years - 1
    && .55 * Math.min(1.3, terms.salary / demand.salary) + .25 * Math.min(1.5, terms.bonus / demand.bonus)
      + .2 * Math.min(1.5, terms.years / demand.years) >= 1;
  if (meetsDemand || makesTradeoff) {
    const squad = team.squad.map((p) => p.id === playerId ? { ...p, contract: { salary: terms.salary, yearsRemaining: terms.years + 1 } } : p);
    const updated = replaceTeams(career, [{ ...team, squad }]);
    const paid = addFinance(updated, team.id, Math.min(completedRounds(career) + 1, career.league.schedule.length), `Luvas de renovação · ${player.name}`, -terms.bonus);
    const next = updateNegotiation(paid, playerId);
    const message = `${player.name} aceitou renovar por mais ${terms.years} ano(s).`;
    return { career: { ...next, news: [message, ...next.news].slice(0, 20) }, message };
  }
  const attempts = (status?.attempts ?? 0) + 1;
  if (attempts >= maxRenewalAttempts || terms.salary < demand.salary * .65) return block(`${player.name} recusou a proposta.`);
  return {
    career: updateNegotiation(career, playerId, { ...identity, status: 'counter', attempts, demand }),
    message: `${player.name} apresentou uma contraproposta.`,
  };
}
