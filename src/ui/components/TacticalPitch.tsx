import { useId, type HTMLAttributes } from 'react';
import type { Player } from '../../engine/models';
import { formationRows } from '../../engine/league/lineup';
import { formationLabel, positionLabels } from '../utils';
import styles from '../App.module.css';

export function TacticalPitch({ formation = '4-4-2', players = [], variant = 'standard', getSlotProps, ratingCards }: {
  formation?: string;
  players?: (Player | undefined)[];
  variant?: 'standard' | 'overview' | 'lineup' | 'match';
  getSlotProps?: (index: number) => HTMLAttributes<HTMLDivElement>;
  ratingCards?: readonly { name: string; rating?: number; minutes?: number }[];
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
  if (variant === 'match') return <svg viewBox="0 0 360 224" className={styles.tacticalPitch} role="img" aria-label={label}>
    <defs><linearGradient id={patternId} x2="0" y2="1"><stop stopColor="#154e2d" /><stop offset="1" stopColor="#082b23" /></linearGradient></defs>
    <path d="M32 5H328L355 219H5Z" fill={`url(#${patternId})`} stroke="#60a37d" strokeWidth="1.5" />
    <path d="M18 112H342M95 5L90 50H270L265 5M135 5V23H225V5M85 219L91 174H269L275 219M133 219V200H227V219" fill="none" stroke="#60a37d" />
    <ellipse cx="180" cy="112" rx="37" ry="21" fill="none" stroke="#60a37d" />
    {locations.map(({ x, y, position }, index) => {
      const player = players[index];
      if (!player) return null;
      const parts = player.name.split(' ');
      const name = parts.length > 1 ? `${parts[0][0]}. ${parts.at(-1)}` : parts[0];
      return <g key={index} transform={`translate(${180 + (x - 180) * (.84 + y / 3000)}, ${index === 0 ? 196 : 9 + y * .45})`}>
        {!getSlotProps && <title>{player.name}</title>}
        <path d="M-5-10L-12-6L-14 1L-7 4V11H7V4L14 1L12-6L5-10Q0-5-5-10Z" fill={index ? '#174c86' : '#008f3a'} stroke="#d6e5f3" />
        <text y="4" textAnchor="middle" fill="white" fontSize="6.5" fontWeight="750">{positionLabels[position]}</text>
        <rect x="-26" y="11" width="52" height="12" rx="4" fill="#071c22" />
        <text y="20" textAnchor="middle" fill="white" fontSize="6.7" fontWeight="650">{name.length > 14 ? `${name.slice(0, 13)}…` : name}</text>
        {getSlotProps && <foreignObject x="-24" y="-10" width="48" height="33">
          <div title={player.name} {...getSlotProps(index)} />
        </foreignObject>}
      </g>;
    })}
  </svg>;
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
        const rated = ratingCards?.[index];
        const fullName = rated?.name ?? player?.name;
        const parts = fullName?.split(' ') ?? [];
        const name = parts.length > 1 ? `${parts[0][0]}. ${parts.at(-1)}` : parts[0];
        const nodeY = index === 0 ? y - 20 : y - 26;
        const fitness = Math.round(player?.fitness ?? 0);
        return <g key={index} transform={`translate(${x}, ${nodeY}) scale(${scale}, 1)`}>
          {fullName && !getSlotProps && <title>{fullName}{rated?.minutes !== undefined ? ` · ${rated.minutes} min` : ''}</title>}
          <path d="M-6-14L-18-8L-21 3L-11 7L-9 3V17H9V3L11 7L21 3L18-8L6-14Q0-8-6-14Z" fill={index ? '#174c86' : '#008f3a'} stroke="#d6e5f3" strokeWidth="1.4" />
          <text y="8" textAnchor="middle" fill="white" fontSize="9" fontWeight="750">{positionLabels[position]}</text>
          {(player || rated) && <><rect x="-31" y="18" width="62" height="33" rx="5" fill="#071c22" stroke="#315158" />
            <text y="30" textAnchor="middle" fill="white" fontSize="7.5" fontWeight="650">{name && name.length > 14 ? `${name.slice(0, 13)}…` : name}</text>
          </>}
          {rated && <>
            <rect x="-12" y="34" width="24" height="13" rx="3" fill="#008e35" />
            <text y="44" textAnchor="middle" fill="white" fontSize="8" fontWeight="750">{rated.rating?.toFixed(1).replace('.', ',') ?? '—'}</text>
          </>}
          {player && <>
            <rect x="-25" y="34" width="20" height="13" rx="3" fill="#008e35" />
            <text x="-15" y="44" textAnchor="middle" fill="white" fontSize="8" fontWeight="750">{player.overall}</text>
            <g role="meter" aria-label={`Condição física de ${player.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={fitness}>
              <text x="12" y="40" textAnchor="middle" fill="white" fontSize="7" fontWeight="650">{fitness}%</text>
              <rect x="-1" y="43" width="26" height="4" rx="2" fill="#254553" />
              <rect x="-1" y="43" width={26 * fitness / 100} height="4" rx="2" fill="var(--accent)" />
            </g></>}
          {player?.injury && <text x="19" y="-5" fill="#ff8888" fontSize="10" fontWeight="750">✚</text>}
          {!!player?.discipline.suspendedMatches && <rect x="21" y="0" width="6" height="8" rx="1.2" fill={player.discipline.redSuspension ? '#e94646' : '#ffcd49'} />}
          {!!player?.discipline.yellowCards && <text x="-26" y="10" fill="#ffcd49" fontSize="6.5" fontWeight="750">{player.discipline.yellowCards}/3</text>}
          {getSlotProps && <foreignObject x="-26" y="-15" width="52" height="67">
            <div title={player?.injury || player?.discipline.suspendedMatches
              ? `${player.name} · ${player.injury ? 'Lesionado' : 'Suspenso'}` : player?.name} {...getSlotProps(index)} />
          </foreignObject>}
        </g>;
      }
      return <g key={index}><circle cx={x} cy={y} r="17" fill="var(--pitch-node)" stroke="var(--text)" strokeWidth="1.5" /><text x={x} y={y + 4} textAnchor="middle" fill="var(--text)" fontSize="9" fontWeight="700">{positionLabels[position]}</text>{player && <text x={x} y={y + 31} textAnchor="middle" fill="var(--text)" fontSize="9" fontWeight="600">{player.name.split(' ').at(-1)}</text>}</g>;
    })}
  </svg>;
}
