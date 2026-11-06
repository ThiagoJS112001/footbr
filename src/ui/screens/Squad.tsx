import type { Player, PlayerPosition, Team } from '../../engine/models';
import { DataTable } from '../components/DataTable';
import type { Column } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { currency, positionLabels, positionNames } from '../utils';
import styles from '../App.module.css';
import { careerOf, useGameStore } from '../store/gameStore';
import { currentPlayerRecords, playerCareerTotals } from '../../engine/career/history';
import { useUiStore } from '../store/uiStore';
import { PlayerAvatar } from '../components/PlayerAvatar';

const columns: Column<Player>[] = [
  { id: 'name', label: 'Jogador', sortValue: (player) => player.name, render: (player) => <span className={styles.playerName}><strong>{player.name}</strong><small>{player.injury ? `Lesionado · ${player.injury.remainingDays} dias` : player.discipline.suspendedMatches ? `Suspenso · ${player.discipline.suspendedMatches} jogo(s)` : player.nationality}</small></span> },
  { id: 'position', label: 'Posição', sortValue: (player) => positionLabels[player.primaryPosition], render: (player) => <span title={positionNames[player.primaryPosition]} className={styles.positionTag}>{positionLabels[player.primaryPosition]}</span> },
  { id: 'age', label: 'Idade', align: 'center', sortValue: (player) => player.age, render: (player) => player.age },
  { id: 'overall', label: 'Força', align: 'center', sortValue: (player) => player.overall, render: (player) => <span className={styles.rating}>{player.overall}</span> },
  { id: 'fitness', label: 'Condição física', sortValue: (player) => player.fitness, render: (player) => <Level value={player.fitness} /> },
  { id: 'morale', label: 'Moral', sortValue: (player) => player.morale, render: (player) => <Level value={player.morale} /> },
  { id: 'salary', label: 'Salário mensal', align: 'right', sortValue: (player) => player.contract?.salary ?? 0, render: (player) => player.contract ? currency(player.contract.salary) : '—' },
  { id: 'contract', label: 'Contrato', align: 'right', sortValue: (player) => player.contract?.yearsRemaining ?? 0, render: (player) => player.contract ? `${player.contract.yearsRemaining} ${player.contract.yearsRemaining === 1 ? 'ano' : 'anos'}` : 'Sem contrato' },
];

