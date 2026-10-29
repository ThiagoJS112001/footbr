import { useState } from 'react';
import type { League } from '../../engine/models';
import { ClubBadge } from '../components/ClubBadge';
import { PageHeader } from '../components/PageHeader';
import { padRound } from '../utils';
import styles from '../App.module.css';

export function Calendar({ league, selectedTeamId, currentRound }: { league: League; selectedTeamId: string; currentRound: number }) {
  const [onlyMine, setOnlyMine] = useState(false);
  const teams = new Map(league.teams.map((team) => [team.id, team]));
  return <><PageHeader eyebrow="CADA RODADA, UMA HISTÓRIA" title="Calendário" description={`${league.schedule.length} rodadas. Acompanhe o caminho até a decisão.`}><label className={styles.filterLabel}>Exibir jogos<select value={onlyMine ? 'mine' : 'all'} onChange={(event) => setOnlyMine(event.target.value === 'mine')}><option value="all">Todos os clubes</option><option value="mine">Somente meu clube</option></select></label></PageHeader>
    <div className={styles.roundList}>{league.schedule.map((round) => {
      const finished = round.matches.every((match) => match.status === 'finished');
      const matches = round.matches.filter((match) => !onlyMine || match.homeTeamId === selectedTeamId || match.awayTeamId === selectedTeamId);
      return <details className={styles.roundCard} key={round.round} open={round.round === currentRound}>
        <summary><span><strong>Rodada {padRound(round.round)}</strong><small>{round.round <= league.schedule.length / 2 ? 'TURNO' : 'RETURNO'}</small></span><span className={finished ? styles.finishedTag : round.round === currentRound ? styles.currentTag : styles.subtleTag}>{finished ? 'Concluída' : round.round === currentRound ? 'Próxima rodada' : 'A disputar'}</span></summary>
        <ul>{matches.map((match) => <li key={match.id} className={match.homeTeamId === selectedTeamId || match.awayTeamId === selectedTeamId ? styles.ownMatch : ''}>
          <span className={styles.calendarHome}>{teams.get(match.homeTeamId)!.name}<ClubBadge name={teams.get(match.homeTeamId)!.name} /></span>
          <strong className={styles.calendarScore} aria-label={match.score ? `Placar ${match.score.home} a ${match.score.away}` : 'Jogo a disputar'}>{match.score ? `${match.score.home} – ${match.score.away}` : '×'}{match.forfeitTeamIds?.length ? <small>W.O.</small> : null}</strong>
          <span className={styles.calendarAway}><ClubBadge name={teams.get(match.awayTeamId)!.name} />{teams.get(match.awayTeamId)!.name}</span>
        </li>)}</ul>
      </details>;
    })}</div>
  </>;
}
