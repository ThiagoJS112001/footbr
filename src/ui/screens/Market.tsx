import type { Player, PlayerPosition, Team } from '../../engine/models';
import { askingPrice, isWindowOpen } from '../../engine/career/career';
import { useGameStore } from '../store/gameStore';
import { useUiStore } from '../store/uiStore';
import { Panel } from '../components/Panel';
import { PageHeader } from '../components/PageHeader';
import { DataTable } from '../components/DataTable';
import { currency, positionLabels } from '../utils';
import styles from '../App.module.css';

export function Market({ team }: { team: Team }) {
  const { league, otherLeague, freeAgents, currentRound, buy, sell, systems, respondOffer, navigate } = useGameStore();
  const { marketPosition: position, marketSearch: search, marketSource: source, marketSelected: selected, marketOffer: offer, marketSalary: salary, marketYears: years } = useUiStore();
  const setPosition = (value: PlayerPosition | 'all') => useUiStore.setState({ marketPosition: value });
  const setSearch = (value: string) => useUiStore.setState({ marketSearch: value });
  const setSource = (value: string) => useUiStore.setState({ marketSource: value });
  const setSelected = (value: string | null) => useUiStore.setState({ marketSelected: value });
  const setOffer = (value: number) => useUiStore.setState({ marketOffer: value });
  const setSalary = (value: number) => useUiStore.setState({ marketSalary: value });
  const setYears = (value: number) => useUiStore.setState({ marketYears: value });
  const open = isWindowOpen(currentRound);
  const candidates = source === 'own' ? team.squad : source === 'free' ? freeAgents : [...league!.teams, ...otherLeague!.teams].filter((t) => t.id !== team.id).flatMap((t) => t.squad);
  const rows = candidates.filter((p) => (position === 'all' || p.primaryPosition === position) && p.name.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));
  const player = candidates.find((p) => p.id === selected);
  const choose = (p: Player) => { setSelected(p.id); setOffer(p.currentTeamId ? askingPrice(p) : 0); setSalary(Math.ceil((p.contract?.salary ?? p.marketValue * 0.012) * 1.1 / 100) * 100); };
  return <>
    <PageHeader eyebrow="MONTE SEU ELENCO" title="Mercado" description={`Saldo: ${currency(team.budget)} · Janela ${open ? 'aberta' : 'fechada'} · Rodadas 1–4 e 20–23`} />
    <Panel title="Propostas recebidas" icon="market"><ul className={styles.compactList}>{systems.offers.filter((o) => o.status === 'pending').map((offer) => {
      const buyer = [...league!.teams, ...otherLeague!.teams].find((t) => t.id === offer.buyerId)!;
      return <li key={offer.id}><span><strong>{offer.playerName} → {buyer.name}</strong><small>{currency(offer.amount)} · válida até antes do jogo da rodada {offer.expiresRound}</small></span><div className={styles.inlineActions}><button className={styles.primaryButton} disabled={!open} onClick={() => respondOffer(offer.id, true)}>Aceitar proposta por {offer.playerName}</button><button className={styles.secondaryButton} onClick={() => respondOffer(offer.id, false)}>Recusar</button></div></li>;
    })}{!systems.offers.some((o) => o.status === 'pending') && <li className={styles.muted}>Nenhuma proposta pendente. A IA busca reforços durante as janelas e preserva uma reserva para salários.</li>}</ul></Panel>
    <div className={styles.controls}><button className={styles.secondaryButton} onClick={() => navigate('compare')}>Comparar jogadores</button><button className={styles.textButton} onClick={() => navigate('history')}>Ver movimentações do mercado</button></div>
    <section className={styles.panel}>
      <div className={styles.controls}>
        <label className={styles.filterLabel}>Lista<select value={source} onChange={(e) => { setSource(e.target.value); setSelected(null); }}><option value="market">Jogadores de outros clubes</option><option value="own">Meu elenco · vender</option><option value="free">Sem clube</option></select></label>
        <label className={styles.filterLabel}>Posição<select value={position} onChange={(e) => setPosition(e.target.value as PlayerPosition | 'all')}><option value="all">Todas</option>{Object.entries(positionLabels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
        <label className={styles.filterLabel}>Buscar jogador<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome do jogador" /></label>
      </div>
      <DataTable key={`${source}-${position}-${search}`} caption="Jogadores no mercado" pageSize={30} rows={rows} getRowId={(p) => p.id} initialSort={{ id: 'price', direction: 'asc' }} columns={[
        { id: 'name', label: 'Jogador', sortValue: (p) => p.name, render: (p) => <button className={styles.textButton} onClick={() => choose(p)}>{p.name}</button> },
        { id: 'position', label: 'Pos.', render: (p) => positionLabels[p.primaryPosition] },
        { id: 'age', label: 'Idade', sortValue: (p) => p.age, render: (p) => p.age },
        { id: 'strength', label: 'Força', sortValue: (p) => p.overall, render: (p) => <span className={styles.rating}>{p.overall}</span> },
        { id: 'price', label: source === 'own' ? 'Oferta de venda' : 'Preço pedido', sortValue: (p) => p.currentTeamId ? source === 'own' ? p.marketValue * 0.85 : askingPrice(p) : 0, render: (p) => currency(p.currentTeamId ? source === 'own' ? Math.round(p.marketValue * 0.85 / 1000) * 1000 : askingPrice(p) : 0) },
        { id: 'club', label: 'Clube', render: (p) => [...league!.teams, ...otherLeague!.teams].find((t) => t.id === p.currentTeamId)?.name ?? 'Sem clube' },
      ]} />
    </section>
    {player && <section className={styles.panel} aria-label="Negociação"><div className={styles.panelHeading}><h2>{player.name} · {positionLabels[player.primaryPosition]}</h2><button className={styles.textButton} onClick={() => setSelected(null)}>Fechar negociação</button></div><div className={styles.controls}><button className={styles.secondaryButton} onClick={() => { useUiStore.setState({ compareRight: player.id, compareLeft: team.squad.find((p) => p.primaryPosition === player.primaryPosition)?.id ?? team.squad[0].id }); navigate('compare'); }}>Comparar com meu elenco</button></div>
      {source === 'own' ? <div className={styles.controls}><p className={styles.muted}>Um clube interessado paga {currency(Math.round(player.marketValue * 0.85 / 1000) * 1000)}. A venda transfere o jogador imediatamente.</p><button className={styles.primaryButton} disabled={!open} onClick={() => { sell(player.id); }}>Aceitar oferta de venda</button></div>
        : <form className={styles.controls} onSubmit={(e) => { e.preventDefault(); buy(player.id, offer, salary, years); }}>
          <label className={styles.filterLabel}>Proposta ao clube (R$)<input type="number" min={0} step={1000} value={offer} onChange={(e) => setOffer(Number(e.target.value))} required /></label>
          <label className={styles.filterLabel}>Salário mensal (R$)<input type="number" min={100} step={100} value={salary} onChange={(e) => setSalary(Number(e.target.value))} required /></label>
          <label className={styles.filterLabel}>Anos de contrato<select value={years} onChange={(e) => setYears(Number(e.target.value))}>{[1, 2, 3, 4, 5].map((year) => <option key={year}>{year}</option>)}</select></label>
          <button className={styles.primaryButton} disabled={!open || team.budget < 0}>Enviar proposta</button>
        </form>}
    </section>}
  </>;
}
