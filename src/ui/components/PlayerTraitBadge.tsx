import type { Player } from '../../engine/models';
import { playerTrait, traitInfo } from '../../engine/models/personality';
import styles from '../App.module.css';

export function PlayerTraitBadge({ player, detailed = false }: { player: Player; detailed?: boolean }) {
  const trait = traitInfo[playerTrait(player)];
  return detailed ? <p className={styles.tableNote}><strong>{trait.label}</strong> · {trait.description}</p>
    : <span className={styles.traitBadge} title={trait.description}>{trait.label}</span>;
}
