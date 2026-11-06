import { pendingCupRound } from '../../engine/career/cup';
import { careerConfig } from '../../engine/career/config';
import { worldTeams } from '../../engine/career/world';
import { careerOf, useGameStore } from '../store/gameStore';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { ClubBadge } from '../components/ClubBadge';
import styles from '../App.module.css';

export function CupScreen() {
  const state = useGameStore();
  const career = careerOf(state);
  const cup = career.systems.cup;
  const teams = new Map(worldTeams(career).map((t) => [t.id, t]));
  const pending = pendingCupRound(career);
  return <><PageHeader eyebrow="UM JOGO PODE MUDAR TUDO" title={cup.name} description="40 clubes · Jogo único · Empate decidido nos pênaltis · Seis etapas durante a liga" />
    {cup.status === 'deferred' ? <p className={styles.notice}>Esta carreira foi carregada de uma versão anterior. A copa começa na próxima temporada, preservando as partidas já disputadas.</p> : <>
      {cup.championId && <p className={styles.notice}>Campeão: {teams.get(cup.championId)!.name}</p>}
      <div className={styles.controls}>{pending && <span className={styles.muted}>Próxima etapa: {pending.name}, após a rodada {pending.afterRound} da liga.</span>}<button className={styles.primaryButton} onClick={() => state.navigate('lineup')}>Preparar próximo compromisso</button></div>
      <p className={styles.rulesNote}>A preliminar reúne 16 clubes sorteados; os outros 24 entram na segunda fase. A copa acrescenta desgaste, cartões e lesões. Rodadas sem seu clube são resolvidas automaticamente.</p>
      {cup.rounds.map((round) => <Panel title={`${round.name} · após rodada ${round.afterRound}`} icon="cup" key={round.round}><ul className={styles.compactList}>{round.matches.map((match) => <li key={match.id} className={match.homeTeamId === career.selectedTeamId || match.awayTeamId === career.selectedTeamId ? styles.selectedRow : ''}><span className={styles.cupClub}><ClubBadge name={teams.get(match.homeTeamId)!.name} image={teams.get(match.homeTeamId)!.identity?.facts.image} />{teams.get(match.homeTeamId)!.name}</span><strong className={styles.nowrap}>{match.score ? `${match.score.home}–${match.score.away}` : '×'}{match.penalties && <small>Pên. {match.penalties.home}–{match.penalties.away}</small>}</strong><span className={styles.cupClub}><ClubBadge name={teams.get(match.awayTeamId)!.name} image={teams.get(match.awayTeamId)!.identity?.facts.image} />{teams.get(match.awayTeamId)!.name}{match.winnerTeamId && <small>Classificado: {teams.get(match.winnerTeamId)!.name}</small>}</span></li>)}</ul></Panel>)}
      <Panel title="Calendário das etapas" icon="calendar"><ul className={styles.compactList}>{careerConfig.cupNames.map((name, index) => <li key={name}><span>{name}</span><span>Após rodada {careerConfig.cupWeeks[index]}</span></li>)}</ul></Panel>
    </>}
  </>;
}
