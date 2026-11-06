import styles from '../App.module.css';

export function ConditionRing({ value }: { value: number }) {
  const condition = Math.max(0, Math.min(100, Math.round(value)));
  return <svg className={styles.conditionRing} viewBox="0 0 120 120" role="img" aria-label={`Condição física média: ${condition}%`}>
    <circle className={styles.ringTrack} cx="60" cy="60" r="50" fill="none" strokeWidth="9" />
    <circle className={condition < 60 ? styles.ringWarning : styles.ringProgress} cx="60" cy="60" r="50" fill="none" strokeWidth="9" strokeLinecap="round" pathLength="100" strokeDasharray={`${condition} 100`} transform="rotate(-90 60 60)" />
    <text x="60" y="59" textAnchor="middle" className={styles.ringValue}>{condition}%</text>
    <text x="60" y="76" textAnchor="middle" className={styles.ringLabel}>Condição física</text>
  </svg>;
}
