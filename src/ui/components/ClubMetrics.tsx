import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import views from '../screens/ClubViews.module.css';

export function ClubMetrics({ items }: { items: { icon: IconName; label: string; value: ReactNode }[] }) {
  return <div className={views.metrics}>{items.map(({ icon, label, value }) => <div key={label} className={views.metric}>
    <Icon name={icon} size={32} /><span>{label}<strong>{value}</strong></span>
  </div>)}</div>;
}

export function Level({ value, label }: { value: number; label?: string }) {
  return <span className={views.inline}>
    <progress aria-label={label ?? `${Math.round(value)}%`} max={100} value={value} className={views.progress} />
    <span>{Math.round(value)}%</span>
  </span>;
}
