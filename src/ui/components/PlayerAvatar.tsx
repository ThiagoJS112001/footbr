import { Icon } from './Icon';
import styles from '../App.module.css';
import type { Player } from '../../engine/models';
import { LicensedImage } from './LicensedImage';

/** Silhueta de uniforme: identificação visual, sem inventar retratos dos atletas. */
export function PlayerAvatar({ player }: { player?: Player }) {
  return <span className={styles.playerAvatar} aria-hidden="true"><LicensedImage image={player?.identity?.facts.image} fallback={<><span /><Icon name="shirt" size={30} /></>} /></span>;
}
