import { careerOf, useGameStore } from '../store/gameStore';
import { Panel } from './Panel';
import { managedCup } from '../../engine/career/cup';
import { tacticalWindows } from '../../engine/career/insights';
import { currency } from '../utils';
import styles from '../App.module.css';

export function RoundReview({ compact = false }: { compact?: boolean }) {
  const state = useGameStore();
  const career = careerOf(state);
  const summary = career.systems.lastSummary;
  if (!summary || summary.teamId !== career.selectedTeamId) return null;
  const schedule = summary.competition === 'league' ? career.league.schedule : managedCup(career, summary.competition)?.rounds;
  const match = schedule?.find((round) => round.round === summary.round)?.matches.find((m) => m.homeTeamId === summary.teamId || m.awayTeamId === summary.teamId);
  const goals = match?.events.filter((event) => event.type === 'goal') ?? [];
  const windows = match && !compact ? tacticalWindows(match, summary.teamId) : [];
  return <Panel title={`Resumo · ${summary.title}`} icon={summary.competition === 'league' ? 'history' : 'cup'} className={styles.roundReview} aria-live="polite">
    <p className={styles.reviewResult}>{summary.result}</p><div className={styles.reviewMetrics}><span><strong>{summary.position}º</strong> na liga {summary.positionChange ? `(${summary.positionChange > 0 ? '+' : ''}${summary.positionChange})` : ''}</span><span className={summary.moneyChange < 0 ? styles.loss : styles.accent}>{currency(summary.moneyChange)} no saldo</span><span>{summary.absences.length} desfalque(s)</span></div>
    {!compact && <><ul className={styles.keyInsights}>{summary.notes.slice(0, 3).map((note, i) => <li key={i}>{note}</li>)}</ul><details className={styles.reviewDetails}><summary>Entender a partida e os desfalques</summary><ul>{summary.notes.slice(3).map((note, i) => <li key={i}>{note}</li>)}{summary.absences.map((note) => <li key={note}>{note}</li>)}{summary.notes.length <= 3 && !summary.absences.length && <li>Sem outros destaques ou desfalques.</li>}</ul></details><div className={styles.controls}><button className={styles.textButton} onClick={() => state.navigate('squad')}>Revisar elenco</button><button className={styles.textButton} onClick={() => state.navigate('finances')}>Conferir finanças</button></div></>}
    {compact && <><p className={styles.tableNote}>{summary.points} pontos na liga</p>{goals.length > 0 && <ul className={styles.keyInsights}>{goals.map((event, index) => <li key={index}>{event.minute}′ · {event.playerName ?? 'Gol'}</li>)}</ul>}{summary.absences.length > 0 && <ul className={styles.keyInsights}>{summary.absences.map((note) => <li key={note}>{note}</li>)}</ul>}</>}
    {windows.length > 0 && <details className={styles.reviewDetails}>
      <summary>Finalizações antes e depois das mudanças</summary>
      <p className={styles.tableNote}>Os recortes mostram o que aconteceu em campo. Outros lances e decisões também influenciam os números.</p>
      <ul>{windows.map(({ minute, label, length, before, after }) => <li key={minute}>
        <strong>{minute}′ · {label}</strong><br />
        {length} min antes: {before[0]} a favor, {before[1]} contra. {length} min depois: {after[0]} a favor, {after[1]} contra.
      </li>)}</ul>
    </details>}
    {compact && <div className={styles.controls}><button className={styles.textButton} onClick={() => state.navigate('match')}>Ver análise da última partida</button></div>}
  </Panel>;
}
