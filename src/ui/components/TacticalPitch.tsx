import { useId } from 'react';
import type { Player } from '../../engine/models';
import { formationSlots } from '../../engine/league';
import { positionLabels } from '../utils';
import styles from '../App.module.css';

export function TacticalPitch({ formation = '4-4-2', players = [] }: { formation?: string; players?: Player[] }) {
  const patternId = useId();
  const lines = formation.split('-').map(Number);
  const positions = formationSlots(formation);
  const locations = [{ x: 180, y: 397 }];
  lines.forEach((count, row) => {
    for (let index = 0; index < count; index++) locations.push({ x: 24 + (index + 1) / (count + 1) * 312, y: 330 - row / (lines.length - 1) * 240 });
  });
  return <svg viewBox="0 0 360 440" className={styles.tacticalPitch} role="img" aria-label={`Campo tático na formação ${formation}`}>
    <defs><pattern id={patternId} width="360" height="80" patternUnits="userSpaceOnUse"><rect width="360" height="40" fill="var(--pitch-dark)" /><rect y="40" width="360" height="40" fill="var(--pitch-light)" /></pattern></defs>
    <rect width="360" height="440" rx="8" fill={`url(#${patternId})`} />
    <g stroke="var(--pitch-line)" strokeWidth="1.5" fill="none"><rect x="18" y="18" width="324" height="404" /><path d="M18 220h324M96 18v65h168V18M135 18v25h90V18M96 422v-65h168v65M135 422v-25h90v25" /><circle cx="180" cy="220" r="43" /><circle cx="180" cy="220" r="2" /></g>
    {locations.map(({ x, y }, index) => <g key={index}><circle cx={x} cy={y} r="17" fill="var(--pitch-node)" stroke="var(--text)" strokeWidth="1.5" /><text x={x} y={y + 4} textAnchor="middle" fill="var(--text)" fontSize="9" fontWeight="700">{positionLabels[positions[index]]}</text>{players[index] && <text x={x} y={y + 31} textAnchor="middle" fill="var(--text)" fontSize="9" fontWeight="600">{players[index].name.split(' ').at(-1)}</text>}</g>)}
  </svg>;
}
