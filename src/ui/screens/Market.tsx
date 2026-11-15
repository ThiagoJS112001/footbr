import type { Player, PlayerPosition, Team } from '../../engine/models';
import { askingPrice, isWindowOpen } from '../../engine/career/career';
import { careerOf, useGameStore } from '../store/gameStore';
import { useUiStore } from '../store/uiStore';
import { Panel } from '../components/Panel';
import { PageHeader } from '../components/PageHeader';
import { DataTable } from '../components/DataTable';
import { currency, positionLabels } from '../utils';
import styles from '../App.module.css';
import { useEffect, useRef, useState } from 'react';
import type { TransferOffer } from '../../engine/career/types';
import { activeLoan, loanAvailability, loanFee, signingInterest } from '../../engine/career/market';
import { PlayerTraitBadge } from '../components/PlayerTraitBadge';

function OfferCounter({ offer, open }: { offer: TransferOffer; open: boolean }) {
  const counter = useGameStore((s) => s.counter);
  const [amount, setAmount] = useState(offer.amount + Math.max(1000, Math.round(offer.amount * .1 / 1000) * 1000));
  return offer.countered ? <small>Resposta final do comprador</small> : <form className={styles.inlineActions} onSubmit={(e) => { e.preventDefault(); counter(offer.id, amount); }}><label className={styles.filterLabel}>Contraproposta por {offer.playerName} (R$)<input type="number" min={offer.amount + 1} max={1e12} step={1} value={amount} onChange={(e) => setAmount(Number(e.target.value))} required /></label><button className={styles.secondaryButton} disabled={!open}>Negociar valor</button></form>;
}

