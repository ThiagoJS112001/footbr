import { useState } from 'react';
import type { Player, PlayerPosition, Team } from '../../engine/models';
import { DataTable } from '../components/DataTable';
import type { Column } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { currency, positionLabels, positionNames } from '../utils';
import styles from '../App.module.css';

const columns: Column<Player>[] = [
  { id: 'name', label: 'Jogador', sortValue: (player) => player.name, render: (player) => <span className={styles.playerName}><strong>{player.name}</strong><small>{player.injury ? `Lesionado · ${player.injury.remainingDays} dias` : player.discipline.suspendedMatches ? `Suspenso · ${player.discipline.suspendedMatches} jogo(s)` : player.nationality}</small></span> },
  { id: 'position', label: 'Posição', sortValue: (player) => positionLabels[player.primaryPosition], render: (player) => <span title={positionNames[player.primaryPosition]} className={styles.positionTag}>{positionLabels[player.primaryPosition]}</span> },
  { id: 'age', label: 'Idade', align: 'center', sortValue: (player) => player.age, render: (player) => player.age },
  { id: 'overall', label: 'Overall', align: 'center', sortValue: (player) => player.overall, render: (player) => <span className={styles.rating}>{player.overall}</span> },
  { id: 'fitness', label: 'Condição física', sortValue: (player) => player.fitness, render: (player) => <Level value={player.fitness} /> },
  { id: 'morale', label: 'Moral', sortValue: (player) => player.morale, render: (player) => <Level value={player.morale} /> },
  { id: 'salary', label: 'Salário mensal', align: 'right', sortValue: (player) => player.contract?.salary ?? 0, render: (player) => player.contract ? currency(player.contract.salary) : '—' },
  { id: 'contract', label: 'Contrato', align: 'right', sortValue: (player) => player.contract?.yearsRemaining ?? 0, render: (player) => player.contract ? `${player.contract.yearsRemaining} ${player.contract.yearsRemaining === 1 ? 'ano' : 'anos'}` : 'Sem contrato' },
];

export function Squad({ team }: { team: Team }) {
  const [position, setPosition] = useState<PlayerPosition | 'all'>('all');
  const players = team.squad.filter((player) => position === 'all' || player.primaryPosition === position);
  return <><PageHeader eyebrow="GESTÃO DO CLUBE" title="Elenco" description="Conheça os jogadores que vão defender a sua camisa."><span className={styles.pill}>{team.squad.length} JOGADORES</span></PageHeader>
    <section className={styles.panel}><div className={styles.tableToolbar}><div><h2>Todos os jogadores</h2><span className={styles.muted}>Clique nos títulos das colunas para ordenar.</span></div><label className={styles.filterLabel}>Filtrar por posição<select value={position} onChange={(event) => setPosition(event.target.value as PlayerPosition | 'all')}><option value="all">Todas as posições</option>{(Object.keys(positionLabels) as PlayerPosition[]).map((key) => <option value={key} key={key}>{positionLabels[key]} · {positionNames[key]}</option>)}</select></label></div>
      <DataTable caption="Elenco do clube" rows={players} columns={columns} getRowId={(player) => player.id} initialSort={{ id: 'overall', direction: 'desc' }} />
      <div className={styles.tableNote}>{players.length} de {team.squad.length} jogadores · Salários em reais por mês.</div>
    </section></>;
}

function Level({ value }: { value: number }) {
  const rounded = Math.round(value);
  return <span className={styles.level}><span className={styles.levelTrack}><span className={rounded < 50 ? styles.levelLow : ''} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></span><span>{rounded}%</span></span>;
}
