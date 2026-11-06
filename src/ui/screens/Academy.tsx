import { careerOf, useGameStore } from '../store/gameStore';
import { prospectSalary } from '../../engine/career/academy';
import { careerConfig } from '../../engine/career/config';
import { ownTeam } from '../../engine/career/world';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { currency, positionLabels } from '../utils';
import styles from '../App.module.css';

export function AcademyScreen() {
  const state = useGameStore();
  const career = careerOf(state);
  const { academy } = career.systems;
  const team = ownTeam(career);
  return <><PageHeader eyebrow="FORME A PRÓXIMA GERAÇÃO" title="Categorias de Base" description={`Cinco jovens por temporada. Avalie e promova até três: ${academy.promoted}/3 promoções utilizadas.`} />
    <p className={styles.notice}>A avaliação custa {currency(careerConfig.assessmentFee)} e revela o teto de evolução. Promover sem avaliar é uma aposta. Jovens evoluem conforme idade, potencial e minutos em campo.</p>
    <div className={styles.prospectGrid}>{academy.prospects.map(({ player, assessed, status }) => {
      const salary = prospectSalary(player.overall);
      const available = status === 'available' && career.systems.board.status === 'active';
      return <Panel key={player.id} title={player.name} icon="academy"><div className={styles.prospectBody}><div className={styles.prospectHeading}><span className={styles.positionTag}>{positionLabels[player.primaryPosition]}</span><span>{player.age} anos</span><span className={styles.rating}>{player.overall}</span></div>
        <dl className={styles.financeSummary}><div><dt>Potencial</dt><dd>{assessed ? `${player.potential} · teto estimado` : 'Ainda não avaliado'}</dd></div><div><dt>Salário mensal</dt><dd>{currency(salary)}</dd></div><div><dt>Luvas de promoção</dt><dd>{currency(salary * 2)}</dd></div></dl>
        <p className={styles.muted}>{status === 'promoted' ? 'Já faz parte do elenco profissional.' : status === 'released' ? 'Dispensado desta seleção da base.' : assessed ? player.potential! - player.overall >= 15 ? 'Boa margem de evolução. Precisa jogar para se desenvolver.' : 'Evolução mais limitada; pode ser uma opção de composição de elenco.' : 'O departamento de base ainda não emitiu um parecer.'}</p></div>
        <div className={styles.controls}><button className={styles.secondaryButton} disabled={!available || assessed || team.budget < careerConfig.assessmentFee} onClick={() => state.assessYouth(player.id)}>Avaliar {player.name}</button><button className={styles.primaryButton} disabled={!available || academy.promoted >= 3 || team.budget < salary * 2 || team.squad.length >= 35} onClick={() => state.promoteYouth(player.id)}>Promover {player.name}</button><button className={styles.textButton} disabled={!available} onClick={() => state.releaseYouth(player.id)}>Dispensar</button></div>
      </Panel>;
    })}</div>
  </>;
}
