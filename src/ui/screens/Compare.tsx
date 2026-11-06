import { comparePlayers } from '../../engine/career/history';
import { careerOf, useGameStore } from '../store/gameStore';
import { useUiStore } from '../store/uiStore';
import { ownTeam, worldTeams } from '../../engine/career/world';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { currency, positionLabels } from '../utils';
import styles from '../App.module.css';

export function CompareScreen() {
  const career = careerOf(useGameStore());
  const prefs = useUiStore();
  const all = [...worldTeams(career).flatMap((t) => t.squad), ...career.freeAgents];
  const team = ownTeam(career);
  const left = all.find((p) => p.id === prefs.compareLeft) ?? team.squad[0];
  const right = all.find((p) => p.id === prefs.compareRight) ?? team.squad.find((p) => p.id !== left.id)!;
  const options = prefs.compareSearch ? all.filter((p) => p.name.toLocaleLowerCase('pt-BR').includes(prefs.compareSearch.toLocaleLowerCase('pt-BR'))).slice(0, 60) : team.squad;
  const choices = [...new Map([left, right, ...options].map((p) => [p.id, p])).values()];
  const rows = comparePlayers(left, right);
  return <><PageHeader eyebrow="DECIDA COM OS MESMOS CRITÉRIOS" title="Comparar jogadores" description="Compare força, características e custo antes de contratar ou escolher um titular." />
    <section className={styles.panel}><div className={styles.controls}><label className={styles.filterLabel}>Buscar no mundo<input value={prefs.compareSearch} onChange={(e) => useUiStore.setState({ compareSearch: e.target.value })} placeholder="Digite um nome" /></label>
      <label className={styles.filterLabel}>Jogador A<select value={left.id} onChange={(e) => useUiStore.setState({ compareLeft: e.target.value })}>{choices.map((p) => <option key={p.id} value={p.id}>{p.name} · {positionLabels[p.primaryPosition]}</option>)}</select></label>
      <label className={styles.filterLabel}>Jogador B<select value={right.id} onChange={(e) => useUiStore.setState({ compareRight: e.target.value })}>{choices.map((p) => <option key={p.id} value={p.id}>{p.name} · {positionLabels[p.primaryPosition]}</option>)}</select></label></div><p className={styles.tableNote}>Sem busca, a lista mostra seu elenco. A busca inclui os dois campeonatos e jogadores livres; mostra até 60 resultados.</p></section>
    <Panel title={`${left.name} × ${right.name}`} icon="compare"><div className={styles.compareTable}><div className={styles.compareRow}><strong>{positionLabels[left.primaryPosition]}</strong><span>Atributo</span><strong>{positionLabels[right.primaryPosition]}</strong></div>{rows.map((row) => {
      const money = row.label.includes('Salário') || row.label.includes('mercado');
      const leftBetter = row.left !== row.right && (row.higherIsBetter ? row.left > row.right : row.left < row.right);
      return <div className={styles.compareRow} key={row.label}><strong className={leftBetter ? styles.accent : ''}>{money ? currency(row.left) : row.left}</strong><span>{row.label}</span><strong className={!leftBetter && row.left !== row.right ? styles.accent : ''}>{money ? currency(row.right) : row.right}</strong></div>;
    })}</div><p className={styles.tableNote}>Verde indica o maior atributo ou o menor custo/idade. Posição, estilo e condição também entram na decisão; a força isolada não garante melhor desempenho.</p></Panel>
  </>;
}
