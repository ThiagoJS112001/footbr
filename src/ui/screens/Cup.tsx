import { competitionTeams, pendingCupRound } from '../../engine/career/cup';
import type { Career } from '../../engine/career/career';
import type { Cup } from '../../engine/career/types';
import { careerConfig } from '../../engine/career/config';
import { useGameStore } from '../store/gameStore';
import { Panel } from '../components/Panel';
import { ClubBadge } from '../components/ClubBadge';
import styles from '../App.module.css';

export function CupBracket({ career, cup }: { career: Career; cup: Cup }) {
  const { navigate } = useGameStore();
  const teams = new Map(competitionTeams(career).map((t) => [t.id, t]));
  const pending = pendingCupRound(career, cup);
  const timing = (week: number) => week === 0 ? 'Antes da liga' : 'Após rodada ' + week;
  return <>
    {cup.status === 'deferred' ? <p className={styles.notice}>Esta carreira foi carregada de uma versão anterior. A copa começa na próxima temporada, preservando as partidas já disputadas.</p> : <>
      {cup.championId && <p className={styles.notice}>Campeão: {teams.get(cup.championId)!.name}</p>}
      <div className={styles.controls}>{pending && <span className={styles.muted}>Próxima etapa: {pending.name}, {timing(pending.afterRound).toLowerCase()}.</span>}<button className={styles.primaryButton} onClick={() => navigate('lineup')}>Preparar próximo compromisso</button></div>
      {!cup.weeks && <p className={styles.rulesNote}>{cup.rounds[0].matches.length * 2} clubes na preliminar e {cup.byeTeamIds.length} com vaga direta na segunda fase.</p>}
      {cup.rounds.map((round) => <Panel title={`${round.name} · ${timing(round.afterRound)}`} icon="cup" key={round.round}><ul className={styles.compactList}>{round.matches.map((match) => <li key={match.id} className={match.homeTeamId === career.selectedTeamId || match.awayTeamId === career.selectedTeamId ? styles.selectedRow : ''}><span className={styles.cupClub}><ClubBadge name={teams.get(match.homeTeamId)!.name} image={teams.get(match.homeTeamId)!.identity?.facts.image} />{teams.get(match.homeTeamId)!.name}</span><strong className={styles.nowrap}>{match.score ? `${match.score.home}–${match.score.away}` : '×'}{match.penalties && <small>Pên. {match.penalties.home}–{match.penalties.away}</small>}</strong><span className={styles.cupClub}><ClubBadge name={teams.get(match.awayTeamId)!.name} image={teams.get(match.awayTeamId)!.identity?.facts.image} />{teams.get(match.awayTeamId)!.name}{match.winnerTeamId && <small>Classificado: {teams.get(match.winnerTeamId)!.name}</small>}</span></li>)}</ul></Panel>)}
      <Panel title="Calendário das etapas" icon="calendar"><ul className={styles.compactList}>{(cup.weeks ?? careerConfig.cupWeeks).map((week, index) => <li key={index}><span>{cup.weeks ? ['Quartas de final', 'Semifinal', 'Final'][3 - cup.weeks.length + index] : careerConfig.cupNames[index]}</span><span>{timing(week)}</span></li>)}</ul></Panel>
    </>}
  </>;
}
