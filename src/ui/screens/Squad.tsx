import { useState } from 'react';
import { worldTeams } from '../../engine/career/world';
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
import { PlayerTraitBadge } from '../components/PlayerTraitBadge';
import { activeLoan } from '../../engine/career/market';
import { ClubMetrics, Level } from '../components/ClubMetrics';
import { Icon } from '../components/Icon';
import { TacticalPitch } from '../components/TacticalPitch';
import views from './ClubViews.module.css';

const columns: Column<Player>[] = [
  { id: 'name', label: 'Jogador', sortValue: (player) => player.name, render: (player) => <span className={styles.playerName}><strong>{player.name}</strong><small>{player.injury ? `Lesionado · ${player.injury.remainingDays} dias` : player.discipline.suspendedMatches ? `Suspenso · ${player.discipline.suspendedMatches} jogo(s)` : player.nationality}</small></span> },
  { id: 'position', label: 'Posição', sortValue: (player) => positionLabels[player.primaryPosition], render: (player) => <span title={positionNames[player.primaryPosition]} className={styles.positionTag}>{positionLabels[player.primaryPosition]}</span> },
  { id: 'age', label: 'Idade', align: 'center', sortValue: (player) => player.age, render: (player) => player.age },
  { id: 'overall', label: 'Força', align: 'center', sortValue: (player) => player.overall, render: (player) => <span className={styles.rating}>{player.overall}</span> },
  { id: 'trait', label: 'Perfil', render: (player) => <PlayerTraitBadge player={player} /> },
  { id: 'fitness', label: 'Condição física', sortValue: (player) => player.fitness, render: (player) => <Level value={player.fitness} /> },
  { id: 'morale', label: 'Moral', sortValue: (player) => player.morale, render: (player) => <Level value={player.morale} /> },
  { id: 'salary', label: 'Salário mensal', align: 'right', sortValue: (player) => player.contract?.salary ?? 0, render: (player) => player.contract ? currency(player.contract.salary) : '—' },
  { id: 'contract', label: 'Contrato', align: 'right', sortValue: (player) => player.contract?.yearsRemaining ?? 0, render: (player) => player.contract ? `${player.contract.yearsRemaining} ${player.contract.yearsRemaining === 1 ? 'ano' : 'anos'}` : 'Sem contrato' },
];

