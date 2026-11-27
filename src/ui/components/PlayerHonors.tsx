import type { Career } from '../../engine/career/career';
import { playerAwards } from '../../engine/career/awards';
import { awardLabels } from '../../engine/career/awardTypes';
import type { Player } from '../../engine/models';
import { Icon } from './Icon';
import { Panel } from './Panel';
import styles from '../App.module.css';

export function PlayerHonors({ career, playerId, player }: { career: Pick<Career, 'systems'>; playerId: string; player?: Player }) {
  const honors = playerAwards(career, playerId);
  const seasonalSelections = [...(career.systems.seasonAwards ?? [])].reverse().flatMap(({ season, selection }) => {
    const picked = selection?.players.find((entry) => entry.playerId === playerId);
    return picked ? [{ season, picked }] : [];
  });
  return <Panel title="Conquistas e Premiações" icon="cup">
    {!!player?.marketPrestige?.rate && <p className={styles.tableNote}>Prestígio de mercado +{(player.marketPrestige.rate * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</p>}
    {honors.length || seasonalSelections.length ? <ul className={styles.compactList}>
      {seasonalSelections.map(({ season, picked }) => <li key={`season-${season}`}><span><strong>Seleção da Temporada</strong>
        <small>Temporada {season} · {picked.teamName} · {picked.games} J · Nota {picked.average.toFixed(2).replace('.', ',')}</small></span>
        <Icon name="cup" className={styles.accent} /></li>)}
      {honors.map(({ edition, kind, winner }) =>
      <li key={`${edition.season}-${edition.id}-${kind}`}>
        <span><strong>{awardLabels[kind]}</strong> · {edition.name}
          <small>Temporada {edition.season} · {winner.teamName}</small>
          <small>{winner.games} J · {winner.minutes} min · Nota {winner.average.toFixed(2).replace('.', ',')}
            {winner.position === 'GK' ? ` · ${winner.cleanSheets} sem sofrer gols` : ` · ${winner.goals} G · ${winner.assists} A`}</small>
          {winner.clubs.length > 1 && <small>{winner.clubs.map((club) => `${club.teamName} (${club.games} J, ${club.goals} G, ${club.assists} A)`).join(' · ')}</small>}
        </span><Icon name="cup" className={styles.accent} />
      </li>)}</ul> : <p className={styles.tableNote}>Nenhuma premiação registrada para este jogador.</p>}
  </Panel>;
}
