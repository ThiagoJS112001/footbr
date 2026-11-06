import type { Team, Tactic } from '../../engine/models';
import { autoPickLineup } from '../../engine/league';
import { formationSlots, formations } from '../../engine/league/lineup';
import { useGameStore } from '../store/gameStore';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { TacticalPitch } from '../components/TacticalPitch';
import { careerOf } from '../store/gameStore';
import { dueCupRound } from '../../engine/career/cup';
import { positionLabels } from '../utils';
import styles from '../App.module.css';

export function LineupScreen({ team }: { team: Team }) {
  const state = useGameStore();
  const { lineup: saved, updateTactic, pickPlayer, toggleReserve, autoLineup, kickOff, league, systems } = state;
  const cup = dueCupRound(careerOf(state));
  let lineup = saved;
  let unavailable = '';
  try { lineup ??= autoPickLineup(team); } catch (error) { unavailable = (error as Error).message; }
  const complete = league!.schedule.every((r) => r.matches.every((m) => m.status === 'finished'));
  const slots = formationSlots(team.defaultTactic.formation);
  const available = team.squad.filter((p) => !p.injury && !p.discipline.suspendedMatches);
  const starters = new Set(lineup?.starterIds);
  const tactic = lineup?.tactic ?? team.defaultTactic;
  const average = lineup ? Math.round(team.squad.filter((p) => starters.has(p.id)).reduce((s, p) => s + p.fitness, 0) / 11) : 0;
  return <>
    <PageHeader eyebrow="ANTES DO APITO" title="Escalação e tática" description="Escolha os 11 e marque quem vai para o banco. A formação deve respeitar as posições dos jogadores." />
    {cup && <p className={styles.notice}>Próximo compromisso: {systems.cup.name} · {cup.name}. Considere poupar jogadores cansados.</p>}
    <section className={styles.panel}>
      <div className={styles.controls}>
        <label className={styles.filterLabel}>Formação<select value={tactic.formation} onChange={(e) => updateTactic({ formation: e.target.value as Tactic['formation'] })}>{formations.map((f) => <option key={f}>{f}</option>)}</select></label>
        <label className={styles.filterLabel}>Postura<select value={tactic.style} onChange={(e) => updateTactic({ style: e.target.value as Tactic['style'] })}><option value="defensive">Defensiva</option><option value="balanced">Equilibrada</option><option value="attacking">Ofensiva</option></select></label>
        <label className={styles.filterLabel}>Marcação<select value={tactic.markingIntensity} onChange={(e) => updateTactic({ markingIntensity: e.target.value as Tactic['markingIntensity'] })}><option value="low">Leve</option><option value="medium">Normal</option><option value="high">Intensa</option></select></label>
        <button className={styles.secondaryButton} onClick={autoLineup}>Escalar automaticamente</button>
        <button className={styles.primaryButton} disabled={complete && !cup || systems.board.status === 'dismissed'} onClick={kickOff}>{complete && !cup ? 'Temporada concluída' : lineup ? 'Jogar partida' : 'Acompanhar rodada com W.O.'}</button>
      </div>
      <p className={styles.tableNote}>Ofensiva aumenta criação e exposição. Marcação intensa aumenta o risco de cartões. O automático equilibra força e condição. Condição dos titulares: {average}%.</p>
    </section>
    {unavailable && <p className={styles.error}>{unavailable} Contrate jogadores ou acompanhe a rodada com W.O.</p>}
    <div className={styles.managerGrid}>
      <section className={styles.panel}>
        <div className={styles.panelHeading}><h2>Time titular</h2><span className={styles.subtleTag}>{tactic.formation}</span></div>
        <div className={styles.lineupList}>
          {slots.map((position, index) => <label className={styles.lineupSlot} key={`${index}-${position}`}>
            <span className={styles.positionTag}>{positionLabels[position]}</span>
            <select aria-label={`Titular ${index + 1} · ${positionLabels[position]}`} value={lineup?.starterIds[index] ?? ''} onChange={(e) => pickPlayer(index, e.target.value)}>
              {!lineup && <option value="">Sem jogador</option>}
              {available.filter((p) => p.primaryPosition === position || p.secondaryPosition === position).sort((a, b) => b.overall - a.overall).map((p) => <option value={p.id} key={p.id}>{p.name} · F {p.overall} · {Math.round(p.fitness)}%{p.primaryPosition !== position ? ' · secundária' : ''}</option>)}
            </select>
          </label>)}
        </div>
      </section>
      <section className={styles.panel}><div className={styles.panelHeading}><h2>Banco e desfalques</h2><span className={styles.subtleTag}>{lineup?.substituteIds.length ?? 0} RESERVAS</span></div>
        <ul className={styles.compactList}>{team.squad.filter((p) => !starters.has(p.id)).map((p) => <li key={p.id}><input type="checkbox" aria-label={`Reserva ${p.name}`} checked={!!lineup?.substituteIds.includes(p.id)} disabled={!!p.injury || !!p.discipline.suspendedMatches || !lineup} onChange={() => toggleReserve(p.id)} /><span className={styles.grow}><small>{positionLabels[p.primaryPosition]}</small> {p.name}<small>{p.injury ? `Lesão · ${p.injury.remainingDays} dias` : p.discipline.suspendedMatches ? `Suspenso · ${p.discipline.suspendedMatches} jogo(s)` : `Condição ${Math.round(p.fitness)}%`}</small></span><strong className={styles.rating}>{p.overall}</strong></li>)}</ul>
      </section>
    </div>
    {lineup && <Panel title={`Visão tática · ${tactic.formation}`} icon="lineup" className={styles.tacticsPreview}><TacticalPitch formation={tactic.formation} players={lineup.starterIds.map((id) => team.squad.find((p) => p.id === id)!)} /><p className={styles.tableNote}>A prévia acompanha os titulares escolhidos. Use os seletores acima para alterar a equipe.</p></Panel>}
  </>;
}
