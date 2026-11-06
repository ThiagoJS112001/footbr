import { useState } from 'react';
import { getTopScorers } from '../../engine/league';
import { currentPlayerRecords } from '../../engine/career/history';
import { careerOf, useGameStore } from '../store/gameStore';
import { PageHeader } from '../components/PageHeader';
import { DataTable } from '../components/DataTable';
import { Panel, StatCard } from '../components/Panel';
import { currency } from '../utils';
import styles from '../App.module.css';

export function History() {
  const state = useGameStore();
  const career = careerOf(state);
  const { league, season, history, news, selectedTeamId, systems } = career;
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState('club');
  const scorers = getTopScorers(league);
  const players = [...systems.playerHistory, ...currentPlayerRecords(career)].filter((p) => (scope === 'world' || p.teamId === selectedTeamId) && p.playerName.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))).sort((a, b) => b.season - a.season || b.goals - a.goals);
  const records = systems.clubHistory.filter((r) => r.teamId === selectedTeamId);
  const best = [...records].sort((a, b) => a.division - b.division || a.position - b.position || b.points - a.points)[0];
  const win = [...records].sort((a, b) => b.biggestWinMargin - a.biggestWinMargin)[0];
  return <><PageHeader eyebrow="MEMÓRIA DO CLUBE" title="História e artilharia" description={`Temporada ${season} · Campanhas, títulos, recordes, jogadores e transferências preservados.`} />
    <div className={styles.metricGrid}><StatCard label="Títulos de liga do clube" value={String(records.filter((r) => r.leagueTitle).length)} /><StatCard label="Copas do clube" value={String(records.filter((r) => r.cupTitle).length)} /><StatCard label="Melhor campanha concluída" value={best ? `${best.position}º · Divisão ${best.division}` : 'A construir'} detail={best ? `T${best.season} · ${best.points} pontos` : ''} /><StatCard label="Maior goleada registrada" value={win?.biggestWin ?? 'A construir'} /></div>
    <div className={styles.managerGrid}><Panel title="Artilharia da divisão" icon="standings"><DataTable caption="Artilharia" rows={scorers} getRowId={(p) => p.playerId} columns={[
      { id: 'name', label: 'Jogador', render: (p) => p.playerName }, { id: 'club', label: 'Clube do primeiro gol', render: (p) => p.teamName }, { id: 'goals', label: 'Gols', render: (p) => <strong>{p.goals}</strong> },
    ]} /></Panel><Panel title="Notícias do clube e do mercado" icon="news"><ul className={styles.compactList}>{news.map((item, index) => <li key={index}>{item}</li>)}</ul></Panel></div>
    <Panel title="Histórico individual · todas as temporadas" icon="squad"><div className={styles.controls}><label className={styles.filterLabel}>Buscar jogador no histórico<input value={search} onChange={(e) => setSearch(e.target.value)} /></label><label className={styles.filterLabel}>Abrangência<select value={scope} onChange={(e) => setScope(e.target.value)}><option value="club">Jogadores do clube, inclusive ex-atletas</option><option value="world">Todos os clubes</option></select></label></div><DataTable caption="Histórico dos jogadores" rows={players} pageSize={20} getRowId={(p) => `${p.season}-${p.teamId}-${p.playerId}`} columns={[
      { id: 'season', label: 'Temp.', render: (p) => p.season }, { id: 'name', label: 'Jogador', render: (p) => p.playerName }, { id: 'team', label: 'Clube', render: (p) => p.teamName },
      { id: 'games', label: 'J', render: (p) => p.appearances }, { id: 'minutes', label: 'Min.', render: (p) => p.minutes }, { id: 'goals', label: 'Gols', render: (p) => p.goals }, { id: 'titles', label: 'Títulos', render: (p) => p.titles.join(', ') || '—' },
    ]} /></Panel>
    <Panel title="Transferências do mundo" icon="market"><DataTable caption="Histórico de transferências" rows={[...systems.transfers].reverse()} pageSize={20} getRowId={(t) => t.id} columns={[
      { id: 'season', label: 'Temp.', render: (t) => t.season }, { id: 'round', label: 'Rodada', render: (t) => t.round }, { id: 'name', label: 'Jogador', render: (t) => t.playerName },
      { id: 'from', label: 'Origem', render: (t) => t.fromName }, { id: 'to', label: 'Destino', render: (t) => t.toName }, { id: 'fee', label: 'Valor', align: 'right', render: (t) => currency(t.fee) },
    ]} /></Panel>
    <Panel title="Campanhas concluídas com o treinador" icon="history">{history.length ? history.map((item) => <article className={styles.historyItem} key={item.season}><h3>Temporada {item.season} · {item.teamName ?? 'Seu clube'} · Divisão {item.division} · {item.position}º lugar</h3><p>{item.points} pontos · Campeão: {item.champion}</p><p>Artilheiro: {item.topScorer} · Copa: {item.cupChampion ?? 'Não registrada'}</p><p>Acesso: {item.promoted.join(', ')}</p><p>Rebaixamento: {item.relegated.join(', ')}</p></article>) : <p className={styles.tableNote}>As campanhas e os recordes são arquivados ao começar a próxima temporada. Os dados da temporada atual já aparecem acima.</p>}</Panel>
  </>;
}
