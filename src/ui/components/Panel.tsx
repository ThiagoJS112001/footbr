import type { HTMLAttributes, ReactNode } from 'react';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import styles from '../App.module.css';

interface Props extends HTMLAttributes<HTMLElement> {
  title: string;
  icon: IconName;
  action?: ReactNode;
  footer?: ReactNode;
}
export function Panel({ title, icon, action, footer, children, className = '', ...props }: Props) {
  return <section className={`${styles.panel} ${className}`} {...props}>
    <div className={styles.panelHeading}><h2><Icon name={icon} />{title}</h2>{action}</div>
    {children}
    {footer && <div className={styles.panelFooter}>{footer}</div>}
  </section>;
}

export function StatCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <section className={styles.metric}><h2>{label}</h2><strong className={styles.moneyValue}>{value}</strong>{detail && <span>{detail}</span>}</section>;
}
