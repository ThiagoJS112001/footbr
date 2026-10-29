import type { League } from '../../engine/models';
import { StandingsTable } from '../components/StandingsTable';
import { PageHeader } from '../components/PageHeader';
import styles from '../App.module.css';

export function Standings({ league, selectedTeamId }: { league: League; selectedTeamId: string }) {
  return <><PageHeader eyebrow="A DISPUTA PELO TÍTULO" title="Classificação" description={`${league.name} · Turno e returno · ${league.teams.length} clubes`} />
    <section className={styles.panel}><div className={styles.panelHeading}><h2>Tabela do campeonato</h2><div className={styles.legend}><span><i className={styles.greenDot} />Classificação</span><span><i className={styles.redDot} />Rebaixamento</span></div></div><StandingsTable league={league} selectedTeamId={selectedTeamId} /><div className={styles.tableNote}>P: pontos · J: jogos · V: vitórias · E: empates · D: derrotas · GP: gols pró · GC: gols contra · SG: saldo de gols</div></section>
    <p className={styles.rulesNote}>Desempate: pontos, vitórias, saldo, gols pró, confronto direto e sorteio. Zonas provisórias até o encerramento da temporada.</p>
  </>;
}