export function Market({ team }: { team: Team }) {
  const state = useGameStore();
  const { league, otherLeague, freeAgents, currentRound, buy, sell, systems, respondOffer, navigate } = state;
  const career = careerOf(state);
  const clubs = [...league!.teams, ...otherLeague!.teams];
  const allPlayers = [...clubs.flatMap((t) => t.squad), ...freeAgents];
  const deal = useUiStore((s) => s.marketDealType);
  const negotiationRef = useRef<HTMLElement>(null);
  const { marketPosition: position, marketSearch: search, marketSource: source, marketSelected: selected, marketOffer: offer, marketSalary: salary, marketYears: years } = useUiStore();
  const setPosition = (value: PlayerPosition | 'all') => useUiStore.setState({ marketPosition: value });
  const setSearch = (value: string) => useUiStore.setState({ marketSearch: value });
  const setSource = (value: string) => useUiStore.setState({ marketSource: value });
  const setSelected = (value: string | null) => useUiStore.setState({ marketSelected: value });
  const setOffer = (value: number) => useUiStore.setState({ marketOffer: value });
  const setSalary = (value: number) => useUiStore.setState({ marketSalary: value });
  const setYears = (value: number) => useUiStore.setState({ marketYears: value });
  useEffect(() => {
    if (!selected) return;
    negotiationRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    negotiationRef.current?.focus({ preventScroll: true });
  }, [selected]);
  const open = isWindowOpen(currentRound);
  const candidates = source === 'own' ? team.squad : source === 'free' ? freeAgents : source === 'watch' ? allPlayers.filter((p) => systems.watchlist.some((w) => w.playerId === p.id)) : source === 'loans' ? allPlayers.filter((p) => loanAvailability(career, p) === null) : clubs.filter((t) => t.id !== team.id).flatMap((t) => t.squad);
  const rows = candidates.filter((p) => (position === 'all' || p.primaryPosition === position) && p.name.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));
  const player = candidates.find((p) => p.id === selected);
  const choose = (p: Player) => { setSelected(p.id); setOffer(p.currentTeamId ? askingPrice(p) : 0); setSalary(signingInterest(p, team, clubs.find((t) => t.id === p.currentTeamId)).salary); useUiStore.setState({ marketDealType: source === 'loans' ? 'loan' : 'buy' }); };
  const ownPlayer = player?.currentTeamId === team.id;
  const onLoan = player ? activeLoan(career, player.id) : null;
  const loanReason = player ? loanAvailability(career, player) : 'Selecione um jogador.';
  const fee = player ? deal === 'loan' ? loanFee(player) : offer : 0;
  const wage = player && deal === 'loan' ? player.contract?.salary ?? 0 : salary;
  const contractWeeks = league!.schedule.length - currentRound + 1 + (deal === 'buy' ? (years - 1) * league!.schedule.length : 0);
  const interest = player ? signingInterest(player, team, clubs.find((t) => t.id === player.currentTeamId)) : null;
  const watchAlerts = systems.watchlist.flatMap((w) => {
    const p = allPlayers.find((p) => p.id === w.playerId);
    if (!p) return [{ id: w.playerId, text: `${w.playerName} não está mais disponível nesta carreira.` }];
    const changes = [p.marketValue !== w.value ? `valor ${currency(w.value)} → ${currency(p.marketValue)}` : '', p.currentTeamId !== w.clubId ? `agora ${p.currentTeamId ? `no ${clubs.find((t) => t.id === p.currentTeamId)?.name}` : 'sem clube'}` : ''].filter(Boolean);
    return changes.length ? [{ id: w.playerId, text: `${p.name}: ${changes.join(' · ')}.` }] : [];
  });
  return <>
    <PageHeader eyebrow="MONTE SEU ELENCO" title="Mercado" description={`Saldo: ${currency(team.budget)} · Janela ${open ? 'aberta' : 'fechada'} · Rodadas 1–4 e 20–23`} />
    <Panel title="Propostas recebidas" icon="market"><ul className={styles.compactList}>{systems.offers.filter((o) => o.status === 'pending').map((offer) => {
      const buyer = [...league!.teams, ...otherLeague!.teams].find((t) => t.id === offer.buyerId)!;
      return <li key={offer.id} className={styles.offerRow}><span><strong>{offer.playerName} → {buyer.name}</strong><small>{currency(offer.amount)} · válida até antes do jogo da rodada {offer.expiresRound}</small></span><div className={styles.offerActions}><div className={styles.inlineActions}><button className={styles.primaryButton} disabled={!open} onClick={() => respondOffer(offer.id, true)}>Aceitar proposta por {offer.playerName}</button><button className={styles.secondaryButton} onClick={() => respondOffer(offer.id, false)}>Recusar</button></div><OfferCounter offer={offer} open={open} /></div></li>;
    })}{!systems.offers.some((o) => o.status === 'pending') && <li className={styles.muted}>Nenhuma proposta pendente. A IA busca reforços durante as janelas e preserva uma reserva para salários.</li>}</ul></Panel>
    {watchAlerts.length > 0 && <Panel title="Novidades dos observados" icon="market"><ul className={styles.compactList}>{watchAlerts.map((a) => <li key={a.id}><span>{a.text}<small>Comparação com o momento em que entrou na lista.</small></span><button className={styles.textButton} onClick={() => state.watchPlayer(a.id)}>Deixar de observar</button></li>)}</ul></Panel>}
    <div className={styles.controls}><button className={styles.secondaryButton} onClick={() => navigate('compare')}>Comparar jogadores</button><button className={styles.textButton} onClick={() => navigate('history')}>Ver movimentações do mercado</button></div>
    <section className={styles.panel}>
      <div className={styles.controls}>
        <label className={styles.filterLabel}>Lista<select value={source} onChange={(e) => { setSource(e.target.value); setSelected(null); }}><option value="market">Jogadores de outros clubes</option><option value="own">Meu elenco · vender</option><option value="free">Sem clube</option><option value="watch">Observados ({systems.watchlist.length})</option><option value="loans">Disponíveis por empréstimo</option></select></label>
        <label className={styles.filterLabel}>Posição<select value={position} onChange={(e) => setPosition(e.target.value as PlayerPosition | 'all')}><option value="all">Todas</option>{Object.entries(positionLabels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
        <label className={styles.filterLabel}>Buscar jogador<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome do jogador" /></label>
      </div>
      <DataTable key={`${source}-${position}-${search}`} caption="Jogadores no mercado" pageSize={20} rows={rows} getRowId={(p) => p.id} initialSort={{ id: 'price', direction: 'asc' }} columns={[
        { id: 'name', label: 'Jogador', sortValue: (p) => p.name, render: (p) => <button className={styles.textButton} onClick={() => choose(p)}>{p.name}</button> },
        { id: 'position', label: 'Pos.', render: (p) => positionLabels[p.primaryPosition] },
        { id: 'age', label: 'Idade', sortValue: (p) => p.age, render: (p) => p.age },
        { id: 'strength', label: 'Força', sortValue: (p) => p.overall, render: (p) => <span className={styles.rating}>{p.overall}</span> },
        { id: 'trait', label: 'Perfil', render: (p) => <PlayerTraitBadge player={p} /> },
        { id: 'price', label: source === 'own' ? 'Oferta de venda' : 'Preço pedido', sortValue: (p) => p.currentTeamId ? source === 'own' ? p.marketValue * 0.85 : askingPrice(p) : 0, render: (p) => currency(p.currentTeamId ? source === 'own' ? Math.round(p.marketValue * 0.85 / 1000) * 1000 : askingPrice(p) : 0) },
        { id: 'club', label: 'Clube', render: (p) => [...league!.teams, ...otherLeague!.teams].find((t) => t.id === p.currentTeamId)?.name ?? 'Sem clube' },
      ]} />
    </section>
    {player && <section ref={negotiationRef} tabIndex={-1} className={`${styles.panel} ${styles.negotiationPanel}`} aria-label="Negociação"><div className={styles.panelHeading}><h2>{player.name} · {positionLabels[player.primaryPosition]}</h2><button className={styles.textButton} onClick={() => setSelected(null)}>Fechar negociação</button></div><div className={styles.controls}><button className={styles.secondaryButton} onClick={() => { useUiStore.setState({ compareRight: player.id, compareLeft: team.squad.find((p) => p.primaryPosition === player.primaryPosition)?.id ?? team.squad[0].id }); navigate('compare'); }}>Comparar com meu elenco</button></div>
      <PlayerTraitBadge player={player} detailed />
      {!ownPlayer && <div className={styles.controls}><button className={styles.secondaryButton} aria-pressed={systems.watchlist.some((w) => w.playerId === player.id)} onClick={() => state.watchPlayer(player.id)}>{systems.watchlist.some((w) => w.playerId === player.id) ? 'Deixar de observar' : 'Observar jogador'}</button></div>}
      {ownPlayer ? <div className={styles.controls}><p className={styles.muted}>{onLoan ? `Emprestado por ${clubs.find((t) => t.id === onLoan.fromId)?.name} até o fim da temporada. O contrato pertence ao clube de origem.` : `Um clube interessado paga ${currency(Math.round(player.marketValue * .85 / 1000) * 1000)}. A venda transfere o jogador imediatamente.`}</p><button className={styles.primaryButton} disabled={!open || !!onLoan} onClick={() => sell(player.id)}>Aceitar oferta de venda</button></div>
        : <><div className={styles.controls}><label className={styles.filterLabel}>Tipo de negociação<select value={deal} onChange={(e) => useUiStore.setState({ marketDealType: e.target.value as 'buy' | 'loan' })}><option value="buy">Compra definitiva</option><option value="loan" disabled={!!loanReason}>Empréstimo até o fim da temporada</option></select></label><p className={styles.muted}>{deal === 'buy' ? interest?.description : 'Taxa de 5% do valor de mercado, salário integral e retorno automático ao encerrar a temporada.'}{loanReason && deal === 'buy' ? ` Empréstimo: ${loanReason}` : ''}</p></div>
          <form className={styles.controls} onSubmit={(e) => { e.preventDefault(); if (deal === 'loan') state.borrow(player.id); else buy(player.id, offer, salary, years); }}>
            {deal === 'buy' && <><label className={styles.filterLabel}>Proposta ao clube (R$)<input type="number" min={0} max={1e12} step={1000} value={offer} onChange={(e) => setOffer(Number(e.target.value))} required /></label><label className={styles.filterLabel}>Salário mensal (R$)<input type="number" min={100} max={1e10} step={100} value={salary} onChange={(e) => setSalary(Number(e.target.value))} required /></label><label className={styles.filterLabel}>Anos de contrato<select value={years} onChange={(e) => setYears(Number(e.target.value))}>{[1, 2, 3, 4, 5].map((year) => <option key={year}>{year}</option>)}</select></label></>}
            <button className={styles.primaryButton} disabled={!open || team.budget < 0 || !!onLoan || deal === 'loan' && !!loanReason}>{deal === 'loan' ? 'Confirmar empréstimo' : 'Enviar proposta'}</button>
          </form>
          <div className={styles.dealSummary} aria-label="Custo da contratação"><div><span>{deal === 'loan' ? 'Taxa de empréstimo' : 'Transferência'}</span><strong>{currency(fee)}</strong></div><div><span>Salário mensal</span><strong>{currency(wage)}</strong></div><div><span>Saldo após a taxa</span><strong className={team.budget - fee < wage * 2 ? styles.loss : styles.accent}>{currency(team.budget - fee)}</strong></div><div><span>{deal === 'loan' ? 'Custo estimado até o retorno' : 'Custo estimado do contrato'}</span><strong>{currency(fee + wage * contractWeeks / 4)}</strong></div></div>
          <p className={styles.tableNote}>Nova folha mensal: {currency(team.payroll + wage)}. Reserva sugerida de dois meses: {currency((team.payroll + wage) * 2)}. Custo estimado por {contractWeeks} semanas de liga, sem futuras renovações.{deal === 'buy' ? ` Salário pedido pelo atleta: ${currency(interest!.salary)} por mês.` : ''}</p>
        </>}
    </section>}
    {systems.loans.some((l) => l.status === 'active' && (l.toId === team.id || l.fromId === team.id)) && <Panel title="Empréstimos em andamento" icon="market"><ul className={styles.compactList}>{systems.loans.filter((l) => l.status === 'active' && (l.toId === team.id || l.fromId === team.id)).map((l) => <li key={l.id}><span><strong>{l.playerName}</strong><small>{clubs.find((t) => t.id === l.fromId)?.name} → {clubs.find((t) => t.id === l.toId)?.name} · Retorno ao fim da temporada · Salário: {currency(l.contract.salary)}</small></span></li>)}</ul></Panel>}
  </>;
}
