import { careerOf, useGameStore } from '../store/gameStore';
import { Panel } from './Panel';
import { currency } from '../utils';
import styles from '../App.module.css';

export function RoundReview({ compact = false }: { compact?: boolean }) {
  const state = useGameStore();
  const career = careerOf(state);
  const summary = career.systems.lastSummary;
  if (!summary || summary.teamId !== career.selectedTeamId) return null;
  return <Panel title={`Resumo · ${summary.title}`} icon={summary.competition === 'cup' ? 'cup' : 'history'} className={styles.roundReview}>
    <p className={styles.reviewResult}>{summary.result}</p><div className={styles.reviewMetrics}><span><strong>{summary.position}º</strong> na liga {summary.positionChange ? `(${summary.positionChange > 0 ? '+' : ''}${summary.positionChange})` : ''}</span><span className={summary.moneyChange < 0 ? styles.loss : styles.accent}>{currency(summary.moneyChange)} no saldo</span><span>{summary.absences.length} desfalque(s)</span></div>
    {!compact && <><ul className={styles.keyInsights}>{summary.notes.slice(0, 3).map((note, i) => <li key={i}>{note}</li>)}</ul><details className={styles.reviewDetails}><summary>Entender a partida e os desfalques</summary><ul>{summary.notes.slice(3).map((note, i) => <li key={i}>{note}</li>)}{summary.absences.map((note) => <li key={note}>{note}</li>)}{summary.notes.length <= 3 && !summary.absences.length && <li>Sem outros destaques ou desfalques.</li>}</ul></details><div className={styles.controls}><button className={styles.textButton} onClick={() => state.navigate('squad')}>Revisar elenco</button><button className={styles.textButton} onClick={() => state.navigate('finances')}>Conferir finanças</button></div></>}
    {compact && <div className={styles.controls}><button className={styles.textButton} onClick={() => state.navigate('match')}>Ver análise da última partida</button></div>}
  </Panel>;
}
