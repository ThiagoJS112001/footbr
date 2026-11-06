import { Icon } from './Icon';
import styles from '../App.module.css';

/** Silhueta de uniforme: identificação visual, sem inventar retratos dos atletas. */
export function PlayerAvatar() {
  return <span className={styles.playerAvatar} aria-hidden="true"><span /><Icon name="shirt" size={30} /></span>;
}
