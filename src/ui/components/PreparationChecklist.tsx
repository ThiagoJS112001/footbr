import type { Lineup, Team } from '../../engine/models';
import type { Career } from '../../engine/career/career';
import { preparationWarnings } from '../../engine/career/preparation';
import { recentClubMatches } from '../../engine/career/history';
import styles from '../App.module.css';

export function PreparationChecklist({ team, lineup, career }: { team: Team; lineup: Lineup | null; career: Career }) {
  const last = recentClubMatches(career).at(-1);
  const previous = last ? last.homeTeamId === team.id ? last.homeLineup : last.awayLineup : null;
  const warnings = preparationWarnings(team, lineup, previous ?? undefined);
  return warnings.length ? <div className={styles.preparationNotice} aria-label="Avisos para a próxima partida"><strong>Antes de entrar em campo</strong><ul>{warnings.map((note) => <li key={note}>{note}</li>)}</ul></div> : null;
}
