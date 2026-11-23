import { useState } from 'react';
import { allCups, competitionTeams, managedCup, pendingCupRound } from '../../engine/career/cup';
import { careerConfig } from '../../engine/career/config';
import { careerOf, useGameStore } from '../store/gameStore';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { ClubBadge } from '../components/ClubBadge';
import styles from '../App.module.css';

export function CupScreen() {
  const state = useGameStore();
  const career = careerOf(state);
  const cups = allCups(career).filter((cup) => !career.systems.stateCups?.includes(cup) || cup === managedCup(career, 'state'));
  const [cupId, setCupId] = useState(career.systems.cup.id);
  const cup = cups.find((item) => item.id === cupId) ?? cups[0];
  const teams = new Map(competitionTeams(career).map((t) => [t.id, t]));
  const pending = pendingCupRound(career, cup);
  const timing = (week: number) => week === 0 ? 'Antes da liga' : 'Após rodada ' + week;
  return <><PageHeader eyebrow="UM JOGO PODE MUDAR TUDO" title={cup.name} description="Eliminatórias em jogo único, com pênaltis em caso de empate." />
    {cups.length > 1 && <div className={styles.controls}>{cups.map((item) => <button key={item.id} className={cup.id === item.id ? styles.primaryButton : styles.secondaryButton} onClick={() => setCupId(item.id)}>{item.name}</button>)}</div>}
    {cup.status === 'deferred' ? <p className={styles.notice}>Esta carreira foi carregada de uma versão anterior. A copa começa na próxima temporada, preservando as partidas já disputadas.</p> : <>
      {cup.championId && <p className={styles.notice}>Campeão: {teams.get(cup.championId)!.name}</p>}
      <div className={styles.controls}>{pending && <span className={styles.muted}>Próxima etapa: {pending.name}, {timing(pending.afterRound).toLowerCase()}.</span>}<button className={styles.primaryButton} onClick={() => state.navigate('lineup')}>Preparar próximo compromisso</button></div>
      {!cup.weeks && <p className={styles.rulesNote}>{cup.rounds[0].matches.length * 2} clubes na preliminar e {cup.byeTeamIds.length} com vaga direta na segunda fase.</p>}
      {cup.rounds.map((round) => <Panel title={`${round.name} · ${timing(round.afterRound)}`} icon="cup" key={round.round}><ul className={styles.compactList}>{round.matches.map((match) => <li key={match.id} className={match.homeTeamId === career.selectedTeamId || match.awayTeamId === career.selectedTeamId ? styles.selectedRow : ''}><span className={styles.cupClub}><ClubBadge name={teams.get(match.homeTeamId)!.name} image={teams.get(match.homeTeamId)!.identity?.facts.image} />{teams.get(match.homeTeamId)!.name}</span><strong className={styles.nowrap}>{match.score ? `${match.score.home}–${match.score.away}` : '×'}{match.penalties && <small>Pên. {match.penalties.home}–{match.penalties.away}</small>}</strong><span className={styles.cupClub}><ClubBadge name={teams.get(match.awayTeamId)!.name} image={teams.get(match.awayTeamId)!.identity?.facts.image} />{teams.get(match.awayTeamId)!.name}{match.winnerTeamId && <small>Classificado: {teams.get(match.winnerTeamId)!.name}</small>}</span></li>)}</ul></Panel>)}
      <Panel title="Calendário das etapas" icon="calendar"><ul className={styles.compactList}>{(cup.weeks ?? careerConfig.cupWeeks).map((week, index) => <li key={index}><span>{cup.weeks ? ['Quartas de final', 'Semifinal', 'Final'][3 - cup.weeks.length + index] : careerConfig.cupNames[index]}</span><span>{timing(week)}</span></li>)}</ul></Panel>
    </>}
  </>;
}
