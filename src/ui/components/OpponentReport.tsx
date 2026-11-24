import type { Career } from '../../engine/career/career';
import { competitionTeams } from '../../engine/career/cup';
import { opponentReport } from '../../engine/career/insights';
import { nextManagedMatch } from '../../engine/career/progression';
import { worldLeagues } from '../../engine/career/world';
import { Panel } from './Panel';
import styles from '../App.module.css';

export function OpponentReport({ career }: { career: Career }) {
  const { opponentId } = nextManagedMatch(career);
  const opponent = competitionTeams(career).find((team) => team.id === opponentId);
  if (!opponent) return null;
  const league = worldLeagues(career).find((division) => division.teams.some((team) => team.id === opponent.id));
  const matches = (league?.schedule ?? []).flatMap((round) => round.matches)
    .filter((match) => match.status === 'finished' && !match.forfeitTeamIds?.length && (match.homeTeamId === opponent.id || match.awayTeamId === opponent.id))
    .slice(-5);
  const notes = opponentReport(matches, opponent.id);
  return <Panel title={`Relatório do adversário · ${opponent.name}`} icon="lineup">
    {notes.length
      ? <ul className={styles.keyInsights}>{notes.map((note) => <li key={note}>{note}</li>)}</ul>
      : <p className={styles.tableNote}>Os dados aparecem após os primeiros jogos de liga do adversário.</p>}
  </Panel>;
}
