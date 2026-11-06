import styles from '../App.module.css';

export function Brand() {
  return <div className={styles.brand} aria-label="FootBR · Manager de Futebol">
    <svg className={styles.brandMark} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <circle cx="33" cy="26" r="22" fill="var(--text)" stroke="var(--line)" strokeWidth="2" />
      <path d="m33 14 10 7-4 12H27l-4-12 10-7ZM14 17l9 4M43 21l9-4M27 33l-6 10M39 33l7 9M33 4v10" stroke="var(--bg)" strokeWidth="3" fill="var(--bg)" />
      <path d="M4 47c18 1 37-10 54-20-4 13-20 28-42 30l10-10-22 0Z" fill="var(--accent)" />
      <path d="m10 60 15-13 25-6-16 14-24 5Z" fill="var(--accent-dark)" />
    </svg>
    <span className={styles.brandCopy}><strong>Foot<span>BR</span></strong><small>Manager de Futebol</small></span>
  </div>;
}
