import { useId } from 'react';
import type { CSSProperties } from 'react';
import styles from '../App.module.css';

export function ClubBadge({ name, size = 'small' }: { name: string; size?: 'small' | 'large' }) {
  const clipId = useId();
  const initials = name.split(' ').filter((word) => word.length > 2).slice(0, 2).map((word) => word[0]).join('');
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const colors = ['green', 'blue', 'red', 'gold', 'purple'];
  return <span aria-hidden="true" className={`${styles.clubBadge} ${size === 'large' ? styles.badgeLarge : ''}`} style={{ '--club-color': `var(--club-${colors[hash % colors.length]})` } as CSSProperties}>
    <svg viewBox="0 0 64 76" fill="none"><defs><clipPath id={clipId}><path d="M4 5h56v33c0 16-16 29-28 34C20 67 4 54 4 38V5Z" /></clipPath></defs>
      <path d="M2 3h60v35c0 18-17 31-30 37C19 69 2 56 2 38V3Z" fill="var(--text)" />
      <g clipPath={`url(#${clipId})`}><path d="M4 5h56v67H4z" fill="var(--club-color)" /><path d="M4 12h56v9H4zM4 36h56v9H4zM4 60h56v9H4z" fill="var(--bg)" opacity=".75" /><path d="M32 5v67" stroke="var(--white-line)" strokeWidth="2" /></g>
      <path d="M8 9h48v29c0 13-13 25-24 30C21 63 8 51 8 38V9Z" stroke="var(--white-line)" />
      <text x="32" y="33" textAnchor="middle" fill="var(--text)" stroke="var(--bg)" strokeWidth="3" paintOrder="stroke" fontSize="18" fontWeight="800" fontFamily="inherit">{initials}</text>
    </svg>
  </span>;
}
