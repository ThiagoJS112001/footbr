import type { ReactNode } from 'react';
import styles from '../App.module.css';

export function PageHeader({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: ReactNode }) {
  return <header className={styles.pageHeader}><div><p className={styles.eyebrow}>{eyebrow}</p><h1>{title}</h1><p className={styles.muted}>{description}</p></div>{children}</header>;
}
