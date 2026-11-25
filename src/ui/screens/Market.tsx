import { worldTeams } from '../../engine/career/world';
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
import { PlayerAvatar } from '../components/PlayerAvatar';
import { ClubBadge } from '../components/ClubBadge';
import { Level } from '../components/ClubMetrics';
import { Icon } from '../components/Icon';
import views from './ClubViews.module.css';

const marketTabs = [
  { label: 'Buscar jogadores', icon: 'search' },
  { label: 'Minhas negociações', icon: 'market' },
  { label: 'Propostas recebidas', icon: 'mail' },
] as const;

function OfferCounter({ offer, open, onSubmit }: { offer: TransferOffer; open: boolean; onSubmit: () => void }) {
  const counter = useGameStore((s) => s.counter);
  const [amount, setAmount] = useState(offer.amount + Math.max(1000, Math.round(offer.amount * .1 / 1000) * 1000));
  return <form className={views.marketActions} onSubmit={(e) => {
    e.preventDefault();
    counter(offer.id, amount);
    if (!useGameStore.getState().error) onSubmit();
  }}><label className={styles.filterLabel}>Contraproposta por {offer.playerName} (R$)<input type="number" min={offer.amount + 1} max={1e12} step={1} value={amount} onChange={(e) => setAmount(Number(e.target.value))} required /></label><button className={styles.secondaryButton} disabled={!open}>Negociar valor</button></form>;
}

function ReceivedOffers({ offers, clubs, team, open }: { offers: TransferOffer[]; clubs: Team[]; team: Team; open: boolean }) {
  const respondOffer = useGameStore((state) => state.respondOffer);
  const [offerId, setOfferId] = useState<string>();
  const [counterId, setCounterId] = useState<string>();
  const offer = offers.find((item) => item.id === offerId) ?? offers[0];
  const players = new Map(team.squad.map((p) => [p.id, p]));
  const buyers = new Map(clubs.map((club) => [club.id, club]));
  const player = offer && players.get(offer.playerId);
  const buyer = offer && buyers.get(offer.buyerId);
  return <div className={`${views.split} ${views.marketOffers}`}>
    <Panel title="Propostas recebidas" icon="mail" className={`${views.surface} ${views.dense}`}
      action={<span className={styles.pill}>{offers.length} {offers.length === 1 ? 'pendente' : 'pendentes'}</span>}>
      <DataTable caption="Propostas recebidas" rows={offers} getRowId={(row) => row.id}
        getRowClassName={(row) => row.id === offer?.id ? styles.selectedRow : ''} columns={[
          { id: 'player', label: 'Jogador', sortValue: (row) => row.playerName, render: (row) => {
            const candidate = players.get(row.playerId);
            return <span className={views.marketIdentity}><PlayerAvatar player={candidate} /><span><strong>{row.playerName}</strong>
              {candidate && <small>{positionLabels[candidate.primaryPosition]} · {candidate.age} anos</small>}</span></span>;
          } },
          { id: 'buyer', label: 'Clube interessado', sortValue: (row) => buyers.get(row.buyerId)?.name ?? '', render: (row) => {
            const club = buyers.get(row.buyerId);
            return club && <span className={styles.tableClub}><ClubBadge name={club.name} image={club.identity?.facts.image} />{club.name}</span>;
          } },
          { id: 'amount', label: 'Proposta', sortValue: (row) => row.amount, render: (row) => <strong className={styles.accent}>{currency(row.amount)}</strong> },
          { id: 'expires', label: 'Validade', sortValue: (row) => row.expiresRound, render: (row) => `Rodada ${row.expiresRound}` },
          { id: 'action', label: '', render: (row) => <button className={styles.secondaryButton} aria-label={`Analisar proposta por ${row.playerName}`} aria-pressed={row.id === offer?.id}
            onClick={() => { setOfferId(row.id); setCounterId(undefined); }}><Icon name="eye" size={15} />Analisar</button> },
        ]} />
    </Panel>
    {offer && <aside aria-label="Proposta selecionada" className={`${styles.panel} ${views.surface} ${views.marketDetails}`}>
      <div className={views.marketPlayerHeading}>
        <span className={views.marketIdentity}><PlayerAvatar player={player} /><span><h2>{offer.playerName}</h2>
          {player && <small>{positionLabels[player.primaryPosition]} · {player.age} anos</small>}</span></span>
        {player && <span className={styles.rating} aria-label={`Força geral ${player.overall}`}>{player.overall}</span>}
      </div>
      <section>
        <h3><Icon name="mail" size={18} />Detalhes da proposta</h3>
        {buyer && <div className={views.marketIdentity}><ClubBadge name={buyer.name} image={buyer.identity?.facts.image} /><span><strong>{buyer.name}</strong><small>Clube interessado</small></span></div>}
        <dl className={views.marketFacts}>
          <div><dt>Valor da proposta</dt><dd>{currency(offer.amount)}</dd></div>
          <div><dt>Validade</dt><dd>Antes do jogo da rodada {offer.expiresRound}</dd></div>
          <div><dt>Tipo</dt><dd>Compra definitiva</dd></div>
        </dl>
      </section>
      {player && <section>
        <h3><Icon name="trend" size={18} />Informações do jogador</h3>
        <dl className={views.marketFacts}>
          <div><dt>Potencial</dt><dd>{player.potential ?? player.overall}</dd></div>
          <div><dt>Condição física</dt><dd><Level value={player.fitness} /></dd></div>
          <div><dt>Contrato</dt><dd>{player.contract ? `${player.contract.yearsRemaining} ano(s) restante(s)` : 'Sem contrato'}</dd></div>
          {player.contract && <div><dt>Salário</dt><dd>{currency(player.contract.salary)}/mês</dd></div>}
        </dl>
      </section>}
      <section>
        <div className={views.marketActions}>
          <button className={styles.primaryButton} aria-label={`Aceitar proposta por ${offer.playerName}`} disabled={!open} onClick={() => respondOffer(offer.id, true)}><Icon name="check" size={17} />Aceitar proposta</button>
          <button className={styles.secondaryButton} disabled={!open || offer.countered} aria-expanded={counterId === offer.id} onClick={() => setCounterId(counterId === offer.id ? undefined : offer.id)}><Icon name="market" size={17} />Contraproposta</button>
          <button className={styles.secondaryButton} onClick={() => respondOffer(offer.id, false)}><Icon name="close" size={17} />Recusar</button>
        </div>
        {offer.countered && <small className={styles.muted}>Resposta final do comprador</small>}
        {counterId === offer.id && !offer.countered && <OfferCounter key={offer.id} offer={offer} open={open} onSubmit={() => setCounterId(undefined)} />}
      </section>
    </aside>}
  </div>;
}

