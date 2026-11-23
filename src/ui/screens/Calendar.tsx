import type { League } from '../../engine/models';
import { ClubBadge } from '../components/ClubBadge';
import { PageHeader } from '../components/PageHeader';
import { padRound } from '../utils';
import { allCups, competitionTeams, managedCup } from '../../engine/career/cup';
import { careerOf, useGameStore } from '../store/gameStore';
import { useUiStore } from '../store/uiStore';
import styles from '../App.module.css';

export function Calendar({ league, selectedTeamId, currentRound }: { league: League; selectedTeamId: string; currentRound: number }) {
  const { calendarOnlyMine: onlyMine } = useUiStore();
  const setOnlyMine = (value: boolean) => useUiStore.setState({ calendarOnlyMine: value });
  const state = useGameStore();
  const career = careerOf(state);
  const stateCup = managedCup(career, 'state');
  const cups = allCups(career).filter((cup) => !career.systems.stateCups?.includes(cup) || cup === stateCup);
  const names = new Map(competitionTeams(career).map((team) => [team.id, team.name]));
  const cupFixtures = (week: number) => cups.flatMap((cup) => cup.rounds.filter((round) => round.afterRound === week).flatMap((round) => round.matches.filter((match) => match.homeTeamId === selectedTeamId || match.awayTeamId === selectedTeamId).map((match) => <p key={match.id} className={styles.tableNote}>{cup.name} · {round.name} · {names.get(match.homeTeamId)} {match.score ? match.score.home + '–' + match.score.away : '×'} {names.get(match.awayTeamId)}</p>)));
  const teams = new Map(league.teams.map((team) => [team.id, team]));
  return <><PageHeader eyebrow="CADA RODADA, UMA HISTÓRIA" title="Calendário" description={`${league.schedule.length} rodadas. Acompanhe o caminho até a decisão.`}><label className={styles.filterLabel}>Exibir jogos<select value={onlyMine ? 'mine' : 'all'} onChange={(event) => setOnlyMine(event.target.value === 'mine')}><option value="all">Todos os clubes</option><option value="mine">Somente meu clube</option></select></label></PageHeader>
    <div className={styles.controls}><button className={styles.secondaryButton} onClick={() => state.navigate('cup')}>Ver chaves das copas</button></div>
    {stateCup && <section className={styles.panel}><h2>Antes da liga</h2>{cupFixtures(0)}</section>}
    <div className={styles.roundList}>{league.schedule.map((round) => {
      const finished = round.matches.every((match) => match.status === 'finished');
      const matches = round.matches.filter((match) => !onlyMine || match.homeTeamId === selectedTeamId || match.awayTeamId === selectedTeamId);
      return <details className={styles.roundCard} key={round.round} open={round.round === currentRound}>
        <summary><span><strong>Rodada {padRound(round.round)}</strong><small>{round.round <= league.schedule.length / 2 ? 'TURNO' : 'RETURNO'}</small></span><span className={finished ? styles.finishedTag : round.round === currentRound ? styles.currentTag : styles.subtleTag}>{finished ? 'Concluída' : round.round === currentRound ? 'Próxima rodada' : 'A disputar'}</span></summary>
        <ul>{matches.map((match) => <li key={match.id} className={match.homeTeamId === selectedTeamId || match.awayTeamId === selectedTeamId ? styles.ownMatch : ''}>
          <span className={styles.calendarHome}>{teams.get(match.homeTeamId)!.name}<ClubBadge name={teams.get(match.homeTeamId)!.name} image={teams.get(match.homeTeamId)!.identity?.facts.image} /></span>
          <strong className={styles.calendarScore} aria-label={match.score ? `Placar ${match.score.home} a ${match.score.away}` : 'Jogo a disputar'}>{match.score ? `${match.score.home} – ${match.score.away}` : '×'}{match.forfeitTeamIds?.length ? <small>W.O.</small> : null}</strong>
          <span className={styles.calendarAway}><ClubBadge name={teams.get(match.awayTeamId)!.name} image={teams.get(match.awayTeamId)!.identity?.facts.image} />{teams.get(match.awayTeamId)!.name}</span>
        </li>)}</ul>
        {cupFixtures(round.round)}
      </details>;
    })}</div>
  </>;
}
