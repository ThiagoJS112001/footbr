import { useId } from 'react';
import type { Player } from '../../engine/models';
import { formationSlots } from '../../engine/league';
import { positionLabels } from '../utils';
import styles from '../App.module.css';

export function TacticalPitch({ formation = '4-4-2', players = [], variant = 'standard' }: { formation?: string; players?: Player[]; variant?: 'standard' | 'overview' }) {
  const patternId = useId();
  const lines = formation.split('-').map(Number);
  const positions = formationSlots(formation);
  const locations = [{ x: 180, y: 397 }];
  lines.forEach((count, row) => {
    for (let index = 0; index < count; index++) locations.push({ x: 24 + (index + 1) / (count + 1) * 312, y: 330 - row / (lines.length - 1) * 240 });
  });
  if (variant === 'overview') return <svg viewBox="0 0 360 208" className={styles.tacticalPitch} role="img" aria-label={`Campo tático na formação ${formation}`}>
    <defs><linearGradient id={patternId} x2="0" y2="1"><stop stopColor="#0b402b" /><stop offset="1" stopColor="#05291f" /></linearGradient></defs>
    <path d="M58 6H302L354 202H6Z" fill={`url(#${patternId})`} stroke="#21eb57" strokeWidth="1.5" />
    <path d="M32 104H328M135 6L130 36H230L225 6M100 202L108 157H252L260 202M143 202L146 183H214L217 202" fill="none" stroke="#21eb57" opacity=".7" />
    <ellipse cx="180" cy="104" rx="36" ry="20" fill="none" stroke="#21eb57" opacity=".7" />
    {locations.map(({ x, y }, index) => <path key={index} d="M-6-11L-14-6L-11 1L-7-1V12H7V-1L11 1L14-6L6-11Q0-6-6-11Z"
      transform={`translate(${180 + (x - 180) * (.58 + y / 1000)}, ${6 + y * .44})`} fill={index ? '#13da56' : '#f7db31'} />)}
  </svg>;
  return <svg viewBox="0 0 360 440" className={styles.tacticalPitch} role="img" aria-label={`Campo tático na formação ${formation}`}>
    <defs><pattern id={patternId} width="360" height="80" patternUnits="userSpaceOnUse"><rect width="360" height="40" fill="var(--pitch-dark)" /><rect y="40" width="360" height="40" fill="var(--pitch-light)" /></pattern></defs>
    <rect width="360" height="440" rx="8" fill={`url(#${patternId})`} />
    <g stroke="var(--pitch-line)" strokeWidth="1.5" fill="none"><rect x="18" y="18" width="324" height="404" /><path d="M18 220h324M96 18v65h168V18M135 18v25h90V18M96 422v-65h168v65M135 422v-25h90v25" /><circle cx="180" cy="220" r="43" /><circle cx="180" cy="220" r="2" /></g>
    {locations.map(({ x, y }, index) => <g key={index}><circle cx={x} cy={y} r="17" fill="var(--pitch-node)" stroke="var(--text)" strokeWidth="1.5" /><text x={x} y={y + 4} textAnchor="middle" fill="var(--text)" fontSize="9" fontWeight="700">{positionLabels[positions[index]]}</text>{players[index] && <text x={x} y={y + 31} textAnchor="middle" fill="var(--text)" fontSize="9" fontWeight="600">{players[index].name.split(' ').at(-1)}</text>}</g>)}
  </svg>;
}
