import { useEffect, useState, type HTMLAttributes } from 'react';
import type { League, MatchEvent, MatchStatistics, Player, Team } from '../../engine/models';
import type { PlayingStyle } from '../../engine/models/Tactic';
import { playerTrait, traitInfo } from '../../engine/models/personality';
import { matchSnapshot } from '../../engine/simulation/simulateMatch';
import { careerOf, useGameStore } from '../store/gameStore';
import { competitionTeams, managedCup } from '../../engine/career/cup';
import { seasonComplete } from '../../engine/career/progression';
import { RoundReview } from '../components/RoundReview';
import { PageHeader } from '../components/PageHeader';
import { ClubBadge } from '../components/ClubBadge';
import { DataTable } from '../components/DataTable';
import { Panel } from '../components/Panel';
import { Icon } from '../components/Icon';
import { Level } from '../components/ClubMetrics';
import { TacticalPitch } from '../components/TacticalPitch';
import { formationLabel, positionLabels } from '../utils';
import styles from '../App.module.css';
import css from './Match.module.css';

const speeds = [1, 2, 4, 8];
const postures: Record<PlayingStyle, string> = { defensive: 'Defensiva', balanced: 'Equilibrada', attacking: 'Ofensiva' };
const fits = (reserve: Player, outgoing: Player) => reserve.primaryPosition === outgoing.primaryPosition || reserve.secondaryPosition === outgoing.primaryPosition;

function MatchStats({ stats }: { stats: MatchStatistics }) {
  return <section className={`${styles.panel} ${css.stats}`} aria-label="Estatísticas da partida">
    <div className={css.possession}>
      <span>Posse de bola</span>
      <div><strong>{stats.home.possession}%</strong>
        <meter min={0} max={100} value={stats.home.possession} aria-label="Posse do mandante" />
        <strong>{stats.away.possession}%</strong>
      </div>
    </div>
    {([
      { key: 'shots', label: 'Finalizações', icon: 'target' },
      { key: 'shotsOnTarget', label: 'No alvo', icon: 'lineup' },
      { key: 'xG', label: 'xG', icon: 'trend' },
    ] as const).map(({ key, label, icon }) => <div key={key} className={css.stat}>
      <Icon name={icon} size={25} /><div><span>{label}</span>
        <strong>{key === 'xG' ? stats.home.xG.toFixed(2) : stats.home[key]} – {key === 'xG' ? stats.away.xG.toFixed(2) : stats.away[key]}</strong>
      </div>
    </div>)}
  </section>;
}

