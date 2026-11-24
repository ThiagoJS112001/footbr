import { useState } from 'react';
import type { Team, Tactic } from '../../engine/models';
import { autoPickLineup, formationSlots, formations } from '../../engine/league';
import { nextCupEvent } from '../../engine/career/progression';
import { worldTeams } from '../../engine/career/world';
import { presetLabels, type LineupPreset } from '../../engine/career/preparation';
import { playerTrait, traitInfo } from '../../engine/models/personality';
import { careerOf, useGameStore } from '../store/gameStore';
import { ClubBadge } from '../components/ClubBadge';
import { Level } from '../components/ClubMetrics';
import { DataTable } from '../components/DataTable';
import { Icon } from '../components/Icon';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { TacticalPitch } from '../components/TacticalPitch';
import { PreparationChecklist } from '../components/PreparationChecklist';
import { OpponentReport } from '../components/OpponentReport';
import { positionLabels } from '../utils';
import styles from '../App.module.css';
import views from './ClubViews.module.css';

export function LineupScreen({ team }: { team: Team }) {
  const state = useGameStore();
  const { lineup: saved, updateTactic, pickPlayer, toggleReserve, autoLineup, kickOff, league, systems } = state;
  const [tab, setTab] = useState('Escalação');
  const [group, setGroup] = useState('Titulares');
  const career = careerOf(state);
  const cup = nextCupEvent(career);
  const pending = league?.schedule.find((round) => round.matches.some((match) => match.status !== 'finished'));
  const fixture = (cup?.round.matches ?? pending?.matches)?.find((match) => match.status !== 'finished' && (match.homeTeamId === team.id || match.awayTeamId === team.id));
  const clubs = worldTeams(career);
  const home = clubs.find((club) => club.id === fixture?.homeTeamId);
  const away = clubs.find((club) => club.id === fixture?.awayTeamId);
  let lineup = saved;
  let unavailable = '';
  try { lineup ??= autoPickLineup(team, undefined, true); } catch (error) { unavailable = (error as Error).message; }
  const tactic = lineup?.tactic ?? team.defaultTactic;
  const slots = formationSlots(tactic.formation);
  const available = team.squad.filter((p) => !p.injury && !p.discipline.suspendedMatches);
  const starters = (lineup?.starterIds ?? []).flatMap((id) => team.squad.filter((p) => p.id === id));
  const reserves = team.squad.filter((p) => lineup?.substituteIds.includes(p.id));
  const unselected = team.squad.filter((p) => !lineup?.starterIds.includes(p.id) && !lineup?.substituteIds.includes(p.id));
  const average = (attribute: 'overall' | 'fitness' | 'morale') => Math.round(starters.reduce((total, p) => total + p[attribute], 0) / (starters.length || 1));
  const complete = !pending && !cup;

  return <>
    <PageHeader eyebrow="ESCALAÇÃO E TÁTICA" title="Escalação e tática" description="Defina o time, a formação e a estratégia para a próxima partida.">
      {home && away && <div className={views.fixture}>
        <ClubBadge name={home.name} image={home.identity?.facts.image} /><strong>{home.name}</strong><span>×</span>
        <ClubBadge name={away.name} image={away.identity?.facts.image} /><strong>{away.name}</strong>
        <span className={styles.pill}><Icon name="cup" size={16} />{cup ? `${cup.cup.name} · ${cup.round.name}` : `${league?.name} · Rodada ${pending?.round}`}</span>
      </div>}
    </PageHeader>
    <div className={views.tabs}>{(['Escalação', 'Tática', 'Instruções'] as const).map((name, index) => <button key={name} aria-pressed={tab === name} className={tab === name ? styles.primaryButton : styles.secondaryButton} onClick={() => setTab(name)}><Icon name={(['lineup', 'target', 'news'] as const)[index]} size={17} />{name}</button>)}</div>
    {unavailable && <p className={styles.error}>{unavailable} Contrate jogadores ou acompanhe a rodada com W.O.</p>}
    {tab === 'Escalação' && <div className={`${views.split} ${views.lineup}`}>
      <Panel title="Configurações táticas" icon="lineup" className={views.surface}>
        <div className={views.tacticControls}>
          <label className={styles.filterLabel}>Formação<select value={tactic.formation} onChange={(e) => updateTactic({ formation: e.target.value as Tactic['formation'] })}>{formations.map((f) => <option key={f}>{f}</option>)}</select></label>
          <label className={styles.filterLabel}>Postura<select value={tactic.style} onChange={(e) => updateTactic({ style: e.target.value as Tactic['style'] })}><option value="defensive">Defensiva</option><option value="balanced">Equilibrada</option><option value="attacking">Ofensiva</option></select></label>
          <label className={styles.filterLabel}>Marcação<select value={tactic.markingIntensity} onChange={(e) => updateTactic({ markingIntensity: e.target.value as Tactic['markingIntensity'] })}><option value="low">Leve</option><option value="medium">Normal</option><option value="high">Intensa</option></select></label>
          <button className={styles.secondaryButton} onClick={() => setTab('Instruções')}><Icon name="news" size={17} />Instruções da equipe</button>
        </div>
      </Panel>
      <section className={`${styles.panel} ${views.pitch}`}>
        <span className={styles.pill}>{tactic.formation}</span>
        <TacticalPitch formation={tactic.formation} players={starters} variant="lineup" />
      </section>
      <section className={`${styles.panel} ${views.surface} ${views.lineupTable} ${views.dense}`}>
        <div className={`${views.tabs} ${views.tableTabs}`}>
          {[{ name: 'Titulares', count: starters.length }, { name: 'Reservas', count: reserves.length }, { name: 'Não relacionados', count: unselected.length }].map(({ name, count }) =>
            <button key={name} aria-pressed={group === name} className={group === name ? styles.primaryButton : styles.secondaryButton} onClick={() => setGroup(name)}>{name} ({count})</button>)}
        </div>
        {group === 'Titulares' ? <DataTable caption="Titulares" rows={slots.map((position, index) => ({ position, index, player: starters[index] }))} getRowId={(row) => String(row.index)} columns={[
          { id: 'name', label: 'Jogador', render: ({ index, position }) => <select aria-label={`Titular ${index + 1} · ${positionLabels[position]}`} value={lineup?.starterIds[index] ?? ''} onChange={(e) => pickPlayer(index, e.target.value)}>
            {!lineup && <option value="">Sem jogador</option>}
            {available.filter((p) => p.primaryPosition === position || p.secondaryPosition === position)
              .sort((a, b) => b.overall - a.overall).map((p) => <option value={p.id} key={p.id} title={traitInfo[playerTrait(p)].label}>{p.name}{p.primaryPosition !== position ? ' · secundária' : ''}</option>)}
          </select> },
          { id: 'position', label: 'Posição', render: ({ position }) => <span className={styles.positionTag}>{positionLabels[position]}</span> },
          { id: 'overall', label: 'Força', render: ({ player }) => player ? <span className={styles.rating}>{player.overall}</span> : '—' },
          { id: 'fitness', label: 'Condição', render: ({ player }) => player ? <Level value={player.fitness} /> : '—' },
        ]} /> : <DataTable caption={group} rows={group === 'Reservas' ? reserves : unselected} getRowId={(p) => p.id} columns={[
          { id: 'name', label: 'Jogador', render: (p) => <label className={views.inline}><input type="checkbox" aria-label={`Reserva ${p.name}`} checked={reserves.includes(p)} disabled={!lineup || !!p.injury || !!p.discipline.suspendedMatches} onChange={() => toggleReserve(p.id)} />{p.name}</label> },
          { id: 'position', label: 'Posição', render: (p) => <span className={styles.positionTag}>{positionLabels[p.primaryPosition]}</span> },
          { id: 'overall', label: 'Força', render: (p) => <span className={styles.rating}>{p.overall}</span> },
          { id: 'fitness', label: 'Condição', render: (p) => p.injury ? 'Lesionado' : p.discipline.suspendedMatches ? 'Suspenso' : <Level value={p.fitness} /> },
        ]} />}
      </section>
    </div>}
    {tab === 'Tática' && <>
      <OpponentReport career={career} />
      <div className={styles.presetBar} aria-label="Escalações salvas">{(Object.keys(presetLabels) as LineupPreset[]).map((name) => <div className={styles.presetSlot} key={name}>
        <strong>{presetLabels[name]}</strong>
        <button className={styles.secondaryButton} disabled={!systems.savedLineups.some((p) => p.name === name && p.teamId === team.id)} onClick={() => state.loadPreset(name)}>Usar {presetLabels[name]}</button>
        <button className={styles.textButton} disabled={!lineup} onClick={() => state.savePreset(name)}>Salvar {presetLabels[name]}</button>
      </div>)}</div>
    </>}
    {tab === 'Instruções' && <Panel title="Instruções da equipe" icon="news" className={views.surface}>
      <div className={views.tacticControls}>
        <label className={views.inline}><input type="checkbox" checked={tactic.markingIntensity === 'high'} onChange={(e) => updateTactic({ markingIntensity: e.target.checked ? 'high' : 'medium' })} />Marcação mais intensa</label>
        <p className={styles.muted}>A marcação intensa aumenta o risco de cartões. A postura ofensiva aumenta a criação e a exposição da defesa.</p>
        <PreparationChecklist team={team} lineup={lineup} career={career} />
      </div>
    </Panel>}
    <div className={`${styles.panel} ${views.surface} ${views.bottomBar}`}>
      <div className={views.inline}>
        <span className={styles.muted}>Força média<strong>{average('overall')}</strong></span>
        <span className={styles.muted}>Condição média<strong>{average('fitness')}%</strong></span>
        <span className={styles.muted}>Moral<strong>{average('morale')}%</strong></span>
      </div>
      <button className={styles.secondaryButton} onClick={autoLineup}>Escalar automaticamente</button>
      <button className={styles.primaryButton} disabled={complete || systems.board.status === 'dismissed'} onClick={kickOff}><Icon name="match" size={17} />{complete ? 'Temporada concluída' : lineup ? 'Jogar partida' : 'Acompanhar rodada com W.O.'}</button>
    </div>
  </>;
}