export function Squad({ team }: { team: Team }) {
  const { squadPosition: position, squadSelected: playerId } = useUiStore();
  const setPosition = (value: PlayerPosition | 'all') => useUiStore.setState({ squadPosition: value });
  const setPlayerId = (value: string | null) => useUiStore.setState({ squadSelected: value });
  const state = useGameStore();
  const { navigate, renew, lineup, league, otherLeague } = state;
  const selected = team.squad.find((p) => p.id === playerId);
  const career = league && otherLeague && state.selectedTeamId ? careerOf(state) : null;
  const current = selected && career ? currentPlayerRecords(career).filter((r) => r.playerId === selected.id) : [];
  const stats = { appearances: current.reduce((s, r) => s + r.appearances, 0), minutes: current.reduce((s, r) => s + r.minutes, 0), goals: current.reduce((s, r) => s + r.goals, 0) };
  const totals = selected && career ? playerCareerTotals(career, selected.id) : null;
  const history = selected && career ? [...career.systems.playerHistory.filter((r) => r.playerId === selected.id), ...current] : [];
  const interactiveColumns = columns.map((column) => column.id === 'name' ? { ...column, render: (player: Player) => <button className={`${styles.playerButton} ${styles.importedPlayerName}`} onClick={() => setPlayerId(player.id)}><PlayerAvatar player={player} />{column.render(player)}</button> } : column);
  const players = team.squad.filter((player) => position === 'all' || player.primaryPosition === position);
  return <><PageHeader eyebrow="GESTÃO DO CLUBE" title="Elenco" description="Conheça os jogadores que vão defender a sua camisa."><span className={styles.pill}>{team.squad.length} JOGADORES</span></PageHeader>
    {state.source && <p className={styles.notice}>Base independente · {state.source.providers.includes('demo') ? 'Contém demonstração fictícia' : 'Identidades importadas'}. Força, potencial, atributos, condição, moral, funções táticas, valores e contratos são simulação. A idade evolui na carreira; quando ausente na fonte, usa o parâmetro configurado.</p>}
    <section className={styles.panel}><div className={styles.tableToolbar}><div><h2>Todos os jogadores</h2><span className={styles.muted}>Clique nos títulos das colunas para ordenar.</span></div><label className={styles.filterLabel}>Filtrar por posição<select value={position} onChange={(event) => setPosition(event.target.value as PlayerPosition | 'all')}><option value="all">Todas as posições</option>{(Object.keys(positionLabels) as PlayerPosition[]).map((key) => <option value={key} key={key}>{positionLabels[key]} · {positionNames[key]}</option>)}</select></label></div>
      <div className={styles.controls}><button className={styles.primaryButton} onClick={() => navigate('lineup')}>Definir titulares e tática</button><button className={styles.secondaryButton} onClick={() => navigate('market')}>Comprar ou vender jogadores</button><button className={styles.secondaryButton} onClick={() => navigate('compare')}>Comparar jogadores</button></div>
      <DataTable caption="Elenco do clube" rows={players} columns={interactiveColumns} getRowId={(player) => player.id} getRowClassName={(p) => lineup?.starterIds.includes(p.id) ? styles.selectedRow : ''} initialSort={{ id: 'overall', direction: 'desc' }} />
      <div className={styles.tableNote}>{players.length} de {team.squad.length} jogadores · Salários em reais por mês.</div>
    </section>
    {selected?.identity && <section className={styles.panel} aria-label="Identidade importada do jogador"><div className={styles.panelHeading}><h2>Dados da fonte · {selected.identity.provider === 'demo' ? 'Demonstração fictícia' : 'API-Football'}</h2></div><p className={styles.tableNote}>Nome: {selected.identity.facts.name} · Nascimento: {selected.identity.facts.birthDate ?? 'Não informado'} · Idade no perfil: {selected.identity.facts.age ?? 'Não informada'} · Nacionalidade: {selected.identity.facts.nationality ?? 'Não informada'} · Posição na fonte: {selected.identity.facts.position ?? 'Não informada'} · Camisa na base: {selected.identity.facts.number ?? 'Não informada'} · ID externo: {selected.identity.facts.externalId}. Clube nesta carreira: {team.name}. Consulta: {new Date(selected.identity.observedAt).toLocaleDateString('pt-BR')}. Atributos abaixo gerados para simulação.</p></section>}
    {selected && <section className={styles.panel} aria-label="Ficha do jogador"><div className={styles.panelHeading}><h2>{selected.name} · {positionNames[selected.primaryPosition]}</h2><button className={styles.textButton} onClick={() => setPlayerId(null)}>Fechar ficha</button></div><div className={styles.controls}><span className={styles.muted}>{selected.age} anos · {selected.nationality} · Valor: {currency(selected.marketValue)}{selected.secondaryPosition ? ` · Também atua como ${positionLabels[selected.secondaryPosition]}` : ''}<br />Nesta temporada: {stats?.appearances} jogo(s) · {stats?.minutes} minutos · {stats?.goals} gol(s)</span></div><div className={styles.attributeGrid}>{Object.entries(selected.attributes).map(([key, value]) => <div key={key}><span>{{ attack: 'Ataque', midfield: 'Meio-campo', defense: 'Defesa', goalkeeping: 'Goleiro', speed: 'Velocidade', passing: 'Passe', finishing: 'Finalização', stamina: 'Fôlego' }[key]}</span><strong>{value}</strong></div>)}</div><div className={styles.controls}><p className={styles.muted}>Contrato: {selected.contract?.yearsRemaining ?? 0} ano(s) · Salário mensal: {currency(selected.contract?.salary ?? 0)}. Renovação por três anos: aumento de 10% e luvas de um salário novo.</p><button className={styles.secondaryButton} disabled={(selected.contract?.yearsRemaining ?? 0) >= 3 || team.budget < 0} onClick={() => renew(selected.id)}>Renovar contrato</button></div></section>}
    {selected && <section className={styles.panel} aria-label="Histórico individual"><div className={styles.panelHeading}><h2>Carreira de {selected.name}</h2><button className={styles.textButton} onClick={() => { useUiStore.setState({ compareRight: selected.id, compareLeft: team.squad.find((p) => p.id !== selected.id)?.id ?? selected.id }); navigate('compare'); }}>Comparar este jogador</button></div><p className={styles.tableNote}>Total: {totals?.appearances ?? 0} jogos · {totals?.goals ?? 0} gols · {totals?.titles.length ?? 0} título(s). {totals?.titles.join(' · ')}</p><DataTable caption="Temporadas do jogador" rows={history} pageSize={10} getRowId={(r) => `${r.season}-${r.teamId}`} columns={[{ id: 'season', label: 'Temporada', render: (r) => r.season }, { id: 'club', label: 'Clube', render: (r) => r.teamName }, { id: 'games', label: 'Jogos', render: (r) => r.appearances }, { id: 'minutes', label: 'Minutos', render: (r) => r.minutes }, { id: 'goals', label: 'Gols', render: (r) => r.goals }, { id: 'titles', label: 'Títulos', render: (r) => r.titles.join(', ') || '—' }]} /></section>}
    </>;
}

function Level({ value }: { value: number }) {
  const rounded = Math.round(value);
  return <span className={styles.level}><span className={styles.levelTrack}><span className={rounded < 50 ? styles.levelLow : ''} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></span><span>{rounded}%</span></span>;
}
