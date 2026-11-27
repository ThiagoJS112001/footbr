import { useState, type DragEvent, type HTMLAttributes } from 'react';
import type { Player, Team, Tactic } from '../../engine/models';
import { autoPickLineup, formationSlots, formations } from '../../engine/league';
import { maxReserves } from '../../engine/league/lineup';
import { nextCupEvent, seasonComplete } from '../../engine/career/progression';
import { needsSeasonSponsor, seasonSponsorMessage } from '../../engine/career/sponsors';
import { worldTeams } from '../../engine/career/world';
import { presetLabels, type LineupPreset } from '../../engine/career/preparation';
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
import { PlayerStatus } from '../components/PlayerStatus';
import { redCardFine } from '../../engine/career/discipline';
import { currency, formationLabel, positionLabels, positionOrder } from '../utils';
import styles from '../App.module.css';
import views from './ClubViews.module.css';

const comparePlayers = (a: Player, b: Player) =>
  positionOrder(a.primaryPosition) - positionOrder(b.primaryPosition)
  || b.overall - a.overall || a.name.localeCompare(b.name, 'pt-BR');

export function LineupScreen({ team }: { team: Team }) {
  const state = useGameStore();
  const { lineup: saved, updateTactic, pickPlayer, toggleReserve, autoLineup, kickOff, league, systems } = state;
  const [tab, setTab] = useState('Escalação');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const career = careerOf(state);
  const complete = seasonComplete(career);
  const needsSponsor = needsSeasonSponsor(career);
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
  const playersById = new Map(team.squad.map((player) => [player.id, player]));
  const starters = slots.map((_, index) => playersById.get(lineup?.starterIds[index] ?? ''));
  const reserves = (lineup?.substituteIds ?? []).flatMap((id) => playersById.get(id) ?? []);
  const unavailablePlayers = [...starters, ...reserves].filter((p): p is Player => !!p && !!(p.injury || p.discipline.suspendedMatches));
  const unselected = team.squad.filter((p) => !lineup?.starterIds.includes(p.id) && !lineup?.substituteIds.includes(p.id));
  const starterCount = starters.filter(Boolean).length;
  const average = (attribute: 'overall' | 'fitness' | 'morale') => Math.round(starters.reduce((total, p) => total + (p?.[attribute] ?? 0), 0) / (starterCount || 1));

  const dragged = playersById.get(draggedId ?? '');
  const draggedSlot = lineup?.starterIds.indexOf(draggedId ?? '') ?? -1;
  const fromBench = !!lineup?.substituteIds.includes(draggedId ?? '');
  const benchFull = reserves.length >= maxReserves;
  const fits = (player: Player | undefined, index: number) => !!player && !player.injury && !player.discipline.suspendedMatches
    && (player.primaryPosition === slots[index] || player.secondaryPosition === slots[index]);

  const dragSource = (player?: Player): HTMLAttributes<HTMLElement> => {
    if (!lineup || !player) return {};
    const assigned = lineup.starterIds.includes(player.id) || lineup.substituteIds.includes(player.id);
    if (!assigned && (player.injury || player.discipline.suspendedMatches)) return {};
    return {
      draggable: true,
      onDragStart: (event) => {
        event.dataTransfer.setData('text/plain', player.id);
        event.dataTransfer.effectAllowed = 'move';
        setDraggedId(player.id);
      },
      onDragEnd: () => setDraggedId(null),
    };
  };

  const dropTarget = (canDrop: boolean, move: () => void): HTMLAttributes<HTMLElement> => {
    if (!dragged || !canDrop) return {};
    return {
      onDragOver: (event) => {
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'move';
      },
      onDrop: (event: DragEvent<HTMLElement>) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.dataTransfer.getData('text/plain') === dragged.id) move();
        setDraggedId(null);
      },
    };
  };

  const starterDrop = (index: number) => {
    const canDrop = index !== draggedSlot && fits(dragged, index)
      && (draggedSlot < 0 || fits(starters[index], draggedSlot));
    return {
      ...dropTarget(canDrop, () => pickPlayer(index, dragged!.id)),
      className: canDrop ? views.dropSlot : undefined,
    };
  };

  const renderGroup = (name: 'Reservas' | 'Não relacionados') => {
    const bench = name === 'Reservas';
    const moveToGroup = !!dragged && draggedSlot < 0 && fromBench !== bench;
    const rows = [...(bench ? reserves : unselected)].sort(comparePlayers);
    return <Panel title={`${name} (${rows.length}${bench ? `/${maxReserves}` : ''})`} icon={bench ? 'shirt' : 'squad'}
      action={<span className={views.groupDetail}>{bench ? 'Vão para a partida' : 'Fora da partida'}</span>}
      className={`${views.rosterGroup} ${moveToGroup ? views.dropGroup : ''}`}
      {...dropTarget(moveToGroup && (!bench || !benchFull), () => toggleReserve(dragged!.id))}>
      <DataTable caption={name} rows={rows} getRowId={(p) => p.id} getRowProps={(player) => ({
        ...dragSource(player),
        ...dropTarget(draggedSlot >= 0 && fits(player, draggedSlot), () => pickPlayer(draggedSlot, player.id)),
        ...dropTarget(bench && moveToGroup, () => toggleReserve(dragged!.id, player.id)),
        ...dropTarget(!bench && moveToGroup && !player.injury && !player.discipline.suspendedMatches, () => toggleReserve(player.id, dragged!.id)),
        className: draggedSlot >= 0 && fits(player, draggedSlot) ? views.dropSlot : undefined,
      })} columns={[
        { id: 'name', label: 'Jogador', render: (p) => <span className={views.inline}><Icon name="shirt" size={22} className={views.rosterShirt} />{p.name}<PlayerStatus player={p} /></span> },
        { id: 'position', label: 'Posição', render: (p) => <span className={styles.positionTag}>{positionLabels[p.primaryPosition]}</span> },
        { id: 'overall', label: 'Força', render: (p) => <span className={styles.rating}>{p.overall}</span> },
        { id: 'fitness', label: 'Condição', render: (p) => {
          const fine = redCardFine(p, team.id);
          if (!p.injury && !p.discipline.suspendedMatches) return <Level value={p.fitness} />;
          return <span className={views.inline}>
            {p.injury ? 'Lesionado' : 'Suspenso'}
            {bench && <button className={styles.textButton} onClick={() => toggleReserve(p.id)}>Retirar</button>}
            {fine > 0 && <button className={styles.textButton} onClick={() => state.fine(p.id)}>Multar · {currency(fine)}</button>}
          </span>;
        } },
      ]} />
    </Panel>;
  };

  return <>
    <PageHeader eyebrow="ESCALAÇÃO E TÁTICA" title="Escalação e tática" description="Defina o time, a formação e a estratégia para a próxima partida.">
      {home && away && <div className={views.fixture}>
        <ClubBadge name={home.name} image={home.identity?.facts.image} /><strong>{home.name}</strong><span>×</span>
        <ClubBadge name={away.name} image={away.identity?.facts.image} /><strong>{away.name}</strong>
        <span className={styles.pill}><Icon name="cup" size={16} />{cup ? `${cup.cup.name} · ${cup.round.name}` : `${league?.name} · Rodada ${pending?.round}`}</span>
      </div>}
    </PageHeader>
    <div className={views.tabs}>{(['Escalação', 'Tática', 'Instruções'] as const).map((name, index) => <button key={name} aria-pressed={tab === name} className={tab === name ? styles.primaryButton : styles.secondaryButton} onClick={() => setTab(name)}><Icon name={(['lineup', 'target', 'news'] as const)[index]} size={17} />{name}</button>)}</div>
    {needsSponsor && <div className={styles.notice}>{seasonSponsorMessage} <button className={styles.textButton} onClick={() => state.navigate('finances')}>Comparar patrocinadores</button></div>}
    {unavailable && <p className={styles.error}>{unavailable} Contrate jogadores ou acompanhe a rodada com W.O.</p>}
    {unavailablePlayers.length > 0 && <p className={styles.error} role="alert">Revise a escalação. {unavailablePlayers.map((p) => p.name).join(', ')} {unavailablePlayers.length === 1 ? 'está indisponível' : 'estão indisponíveis'} para a partida.</p>}
    <div className={`${styles.panel} ${views.surface} ${views.lineupSummary}`}>
      <div className={views.lineupAverages}>
        <span className={styles.muted}>Força média<strong>{average('overall')}</strong></span>
        <span className={styles.muted}>Condição média<strong>{average('fitness')}%</strong></span>
        <span className={styles.muted}>Moral<strong>{average('morale')}%</strong></span>
      </div>
      <div className={views.lineupActions}>
        <button className={styles.secondaryButton} onClick={autoLineup}>Escalar automaticamente</button>
        <button className={styles.primaryButton} disabled={complete || needsSponsor || unavailablePlayers.length > 0 || !!state.live || state.isAdvancing || systems.board.status === 'dismissed'} onClick={kickOff}>
          <Icon name="match" size={17} />{complete ? 'Temporada concluída' : lineup ? 'Jogar partida' : 'Acompanhar rodada com W.O.'}
        </button>
      </div>
    </div>
    {tab === 'Escalação' && <div className={`${views.split} ${views.lineup}`}>
      <Panel title="Configuração tática" icon="lineup" className={`${views.surface} ${views.pitchPanel}`}>
        <div className={views.tacticControls}>
          <label className={styles.filterLabel}>Formação<select value={tactic.formation} onChange={(e) => updateTactic({ formation: e.target.value as Tactic['formation'] })}>{formations.map((f) => <option key={f} value={f}>{formationLabel(f)}</option>)}</select></label>
          <label className={styles.filterLabel}>Postura<select value={tactic.style} onChange={(e) => updateTactic({ style: e.target.value as Tactic['style'] })}><option value="defensive">Defensiva</option><option value="balanced">Equilibrada</option><option value="attacking">Ofensiva</option></select></label>
          <label className={styles.filterLabel}>Marcação<select value={tactic.markingIntensity} onChange={(e) => updateTactic({ markingIntensity: e.target.value as Tactic['markingIntensity'] })}><option value="low">Leve</option><option value="medium">Normal</option><option value="high">Intensa</option></select></label>
          <button className={styles.secondaryButton} onClick={() => setTab('Instruções')}><Icon name="news" size={17} />Instruções da equipe</button>
        </div>
        <div className={views.pitch}>
          <TacticalPitch formation={tactic.formation} players={starters} variant="lineup" getSlotProps={(index) => ({
            ...dragSource(starters[index]),
            ...starterDrop(index),
          })} />
        </div>
      </Panel>
      <section className={`${styles.panel} ${views.surface} ${views.lineupTable} ${views.dense}`}>
        <p className={views.lineupHint}>{benchFull ? 'Banco cheio. Arraste um não relacionado sobre um reserva para trocar.' : 'Arraste jogadores sobre outro jogador para trocar ou sobre o cabeçalho da lista para mover.'}</p>
        {renderGroup('Reservas')}
        {renderGroup('Não relacionados')}
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
  </>;
}