export function MatchScreen({ league, team }: { league: League; team: Team }) {
  const state = useGameStore();
  const { live, lastRound, lastCupRound, lastCompetition, liveCompetition, systems, paused, speed, tickMatch, togglePause, setSpeed, changeStyle, substitute, finishMatchNow, navigate } = state;
  const career = careerOf(state);
  const teams = new Map(competitionTeams(career).map((club) => [club.id, club]));
  const competition = live ? liveCompetition : lastCompetition;
  const cup = competition === 'league' ? undefined : managedCup(career, competition);
  const [outId, setOutId] = useState('');
  const [inId, setInId] = useState('');
  const [onlyHighlights, setOnlyHighlights] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const running = !!live && !paused;
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(tickMatch, 700 / speed);
    return () => window.clearInterval(timer);
  }, [running, speed, tickMatch]);

  const round = live?.round ?? (cup ? lastCupRound : lastRound);
  const matches = live ? [...live.games.map(matchSnapshot), ...live.forfeits] : (cup?.rounds ?? league.schedule).find((r) => r.round === round)?.matches ?? [];
  const match = matches.find((m) => m.homeTeamId === team.id || m.awayTeamId === team.id);
  const session = live?.games.find((g) => g.home.team.id === team.id || g.away.team.id === team.id);
  const isHome = match?.homeTeamId === team.id;
  const side = isHome ? session?.home : session?.away;
  if (!match) return <><PageHeader eyebrow="DIA DE JOGO" title="Partida" description="Prepare a escalação para acompanhar a próxima rodada." /><button className={styles.primaryButton} onClick={() => navigate('lineup')}>Preparar partida</button></>;

  const home = teams.get(match.homeTeamId)!;
  const away = teams.get(match.awayTeamId)!;
  const stats = match.statistics;
  const minute = session?.minute ?? live?.games[0]?.minute ?? 90;
  const inTechnicalView = !!live && paused;
  const walkover = !!match.forfeitTeamIds?.length;
  const clock = live && !walkover ? `${minute}′ · ${paused ? 'Pausado' : minute <= 45 ? '1º tempo' : '2º tempo'}` : walkover ? 'Encerrado · W.O.' : '90′ · Encerrado';
  const playerNames = new Map([...teams.values()].flatMap((club) => club.squad.map((p) => [p.id, p.name] as const)));
  const name = (id: string) => playerNames.get(id) ?? 'Jogador transferido';
  const describe = (event: MatchEvent) => event.type === 'goal' ? `Gol de ${event.playerName ?? name(event.playerId)}!`
    : event.type === 'card' ? `${event.card === 'red' ? 'Cartão vermelho' : 'Cartão amarelo'} · ${name(event.playerId)}`
      : event.type === 'injury' ? `Lesão · ${name(event.playerId)}` : `Sai ${name(event.playerOutId)}, entra ${name(event.playerInId)}`;
  const timeline = [
    ...match.events.map((event, index) => ({ key: `event-${index}`, minute: event.minute, text: describe(event), detail: teams.get(event.teamId)?.name, kind: event.type === 'card' ? event.card : event.type })),
    ...(onlyHighlights ? [] : (match.commentary ?? []).map((event, index) => ({ key: `commentary-${index}`, minute: event.minute, text: event.text, detail: teams.get(event.teamId)?.name, kind: event.kind }))),
    ...(!onlyHighlights && !walkover ? [{ key: 'kickoff', minute: 0, text: 'Bola rolando!', detail: `${home.name} × ${away.name}`, kind: 'kickoff' }] : []),
  ].sort((a, b) => b.minute - a.minute);

  const outgoing = side?.active.find((p) => p.id === outId);
  const compatibleBench = outgoing ? side?.bench.filter((p) => fits(p, outgoing)) ?? [] : [];
  const canSubstitute = !!session && !!side && side.substitutions < session.config.maxSubstitutions;
  const draggedPlayer = canSubstitute ? side.bench.find((p) => p.id === draggedId) : undefined;
  const formation = side?.team.lineup.tactic.formation;
  const slotIds = [...((isHome ? session?.initialHomeLineup : session?.initialAwayLineup)?.starterIds ?? [])];
  for (const event of match.events) {
    if (event.type !== 'substitution' || event.teamId !== team.id) continue;
    const index = slotIds.indexOf(event.playerOutId);
    if (index >= 0) slotIds[index] = event.playerInId;
  }
  const playersOnPitch = slotIds.map((id) => side?.active.find((p) => p.id === id));
  const otherMatches = matches.filter((m) => m.id !== match.id);
  const replacePlayer = (outgoingId: string, incomingId: string) => {
    substitute(outgoingId, incomingId);
    setOutId('');
    setInId('');
  };
  const dropOnStarter = (index: number): HTMLAttributes<HTMLDivElement> => {
    const starter = playersOnPitch[index];
    if (!draggedPlayer || !starter || !fits(draggedPlayer, starter)) return {};
    return {
      className: css.dropStarter,
      onDragOver: (event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; },
      onDrop: (event) => {
        event.preventDefault();
        if (event.dataTransfer.getData('text/plain') === draggedPlayer.id) replacePlayer(starter.id, draggedPlayer.id);
        setDraggedId(null);
      },
    };
  };

  return <div className={`${css.screen} ${inTechnicalView ? css.paused : ''}`}>
    <PageHeader eyebrow={cup ? `${cup.name} · ${cup.rounds.find((r) => r.round === round)?.name ?? ''}` : league.name}
      title={live ? paused ? 'Partida pausada' : 'Bola rolando' : 'Apito final'}
      description={live ? paused ? 'Ajuste a postura e faça substituições antes de retomar o jogo.' : 'Acompanhe a partida em tempo real e tome decisões quando necessário.' : 'Resultados confirmados. Finanças e condição física atualizadas.'} />
    {!live && <RoundReview />}
    <section className={`${styles.panel} ${css.scoreboard}`} aria-label="Placar">
      <div className={css.home}><ClubBadge name={home.name} image={home.identity?.facts.image} size="large" /><span><strong>{home.name}</strong>{isHome && <small>Você</small>}</span></div>
      <div className={css.score}><span className={styles.pill}>{clock}</span>
        <strong aria-label="Placar da partida">{match.score?.home ?? 0} – {match.score?.away ?? 0}</strong>
        {match.penalties && <small>Pênaltis {match.penalties.home}–{match.penalties.away} · Classificado: {teams.get(match.winnerTeamId ?? '')?.name}</small>}
      </div>
      <div className={css.away}><ClubBadge name={away.name} image={away.identity?.facts.image} size="large" /><span><strong>{away.name}</strong>{!isHome && <small>Você</small>}</span></div>
    </section>
    {stats && <MatchStats stats={stats} />}

    {inTechnicalView && session && side && formation && <div className={css.technical}>
      <div className={css.technicalGrid}>
        <Panel title={`Escalação em campo · ${team.name}`} icon="shirt" action={<span className={styles.pill}>{formationLabel(formation)}</span>} className={css.pitch}>
          <div className={css.pitchControls}>
            <label className={styles.filterLabel}>Postura em campo
              <select value={side.team.lineup.tactic.style} onChange={(event) => changeStyle(event.target.value as PlayingStyle)}>
                {Object.entries(postures).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            {stats && <button className={styles.secondaryButton} aria-expanded={showDetails} onClick={() => setShowDetails(!showDetails)}><Icon name="trend" size={17} />{showDetails ? 'Ocultar estatísticas completas' : 'Ver estatísticas completas'}</button>}
          </div>
          <TacticalPitch variant="match" formation={formation} players={playersOnPitch} getSlotProps={dropOnStarter} />
        </Panel>
        <Panel title="Banco de reservas" icon="squad" className={css.bench}>
          <p className={css.benchHint}>{canSubstitute ? 'Arraste um reserva sobre um titular da posição para substituir.' : 'Limite de substituições atingido.'}</p>
          <DataTable caption="Banco de reservas" rows={side.bench} getRowId={(p) => p.id}
            getRowProps={(player) => canSubstitute ? {
              draggable: true,
              onDragStart: (event) => {
                event.dataTransfer.setData('text/plain', player.id);
                event.dataTransfer.effectAllowed = 'move';
                setDraggedId(player.id);
              },
              onDragEnd: () => setDraggedId(null),
            } : {}} columns={[
            { id: 'name', label: 'Jogador', render: (p) => p.name },
            { id: 'position', label: 'Pos.', render: (p) => positionLabels[p.primaryPosition] },
            { id: 'overall', label: 'Força', render: (p) => <strong className={styles.accent}>{p.overall}</strong> },
            { id: 'fitness', label: 'Condição', render: (p) => <Level value={p.fitness} /> },
          ]} />
        </Panel>
      </div>
      {showDetails && stats && <Panel title="Estatísticas completas" icon="trend">
        <DataTable caption="Estatísticas completas" rows={[
          { label: 'Posse de bola', home: `${stats.home.possession}%`, away: `${stats.away.possession}%` },
          { label: 'Finalizações', home: stats.home.shots, away: stats.away.shots },
          { label: 'No alvo', home: stats.home.shotsOnTarget, away: stats.away.shotsOnTarget },
          { label: 'Escanteios', home: stats.home.corners, away: stats.away.corners },
          { label: 'Gols esperados (xG)', home: stats.home.xG.toFixed(2), away: stats.away.xG.toFixed(2) },
        ]} getRowId={(row) => row.label} columns={[
          { id: 'metric', label: 'Estatística', render: (row) => row.label },
          { id: 'home', label: home.name, render: (row) => row.home },
          { id: 'away', label: away.name, render: (row) => row.away },
        ]} />
      </Panel>}
      <form className={`${styles.panel} ${css.substitution}`} onSubmit={(event) => {
        event.preventDefault();
        if (!canSubstitute || !outgoing || !compatibleBench.some((p) => p.id === inId)) return;
        replacePlayer(outId, inId);
      }}>
        <div><h2><Icon name="market" size={21} />Substituição</h2><small>{side.substitutions}/{session.config.maxSubstitutions} usadas</small></div>
        <label className={styles.filterLabel}>Sai<select value={outgoing?.id ?? ''} onChange={(e) => { setOutId(e.target.value); setInId(''); }}>
          <option value="">Escolher titular</option>{side.active.map((p) => <option key={p.id} value={p.id}>{positionLabels[p.primaryPosition]} · {p.name} · {Math.round(p.fitness)}%{side.yellows[p.id] ? ' · AMARELADO' : ''}</option>)}
        </select></label>
        <label className={styles.filterLabel}>Entra<select value={inId} disabled={!outgoing} onChange={(e) => setInId(e.target.value)}>
          <option value="">Escolher reserva</option>{compatibleBench.map((p) => <option key={p.id} value={p.id}>{p.name} · F {p.overall} · {Math.round(p.fitness)}% · {traitInfo[playerTrait(p)].label}</option>)}
        </select></label>
        <button className={styles.primaryButton} disabled={!outgoing || !inId || !canSubstitute}><Icon name="check" size={18} />Confirmar substituição</button>
      </form>
    </div>}

    <div className={css.feeds}>
      <Panel title="Lances da partida" icon="news" action={<label className={styles.highlightFilter}><input type="checkbox" checked={onlyHighlights} onChange={(e) => setOnlyHighlights(e.target.checked)} />Só lances principais</label>}>
        <ol className={css.timeline} tabIndex={0} aria-label="Lances da partida">
          {inTechnicalView && <li><strong>{minute}′</strong><Icon name="clock" size={19} /><span><strong>Partida pausada</strong><small>Ajustes táticos em andamento.</small></span></li>}
          {timeline.map((event) => <li key={event.key} className={event.kind === 'yellow' ? css.yellow : event.kind === 'red' ? css.red : ''}>
            <strong>{event.minute}′</strong><Icon name={event.kind === 'goal' ? 'match' : event.kind === 'substitution' ? 'market' : event.kind === 'yellow' || event.kind === 'red' ? 'news' : 'target'} size={19} />
            <span><strong>{event.text}</strong>{event.detail && <small>{event.detail}</small>}</span>
          </li>)}
          {!timeline.length && !inTechnicalView && <li><span>Aguardando o primeiro lance.</span></li>}
        </ol>
      </Panel>
      <Panel title={live && !paused ? `${cup ? cup.rounds.find((r) => r.round === round)?.name ?? cup.name : `Rodada ${round}`} · Outros jogos` : 'Placar da rodada'} icon="cup">
        {otherMatches.length ? <ul className={css.otherGames}>{otherMatches.map((m) => {
          const home = teams.get(m.homeTeamId);
          const away = teams.get(m.awayTeamId);
          return <li key={m.id}>
            <span className={css.otherHome}>{home?.name}{home && <ClubBadge name={home.name} image={home.identity?.facts.image} />}</span>
            <span className={css.otherScore}><strong>{m.score?.home ?? 0} – {m.score?.away ?? 0}</strong>
              <small>{m.forfeitTeamIds?.length ? 'W.O.' : m.penalties ? `Pên. ${m.penalties.home}–${m.penalties.away}` : m.status === 'finished' ? 'Encerrado' : `${minute}′`}</small>
            </span>
            <span className={css.otherAway}>{away && <ClubBadge name={away.name} image={away.identity?.facts.image} />}{away?.name}</span>
          </li>;
        })}</ul> : <p className={styles.tableNote}>Nenhum outro jogo nesta rodada.</p>}
      </Panel>
    </div>
    <div className={`${styles.panel} ${css.toolbar}`}>
      {live ? <>
        <button className={styles.primaryButton} onClick={togglePause} aria-keyshortcuts="Space"><Icon name={paused ? 'match' : 'clock'} size={18} />{paused ? 'Retomar partida' : 'Pausar partida'}</button>
        {!paused && side && <button className={styles.secondaryButton} onClick={togglePause}><Icon name="target" size={18} />Comando técnico</button>}
        <div className={css.speed} role="group" aria-label="Velocidade da partida"><span>Velocidade da partida</span>
          <div>{speeds.map((value) => <button key={value} type="button" className={speed === value ? styles.primaryButton : styles.secondaryButton} aria-pressed={speed === value} aria-keyshortcuts={String(value)} onClick={() => setSpeed(value)}>{value}×</button>)}</div>
        </div>
        <button className={styles.secondaryButton} onClick={finishMatchNow}><Icon name="next" size={18} />Simular até o fim</button>
      </> : <>
        <button className={styles.primaryButton} disabled={seasonComplete(career) || systems.board.status === 'dismissed'} onClick={() => navigate('lineup')}>Preparar próximo jogo</button>
        <button className={styles.secondaryButton} onClick={() => navigate(seasonComplete(career) ? 'awards' : 'dashboard')}>{seasonComplete(career) ? 'Ver premiações da temporada' : 'Próxima rodada'}</button>
      </>}
    </div>
  </div>;
}
