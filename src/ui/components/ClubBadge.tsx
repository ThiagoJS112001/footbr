import styles from '../App.module.css';

export function ClubBadge({ name, size = 'small' }: { name: string; size?: 'small' | 'large' }) {
  const initials = name.split(' ').filter((word) => word.length > 2).slice(0, 2).map((word) => word[0]).join('');
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const hue = hash % 360;
  return <span aria-hidden="true" className={`${styles.clubBadge} ${size === 'large' ? styles.badgeLarge : ''}`} style={{ backgroundColor: `hsl(${hue} 24% 19%)`, color: `hsl(${hue} 50% 78%)` }}>{initials}</span>;
}
