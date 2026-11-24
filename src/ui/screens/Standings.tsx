import type { League } from '../../engine/models';
import { useState } from 'react';
import { getTopScorers } from '../../engine/league';
import { useGameStore } from '../store/gameStore';
import { ClubMetrics } from '../components/ClubMetrics';
import { Icon } from '../components/Icon';
import { StandingsTable } from '../components/StandingsTable';
import { PageHeader } from '../components/PageHeader';
import { padRound } from '../utils';
import styles from '../App.module.css';
import views from './ClubViews.module.css';

export function Standings({ league: own, selectedTeamId }: { league: League; selectedTeamId: string }) {
  const { otherLeague, extraLeague, season } = useGameStore();
  const [divisionId, setDivisionId] = useState(own.id);
  const divisions = [own, otherLeague, extraLeague].filter((item): item is League => !!item).sort((a, b) => a.teams[0].division - b.teams[0].division);
  const league = divisions.find((item) => item.id === divisionId) ?? own;
  const finished = league.schedule.flatMap((round) => round.matches.filter((m) => m.status === 'finished'));
  const round = league.schedule.find((r) => r.matches.some((m) => m.status !== 'finished'))?.round ?? league.schedule.length;
  const latest = league.schedule.filter((r) => r.matches.some((m) => m.status === 'finished')).at(-1);
  const goals = finished.reduce((sum, m) => sum + (m.score?.home ?? 0) + (m.score?.away ?? 0), 0);
  const clubs = new Map(league.teams.map((team) => [team.id, team.name]));
  const names = new Map(league.teams.flatMap((team) => team.squad.map((player) => [player.id, player.name] as const)));
  const assists = new Map<string, number>();
  for (const { events } of finished) {
    for (const event of events) {
      if (event.type === 'goal' && event.assistPlayerId) assists.set(event.assistPlayerId, (assists.get(event.assistPlayerId) ?? 0) + 1);
    }
  }
  return <>
    <PageHeader eyebrow="A DISPUTA PELO TÍTULO" title="Classificação" description="Acompanhe a tabela, a artilharia e o desempenho da liga.">
      <div className={views.filters}>
        <span className={styles.pill}><Icon name="cup" size={16} />{league.name}</span>
        <label className={styles.filterLabel}>Divisão<select value={league.id} onChange={(event) => setDivisionId(event.target.value)}>{divisions.map((item) => <option key={item.id} value={item.id}>Divisão {item.teams[0].division}</option>)}</select></label>
        <span className={styles.pill}>Temporada {padRound(season)}</span>
      </div>
    </PageHeader>
    <div className={views.tabs}>{divisions.map((item) => <button key={item.id} aria-pressed={league.id === item.id} className={league.id === item.id ? styles.primaryButton : styles.secondaryButton} onClick={() => setDivisionId(item.id)}><Icon name="cup" size={16} />Divisão {item.teams[0].division}</button>)}</div>
    <ClubMetrics items={[
      { label: 'Rodada', value: `${round} de ${league.schedule.length}`, icon: 'lineup' },
      { label: 'Jogos disputados', value: finished.length, icon: 'calendar' },
      { label: 'Gols marcados', value: goals, icon: 'trend' },
      { label: 'Média de gols', value: (finished.length ? goals / finished.length : 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), icon: 'shield' },
    ]} />
    <div className={views.split}>
      <section className={`${styles.panel} ${views.surface} ${views.dense} ${views.standings}`}>
        <div className={styles.panelHeading}><h2><Icon name="cup" />Tabela do campeonato</h2></div>
        <StandingsTable league={league} selectedTeamId={selectedTeamId} />
        <div className={styles.panelHeading}><div className={styles.legend}>
          {(league.rules.promotionSpots > 0 || league.rules.qualificationSpots > 0) && <span><i className={styles.greenDot} />{league.rules.promotionSpots > 0 ? 'Acesso' : 'Classificação continental'}</span>}
          {league.rules.relegationSpots > 0 && <span><i className={styles.redDot} />Rebaixamento</span>}
        </div></div>
      </section>
      <aside className={views.stack}>
        <Ranking key={`goals-${league.id}`} title="Artilharia" unit="gol" entries={getTopScorers(league).map((player) => ({ id: player.playerId, name: player.playerName, value: player.goals }))} />
        <Ranking key={`assists-${league.id}`} title="Assistências" unit="assist." entries={[...assists].sort((a, b) => b[1] - a[1]).map(([id, value]) => ({ id, name: names.get(id) ?? 'Jogador', value }))} />
        <section className={`${styles.panel} ${views.surface}`}>
          <div className={styles.panelHeading}><h2><Icon name="calendar" />Últimos jogos da rodada</h2>{latest && <span className={styles.muted}>Rodada {latest.round}</span>}</div>
          {latest ? <ul className={views.ranking}>{latest.matches.filter((m) => m.status === 'finished' && m.score).map((m) => <li key={m.id}>
            <span>{clubs.get(m.homeTeamId)}</span><strong>{m.score?.home} × {m.score?.away}</strong><span>{clubs.get(m.awayTeamId)}</span>
          </li>)}</ul> : <div className={views.empty}><Icon name="lineup" size={42} /><strong>Ainda não há jogos disputados.</strong><span>A rodada 1 será a primeira da temporada.</span></div>}
        </section>
      </aside>
    </div>
  </>;
}

function Ranking({ title, unit, entries }: { title: string; unit: string; entries: { id: string; name: string; value: number }[] }) {
  const [expanded, setExpanded] = useState(false);
  const rows = entries.length ? entries.slice(0, expanded ? entries.length : 3) : Array.from({ length: 3 }, (_, i) => ({ id: String(i), name: '—', value: 0 }));
  return <section className={`${styles.panel} ${views.surface}`}>
    <div className={styles.panelHeading}><h2><Icon name={unit === 'gol' ? 'target' : 'trend'} />{title}</h2>
      {entries.length > 3 && <button className={styles.textButton} aria-label={`${expanded ? 'Recolher' : 'Ver completa'} · ${title}`} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? 'Recolher' : 'Ver completa'} <Icon name="arrow" size={14} /></button>}
    </div>
    <ol className={views.ranking}>{rows.map((row, index) => <li key={row.id}><span>{index + 1}º</span><Icon name="user" size={16} /><span>{row.name}</span><strong>{row.value} {unit === 'gol' && row.value !== 1 ? 'gols' : unit}</strong></li>)}</ol>
  </section>;
}
