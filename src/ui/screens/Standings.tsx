import type { League } from '../../engine/models';
import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { StandingsTable } from '../components/StandingsTable';
import { PageHeader } from '../components/PageHeader';
import styles from '../App.module.css';

export function Standings({ league: own, selectedTeamId }: { league: League; selectedTeamId: string }) {
  const other = useGameStore((s) => s.otherLeague);
  const [alternate, setAlternate] = useState(false);
  const league = alternate && other ? other : own;
  return <><PageHeader eyebrow="A DISPUTA PELO TÍTULO" title="Classificação" description={`${league.name} · Turno e returno · ${league.teams.length} clubes`} />
    {other && <div className={styles.controls}><button className={alternate ? styles.secondaryButton : styles.primaryButton} onClick={() => setAlternate(false)}>Minha divisão</button><button className={alternate ? styles.primaryButton : styles.secondaryButton} onClick={() => setAlternate(true)}>Outra divisão</button></div>}
    <section className={styles.panel}><div className={styles.panelHeading}><h2>Tabela do campeonato</h2><div className={styles.legend}>{league.rules.promotionSpots > 0 && <span><i className={styles.greenDot} />Acesso</span>}{league.rules.relegationSpots > 0 && <span><i className={styles.redDot} />Rebaixamento</span>}</div></div><StandingsTable league={league} selectedTeamId={selectedTeamId} /><div className={styles.tableNote}>P: pontos · J: jogos · V: vitórias · E: empates · D: derrotas · GP: gols pró · GC: gols contra · SG: saldo de gols</div></section>
    <p className={styles.rulesNote}>Desempate: pontos, vitórias, saldo, gols pró, confronto direto e sorteio. Zonas provisórias até o encerramento da temporada.</p>
  </>;
}
