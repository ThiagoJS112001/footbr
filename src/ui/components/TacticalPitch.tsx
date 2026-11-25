import { useId, type HTMLAttributes } from 'react';
import type { Player } from '../../engine/models';
import { formationRows } from '../../engine/league/lineup';
import { formationLabel, positionLabels } from '../utils';
import styles from '../App.module.css';

export function TacticalPitch({ formation = '4-4-2', players = [], variant = 'standard', getSlotProps }: {
  formation?: string;
  players?: (Player | undefined)[];
  variant?: 'standard' | 'overview' | 'lineup';
  getSlotProps?: (index: number) => HTMLAttributes<HTMLDivElement>;
}) {
  const patternId = useId();
  const rows = formationRows(formation);
  const label = `Campo tático na formação ${formationLabel(formation)}`;
  const depth = rows.length === 5 ? 272 : 240;
  const locations = [{ x: 180, y: 397, position: 'GK' as const, scale: 1 }, ...rows.flatMap((row, line) =>
    row.map((position, index) => ({
      x: 24 + (index + 1) / (row.length + 1) * 312,
      y: 330 - line / (rows.length - 1) * depth,
      position,
      scale: row.length > 4 ? .8 : 1,
    })))];
  if (variant === 'overview') return <svg viewBox="0 0 360 208" className={styles.tacticalPitch} role="img" aria-label={label}>
    <defs><linearGradient id={patternId} x2="0" y2="1"><stop stopColor="#0b402b" /><stop offset="1" stopColor="#05291f" /></linearGradient></defs>
    <path d="M58 6H302L354 202H6Z" fill={`url(#${patternId})`} stroke="#21eb57" strokeWidth="1.5" />
    <path d="M32 104H328M135 6L130 36H230L225 6M100 202L108 157H252L260 202M143 202L146 183H214L217 202" fill="none" stroke="#21eb57" opacity=".7" />
    <ellipse cx="180" cy="104" rx="36" ry="20" fill="none" stroke="#21eb57" opacity=".7" />
    {locations.map(({ x, y }, index) => <path key={index} d="M-6-11L-14-6L-11 1L-7-1V12H7V-1L11 1L14-6L6-11Q0-6-6-11Z"
      transform={`translate(${180 + (x - 180) * (.58 + y / 1000)}, ${6 + y * .44})`} fill={index ? '#13da56' : '#f7db31'} />)}
  </svg>;
  return <svg viewBox="0 0 360 440" preserveAspectRatio={variant === 'lineup' ? 'none' : undefined} className={styles.tacticalPitch} role="img" aria-label={label}>
    <defs><pattern id={patternId} width="360" height="80" patternUnits="userSpaceOnUse"><rect width="360" height="40" fill="var(--pitch-dark)" /><rect y="40" width="360" height="40" fill="var(--pitch-light)" /></pattern></defs>
    <rect width="360" height="440" rx="8" fill={`url(#${patternId})`} />
    <g stroke="var(--pitch-line)" strokeWidth="1.5" fill="none"><rect x="18" y="18" width="324" height="404" /><path d="M18 220h324M96 18v65h168V18M135 18v25h90V18M96 422v-65h168v65M135 422v-25h90v25" /><circle cx="180" cy="220" r="43" /><circle cx="180" cy="220" r="2" /></g>
    {locations.map(({ x, y, position, scale }, index) => {
      const player = players[index];
      if (variant === 'lineup') {
        const parts = player?.name.split(' ') ?? [];
        const name = parts.length > 1 ? `${parts[0][0]}. ${parts.at(-1)}` : parts[0];
        const nodeY = index === 0 ? y - 20 : y - 26;
        const fitness = Math.round(player?.fitness ?? 0);
        return <g key={index} transform={`translate(${x}, ${nodeY}) scale(${scale}, 1)`}>
          {player && !getSlotProps && <title>{player.name}</title>}
          <path d="M-6-14L-18-8L-21 3L-11 7L-9 3V17H9V3L11 7L21 3L18-8L6-14Q0-8-6-14Z" fill={index ? '#174c86' : '#008f3a'} stroke="#d6e5f3" strokeWidth="1.4" />
          <text y="8" textAnchor="middle" fill="white" fontSize="9" fontWeight="750">{positionLabels[position]}</text>
          {player && <><rect x="-31" y="18" width="62" height="33" rx="5" fill="#071c22" stroke="#315158" />
            <text y="30" textAnchor="middle" fill="white" fontSize="7.5" fontWeight="650">{name && name.length > 14 ? `${name.slice(0, 13)}…` : name}</text>
            <rect x="-25" y="34" width="20" height="13" rx="3" fill="#008e35" />
            <text x="-15" y="44" textAnchor="middle" fill="white" fontSize="8" fontWeight="750">{player.overall}</text>
            <g role="meter" aria-label={`Condição física de ${player.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={fitness}>
              <text x="12" y="40" textAnchor="middle" fill="white" fontSize="7" fontWeight="650">{fitness}%</text>
              <rect x="-1" y="43" width="26" height="4" rx="2" fill="#254553" />
              <rect x="-1" y="43" width={26 * fitness / 100} height="4" rx="2" fill="var(--accent)" />
            </g></>}
          {getSlotProps && <foreignObject x="-26" y="-15" width="52" height="67">
            <div title={player?.name} {...getSlotProps(index)} />
          </foreignObject>}
        </g>;
      }
      return <g key={index}><circle cx={x} cy={y} r="17" fill="var(--pitch-node)" stroke="var(--text)" strokeWidth="1.5" /><text x={x} y={y + 4} textAnchor="middle" fill="var(--text)" fontSize="9" fontWeight="700">{positionLabels[position]}</text>{player && <text x={x} y={y + 31} textAnchor="middle" fill="var(--text)" fontSize="9" fontWeight="600">{player.name.split(' ').at(-1)}</text>}</g>;
    })}
  </svg>;
}