export function Squad({ team }: { team: Team }) {
  const [query, setQuery] = useState('');
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
  const loan = selected && career ? activeLoan(career, selected.id) : null;
  const moments = selected && career ? career.systems.milestones.filter((m) => m.playerId === selected.id).slice(-10).reverse() : [];
  const history = selected && career ? [...career.systems.playerHistory.filter((r) => r.playerId === selected.id), ...current] : [];
  const interactiveColumns = columns.map((column) => {
    if (column.id === 'name') return { ...column, render: (player: Player) => <button className={`${styles.playerButton} ${styles.importedPlayerName}`} onClick={() => setPlayerId(player.id)}><PlayerAvatar player={player} />{column.render(player)}</button> };
    if (column.id === 'position') return {
      ...column,
      headerControl: <select className={views.positionFilter} aria-label="Filtrar por posição" value={position}
        onChange={(event) => setPosition(event.target.value as PlayerPosition | 'all')}>
        <option value="all">Todas</option>
        {(Object.keys(positionLabels) as PlayerPosition[]).map((key) => <option value={key} key={key}>{positionLabels[key]} · {positionNames[key]}</option>)}
      </select>,
    };
    return column;
  });
  const players = team.squad.filter((player) => (position === 'all' || player.primaryPosition === position) &&
    player.name.toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR')));
  const average = (key: 'age' | 'overall') => Math.round(team.squad.reduce((sum, p) => sum + p[key], 0) / (team.squad.length || 1));
  const salary = team.squad.reduce((sum, p) => sum + (p.contract?.salary ?? 0), 0);
  return <><PageHeader eyebrow="GESTÃO DO CLUBE" title="Elenco" description="Conheça os jogadores que vão defender a sua camisa." />
    <ClubMetrics items={[
      { icon: 'squad', label: 'Jogadores', value: team.squad.length },
      { icon: 'condition', label: 'Força média', value: average('overall') },
      { icon: 'finances', label: 'Folha salarial', value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 2 }).format(salary) },
      { icon: 'calendar', label: 'Idade média', value: `${average('age')} anos` },
    ]} />
    {state.source && <p className={styles.notice}>Base independente · {state.source.providers.includes('demo') ? 'Contém demonstração fictícia' : 'Identidades importadas'}. Força, potencial, atributos, condição, moral, funções táticas, valores e contratos são simulação. A idade evolui na carreira; quando ausente na fonte, usa o parâmetro configurado.</p>}
    <div className={`${views.split} ${views.squad}`}>
    <section className={`${styles.panel} ${views.surface}`}><div className={styles.tableToolbar}><h2><Icon name="shirt" className={views.headingIcon} />Todos os jogadores</h2></div>
      <div className={views.toolbar}>
        <button className={styles.secondaryButton} onClick={() => navigate('compare')}><Icon name="compare" size={17} />Comparar jogadores</button>
        <input type="search" aria-label="Buscar jogador" placeholder="Buscar jogador…" value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      <div className={`${views.tableArea} ${views.dense}`}><DataTable caption="Elenco do clube" rows={players} columns={interactiveColumns} getRowId={(player) => player.id} getRowClassName={(p) => lineup?.starterIds.includes(p.id) ? styles.selectedRow : ''} initialSort={{ id: 'overall', direction: 'desc' }} /></div>
      <div className={styles.tableNote}>{players.length} de {team.squad.length} jogadores · Salários em reais por mês.</div>
    </section>
    <aside className={`${styles.panel} ${views.surface} ${views.summary}`}>
      <h2><Icon name="squad" />Resumo do elenco</h2>
      <TacticalPitch formation={lineup?.tactic.formation ?? team.defaultTactic.formation} variant="overview" />
      <p><Icon name="check" size={18} />{lineup?.starterIds.length ?? 0} titulares definidos</p>
      <p><Icon name="academy" size={18} />{team.squad.filter((p) => p.age <= 21 && (p.potential ?? p.overall) - p.overall >= 8).length} jovens promissores</p>
      <p><Icon name="news" size={18} />{team.squad.filter((p) => p.contract && p.contract.yearsRemaining <= 1).length} contratos perto do fim</p>
      <button className={styles.secondaryButton} onClick={() => navigate('lineup')}>Ver escalação <Icon name="arrow" size={17} /></button>
    </aside>
    </div>
    {selected && <section className={styles.panel} aria-label="Personalidade e momentos do jogador"><PlayerTraitBadge player={selected} detailed />{selected.academyClubId && <p className={styles.tableNote}>Formado na base de {worldTeams(career!).find((t) => t.id === selected.academyClubId)?.name ?? 'seu clube de origem'}.</p>}{loan && <p className={styles.tableNote}>Emprestado por {worldTeams(career!).find((t) => t.id === loan.fromId)?.name} até o fim da temporada. O contrato pertence ao clube de origem.</p>}<ul className={styles.compactList}>{moments.map((m) => <li key={m.id}><span>{m.text}<small>Temporada {m.season} · Rodada {m.round}</small></span></li>)}</ul></section>}
    {selected?.identity && <section className={styles.panel} aria-label="Identidade importada do jogador"><div className={styles.panelHeading}><h2>Dados da fonte · {selected.identity.provider === 'demo' ? 'Demonstração fictícia' : 'API-Football'}</h2></div><p className={styles.tableNote}>Nome: {selected.identity.facts.name} · Nascimento: {selected.identity.facts.birthDate ?? 'Não informado'} · Idade no perfil: {selected.identity.facts.age ?? 'Não informada'} · Nacionalidade: {selected.identity.facts.nationality ?? 'Não informada'} · Posição na fonte: {selected.identity.facts.position ?? 'Não informada'} · Camisa na base: {selected.identity.facts.number ?? 'Não informada'} · ID externo: {selected.identity.facts.externalId}. Clube nesta carreira: {team.name}. Consulta: {new Date(selected.identity.observedAt).toLocaleDateString('pt-BR')}. Atributos abaixo gerados para simulação.</p></section>}
    {selected && <section className={styles.panel} aria-label="Ficha do jogador"><div className={styles.panelHeading}><h2>{selected.name} · {positionNames[selected.primaryPosition]}</h2><button className={styles.textButton} onClick={() => setPlayerId(null)}>Fechar ficha</button></div><div className={styles.controls}><span className={styles.muted}>{selected.age} anos · {selected.nationality} · Valor: {currency(selected.marketValue)}{selected.secondaryPosition ? ` · Também atua como ${positionLabels[selected.secondaryPosition]}` : ''}<br />Nesta temporada: {stats?.appearances} jogo(s) · {stats?.minutes} minutos · {stats?.goals} gol(s)</span></div><div className={styles.attributeGrid}>{Object.entries(selected.attributes).map(([key, value]) => <div key={key}><span>{{ attack: 'Ataque', midfield: 'Meio-campo', defense: 'Defesa', goalkeeping: 'Goleiro', speed: 'Velocidade', passing: 'Passe', finishing: 'Finalização', stamina: 'Fôlego' }[key]}</span><strong>{value}</strong></div>)}</div><div className={styles.controls}><p className={styles.muted}>Contrato: {selected.contract?.yearsRemaining ?? 0} ano(s) · Salário mensal: {currency(selected.contract?.salary ?? 0)}. Renovação por três anos: aumento de 10% e luvas de um salário novo.</p><button className={styles.secondaryButton} disabled={(selected.contract?.yearsRemaining ?? 0) >= 3 || team.budget < 0 || !!loan} onClick={() => renew(selected.id)}>Renovar contrato</button></div></section>}
    {selected && <section className={styles.panel} aria-label="Histórico individual"><div className={styles.panelHeading}><h2>Carreira de {selected.name}</h2><button className={styles.textButton} onClick={() => { useUiStore.setState({ compareRight: selected.id, compareLeft: team.squad.find((p) => p.id !== selected.id)?.id ?? selected.id }); navigate('compare'); }}>Comparar este jogador</button></div><p className={styles.tableNote}>Total: {totals?.appearances ?? 0} jogos · {totals?.goals ?? 0} gols · {totals?.titles.length ?? 0} título(s). {totals?.titles.join(' · ')}</p><DataTable caption="Temporadas do jogador" rows={history} pageSize={10} getRowId={(r) => `${r.season}-${r.teamId}`} columns={[{ id: 'season', label: 'Temporada', render: (r) => r.season }, { id: 'club', label: 'Clube', render: (r) => r.teamName }, { id: 'games', label: 'Jogos', render: (r) => r.appearances }, { id: 'minutes', label: 'Minutos', render: (r) => r.minutes }, { id: 'goals', label: 'Gols', render: (r) => r.goals }, { id: 'titles', label: 'Títulos', render: (r) => r.titles.join(', ') || '—' }]} /></section>}
    </>;
}
