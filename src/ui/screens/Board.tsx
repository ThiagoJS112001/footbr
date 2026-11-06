import { availableJobs } from '../../engine/career/board';
import { ownTeam } from '../../engine/career/world';
import { careerOf, useGameStore } from '../store/gameStore';
import { PageHeader } from '../components/PageHeader';
import { Panel, StatCard } from '../components/Panel';
import { ClubBadge } from '../components/ClubBadge';
import { currency } from '../utils';
import styles from '../App.module.css';

export function BoardScreen() {
  const state = useGameStore();
  const career = careerOf(state);
  const board = career.systems.board;
  const team = ownTeam(career);
  const row = career.league.standings.find((r) => r.teamId === team.id)!;
  return <><PageHeader eyebrow="CONFIANÇA E RESULTADOS" title="Diretoria" description={`${team.name} · ${board.status === 'active' ? 'Vínculo ativo' : 'Vínculo encerrado'}`} />
    <div className={styles.metricGrid}><StatCard label="Confiança da diretoria" value={`${board.confidence}%`} /><StatCard label="Meta na liga" value={`Até ${board.targetPosition}º`} /><StatCard label="Posição atual" value={`${row.position}º`} detail={`${row.points} pontos em ${row.played} jogos`} /><StatCard label="Saldo do clube" value={currency(team.budget)} /></div>
    <Panel title="Como a avaliação funciona" icon="board"><p className={styles.tableNote}>A primeira avaliação ocorre após oito rodadas no cargo; depois, a cada quatro rodadas. A diretoria compara os pontos por jogo com a meta e considera dívidas. Confiança em 15% ou menos encerra o vínculo. Uma campanha consistente recupera a confiança.</p></Panel>
    {board.status === 'dismissed' && <Panel title="Propostas para continuar sua carreira" icon="market"><p className={styles.tableNote}>Sua carreira continua no mesmo mundo e na mesma temporada. Escolha um clube interessado para assumir o elenco e uma nova meta.</p><div className={styles.jobGrid}>{availableJobs(career).map((club) => <article className={styles.jobCard} key={club.id}><ClubBadge name={club.name} image={club.identity?.facts.image} size="large" /><h3>{club.name}</h3><p className={styles.muted}>Divisão {club.division} · Reputação {club.reputation}<br />Saldo: {currency(club.budget)}</p><button className={styles.primaryButton} onClick={() => state.acceptJob(club.id)}>Assumir {club.name}</button></article>)}</div></Panel>}
    <Panel title="Avaliações recebidas" icon="history"><ul className={styles.compactList}>{[...board.reviews].reverse().map((review) => <li key={review.round}><span><strong>Rodada {review.round} · {review.confidence}% de confiança</strong><small>{review.note}</small></span></li>)}{!board.reviews.length && <li className={styles.muted}>A diretoria dará tempo para o seu trabalho começar.</li>}</ul></Panel>
  </>;
}
