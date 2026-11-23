import type { League } from '../../engine/models';
import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { StandingsTable } from '../components/StandingsTable';
import { PageHeader } from '../components/PageHeader';
import styles from '../App.module.css';

export function Standings({ league: own, selectedTeamId }: { league: League; selectedTeamId: string }) {
  const other = useGameStore((s) => s.otherLeague);
  const [divisionId, setDivisionId] = useState(own.id);
  const extra = useGameStore((s) => s.extraLeague);
  const divisions = [own, other, extra].filter((item): item is League => !!item).sort((a, b) => a.teams[0].division - b.teams[0].division);
  const league = divisions.find((item) => item.id === divisionId) ?? own;
  return <><PageHeader eyebrow="A DISPUTA PELO TÍTULO" title="Classificação" description={`${league.name} · Turno e returno · ${league.teams.length} clubes`} />
    <div className={styles.controls}>{divisions.map((item) => <button key={item.id} className={league.id === item.id ? styles.primaryButton : styles.secondaryButton} onClick={() => setDivisionId(item.id)}>Divisão {item.teams[0].division}</button>)}</div>
    <section className={styles.panel}><div className={styles.panelHeading}><h2>Tabela do campeonato</h2><div className={styles.legend}>{league.rules.promotionSpots > 0 && <span><i className={styles.greenDot} />Acesso</span>}{league.rules.relegationSpots > 0 && <span><i className={styles.redDot} />Rebaixamento</span>}</div></div><StandingsTable league={league} selectedTeamId={selectedTeamId} /><div className={styles.tableNote}>P: pontos · J: jogos · V: vitórias · E: empates · D: derrotas · GP: gols pró · GC: gols contra · SG: saldo de gols</div></section>
    {extra && league.teams[0].division === 1 && <p className={styles.rulesNote}>Vagas para a próxima temporada. O campeão da Copa dos Horizontes e os melhores da Divisão 1 formam os quatro representantes da Copa Continental. Os quatro seguintes disputam a Copa Sul dos Horizontes.</p>}
    <p className={styles.rulesNote}>Desempate: pontos, vitórias, saldo, gols pró, confronto direto e sorteio. Zonas provisórias até o encerramento da temporada.</p>
  </>;
}