export function Market({ team }: { team: Team }) {
  const state = useGameStore();
  const { league, freeAgents, currentRound, buy, sell, systems, navigate } = state;
  const career = careerOf(state);
  const clubs = worldTeams(career);
  const allPlayers = [...clubs.flatMap((t) => t.squad), ...freeAgents];
  const deal = useUiStore((s) => s.marketDealType);
  const negotiationRef = useRef<HTMLElement>(null);
  const { marketPosition: position, marketSearch: search, marketSource: source, marketSelected: selected, marketOffer: offer, marketSalary: salary, marketYears: years } = useUiStore();
  const [tab, setTab] = useState<(typeof marketTabs)[number]['label']>(selected ? 'Minhas negociações' : 'Buscar jogadores');
  const setPosition = (value: PlayerPosition | 'all') => useUiStore.setState({ marketPosition: value });
  const setSearch = (value: string) => useUiStore.setState({ marketSearch: value });
  const setSource = (value: string) => useUiStore.setState({ marketSource: value });
  const setSelected = (value: string | null) => useUiStore.setState({ marketSelected: value });
  const setOffer = (value: number) => useUiStore.setState({ marketOffer: value });
  const setSalary = (value: number) => useUiStore.setState({ marketSalary: value });
  const setYears = (value: number) => useUiStore.setState({ marketYears: value });
  useEffect(() => {
    if (!selected || tab !== 'Minhas negociações') return;
    negotiationRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    negotiationRef.current?.focus({ preventScroll: true });
  }, [selected, tab]);
  const open = isWindowOpen(currentRound);
  const candidates = source === 'own' ? team.squad : source === 'free' ? freeAgents : source === 'watch' ? allPlayers.filter((p) => systems.watchlist.some((w) => w.playerId === p.id)) : source === 'loans' ? allPlayers.filter((p) => loanAvailability(career, p) === null) : clubs.filter((t) => t.id !== team.id).flatMap((t) => t.squad);
  const rows = candidates.filter((p) => (position === 'all' || p.primaryPosition === position) && p.name.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));
  const player = candidates.find((p) => p.id === selected);
  const choose = (p: Player) => { setSelected(p.id); setOffer(p.currentTeamId ? askingPrice(p) : 0); setSalary(signingInterest(p, team, clubs.find((t) => t.id === p.currentTeamId)).salary); useUiStore.setState({ marketDealType: source === 'loans' ? 'loan' : 'buy' }); setTab('Minhas negociações'); };
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
  const pendingOffers = systems.offers.filter((item) => item.status === 'pending');
  const activeLoans = systems.loans.filter((item) => item.status === 'active' && (item.toId === team.id || item.fromId === team.id));
  const transfers = systems.transfers.filter((item) => item.fromId === team.id || item.toId === team.id).slice(-8).reverse();
  return <>
    <PageHeader eyebrow="NEGOCIAÇÕES E TRANSFERÊNCIAS" title="Mercado" description={`Saldo: ${currency(team.budget)} · Janela ${open ? 'aberta' : 'fechada'} · Rodadas 1–4 e 20–23`} />
    <div className={`${views.tabs} ${views.marketTabs}`} role="group" aria-label="Seções do mercado">
      {marketTabs.map(({ label, icon }) => <button key={label} className={tab === label ? styles.primaryButton : styles.secondaryButton} aria-pressed={tab === label} onClick={() => setTab(label)}>
        <Icon name={icon} size={18} />{label}{label === 'Propostas recebidas' && pendingOffers.length > 0 && <span className={views.marketCount} aria-hidden="true">{pendingOffers.length}</span>}
      </button>)}
    </div>
    {tab === 'Propostas recebidas' && <ReceivedOffers offers={pendingOffers} clubs={clubs} team={team} open={open} />}
    {tab === 'Buscar jogadores' && <>
    {watchAlerts.length > 0 && <Panel title="Novidades dos observados" icon="market"><ul className={styles.compactList}>{watchAlerts.map((a) => <li key={a.id}><span>{a.text}<small>Comparação com o momento em que entrou na lista.</small></span><button className={styles.textButton} onClick={() => state.watchPlayer(a.id)}>Deixar de observar</button></li>)}</ul></Panel>}
    <section className={styles.panel}>
      <div className={styles.controls}>
        <label className={styles.filterLabel}>Lista<select value={source} onChange={(e) => { setSource(e.target.value); setSelected(null); }}><option value="market">Jogadores de outros clubes</option><option value="own">Meu elenco · vender</option><option value="free">Sem clube</option><option value="watch">Observados ({systems.watchlist.length})</option><option value="loans">Disponíveis por empréstimo</option></select></label>
        <label className={styles.filterLabel}>Posição<select value={position} onChange={(e) => setPosition(e.target.value as PlayerPosition | 'all')}><option value="all">Todas</option>{Object.entries(positionLabels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
        <label className={styles.filterLabel}>Buscar jogador<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome do jogador" /></label>
        <button className={styles.secondaryButton} onClick={() => navigate('compare')}>Comparar jogadores</button>
      </div>
      <DataTable key={`${source}-${position}-${search}`} caption="Jogadores no mercado" pageSize={20} rows={rows} getRowId={(p) => p.id} initialSort={{ id: 'price', direction: 'asc' }} columns={[
        { id: 'name', label: 'Jogador', sortValue: (p) => p.name, render: (p) => <button className={styles.textButton} onClick={() => choose(p)}>{p.name}</button> },
        { id: 'position', label: 'Pos.', render: (p) => positionLabels[p.primaryPosition] },
        { id: 'age', label: 'Idade', sortValue: (p) => p.age, render: (p) => p.age },
        { id: 'strength', label: 'Força', sortValue: (p) => p.overall, render: (p) => <span className={styles.rating}>{p.overall}</span> },
        { id: 'trait', label: 'Perfil', render: (p) => <PlayerTraitBadge player={p} /> },
        { id: 'price', label: source === 'own' ? 'Oferta de venda' : 'Preço pedido', sortValue: (p) => p.currentTeamId ? source === 'own' ? p.marketValue * 0.85 : askingPrice(p) : 0, render: (p) => currency(p.currentTeamId ? source === 'own' ? Math.round(p.marketValue * 0.85 / 1000) * 1000 : askingPrice(p) : 0) },
        { id: 'club', label: 'Clube', render: (p) => clubs.find((t) => t.id === p.currentTeamId)?.name ?? 'Sem clube' },
      ]} />
    </section>
    </>}
    {tab === 'Minhas negociações' && <div className={views.stack}>
    {player && <section ref={negotiationRef} tabIndex={-1} className={`${styles.panel} ${styles.negotiationPanel}`} aria-label="Negociação"><div className={styles.panelHeading}><h2>{player.name} · {positionLabels[player.primaryPosition]}</h2><button className={styles.textButton} onClick={() => { setSelected(null); setTab('Buscar jogadores'); }}>Fechar negociação</button></div><div className={styles.controls}><button className={styles.secondaryButton} onClick={() => { useUiStore.setState({ compareRight: player.id, compareLeft: team.squad.find((p) => p.primaryPosition === player.primaryPosition)?.id ?? team.squad[0].id }); navigate('compare'); }}>Comparar com meu elenco</button></div>
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
    {activeLoans.length > 0 && <Panel title="Empréstimos em andamento" icon="market"><ul className={styles.compactList}>{activeLoans.map((l) => <li key={l.id}><span><strong>{l.playerName}</strong><small>{clubs.find((t) => t.id === l.fromId)?.name} → {clubs.find((t) => t.id === l.toId)?.name} · Retorno ao fim da temporada · Salário: {currency(l.contract.salary)}</small></span></li>)}</ul></Panel>}
    <Panel title="Movimentações recentes" icon="history" className={views.surface}
      action={<button className={styles.textButton} onClick={() => navigate('history')}>Ver movimentações do mercado <Icon name="arrow" size={15} /></button>}>
      {transfers.length ? <ul className={styles.compactList}>{transfers.map((item) => <li key={item.id}>
        <span><strong>{item.playerName}</strong><small>{item.fromName} → {item.toName} · Rodada {item.round}</small></span><strong>{currency(item.fee)}</strong>
      </li>)}</ul> : <p className={styles.tableNote}>Nenhuma transferência registrada para o clube.</p>}
    </Panel>
    </div>}
  </>;
}
