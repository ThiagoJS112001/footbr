import { useEffect, useState } from 'react';
import type { League, MatchEvent, Team } from '../../engine/models';
import type { PlayingStyle } from '../../engine/models/Tactic';
import { matchSnapshot } from '../../engine/simulation/simulateMatch';
import { careerOf, useGameStore } from '../store/gameStore';
import { competitionTeams, managedCup } from '../../engine/career/cup';
import { RoundReview } from '../components/RoundReview';
import { PageHeader } from '../components/PageHeader';
import { ClubBadge } from '../components/ClubBadge';
import { positionLabels } from '../utils';
import styles from '../App.module.css';
import { calculateStandings } from '../../engine/league';
import { seasonSeed } from '../../engine/career/career';
import { seasonComplete } from '../../engine/career/progression';
import { StandingsTable } from '../components/StandingsTable';
import { playerTrait, traitInfo } from '../../engine/models/personality';

export function MatchScreen({ league, team }: { league: League; team: Team }) {
  const state = useGameStore();
  const { live, lastRound, lastCupRound, lastCompetition, liveCompetition, systems, paused, speed, tickMatch, togglePause, setSpeed, changeStyle, substitute, finishMatchNow, navigate } = state;
  const career = careerOf(state);
  const teams = competitionTeams(career);
  const competition = live ? liveCompetition : lastCompetition;
  const cup = competition === 'league' ? undefined : managedCup(career, competition);
  const [outId, setOutId] = useState('');
  const [inId, setInId] = useState('');
  const [onlyHighlights, setOnlyHighlights] = useState(false);
  useEffect(() => {
    if (!live || paused) return;
    const timer = window.setInterval(tickMatch, 700 / speed);
    return () => window.clearInterval(timer);
  }, [!!live, paused, speed, tickMatch]);
  const matches = live ? [...live.games.map(matchSnapshot), ...live.forfeits] : cup ? cup.rounds.find((r) => r.round === lastCupRound)?.matches ?? [] : league.schedule.find((r) => r.round === lastRound)?.matches ?? [];
  const match = matches.find((m) => m.homeTeamId === team.id || m.awayTeamId === team.id);
  const session = live?.games.find((g) => g.home.team.id === team.id || g.away.team.id === team.id);
  const side = session?.home.team.id === team.id ? session.home : session?.away;
  const playerNames = new Map(teams.flatMap((t) => t.squad.map((p) => [p.id, p.name] as const)));
  const name = (id: string) => playerNames.get(id) ?? 'Jogador transferido';
  const describe = (event: MatchEvent) => event.type === 'goal' ? `GOL! ${event.playerName ?? name(event.playerId)}`
    : event.type === 'card' ? `${event.card === 'red' ? 'Cartão vermelho' : 'Cartão amarelo'} · ${name(event.playerId)}`
      : event.type === 'injury' ? `Lesão · ${name(event.playerId)}` : `Sai ${name(event.playerOutId)}, entra ${name(event.playerInId)}`;
  const minute = live?.games[0]?.minute ?? 90;
  const projectedLeague = live && competition === 'league' ? { ...league, schedule: league.schedule.map((r) => r.round === live.round ? { ...r, matches: matches.map((m) => ({ ...m, status: 'finished' as const })) } : r) } : null;
  if (projectedLeague) projectedLeague.standings = calculateStandings(projectedLeague, seasonSeed(careerOf(state)));
  const projectedRow = projectedLeague?.standings.find((r) => r.teamId === team.id);
  const projectionNote = projectedRow && projectedLeague ? `${projectedRow.position}º lugar · ${projectedRow.points} pontos · ${projectedLeague.rules.promotionSpots > 0 && (projectedLeague.rules.relegationSpots === 0 || projectedRow.position <= 10) ? projectedRow.position <= 4 ? 'Na zona de acesso' : `${Math.max(0, projectedLeague.standings[3].points - projectedRow.points)} ponto(s) atrás do G4` : projectedRow.position >= 17 ? 'Na zona de rebaixamento' : `${Math.max(0, projectedRow.points - projectedLeague.standings[16].points)} ponto(s) acima do Z4`}` : '';
  if (!match) return <><PageHeader eyebrow="DIA DE JOGO" title="Partida" description="Prepare a escalação para acompanhar a próxima rodada." /><button className={styles.primaryButton} onClick={() => navigate('lineup')}>Preparar partida</button></>;
  const home = teams.find((t) => t.id === match.homeTeamId)!;
  const away = teams.find((t) => t.id === match.awayTeamId)!;
  const timeline = [...match.events.map((event, index) => ({ key: `event-${index}`, minute: event.minute, teamId: event.teamId, text: describe(event), highlight: true })),
    ...(onlyHighlights ? [] : (match.commentary ?? []).map((event, index) => ({ key: `commentary-${index}`, minute: event.minute, teamId: event.teamId, text: event.text, highlight: false })))].sort((a, b) => b.minute - a.minute);
  const compatibleBench = side?.bench.filter((p) => {
    const outgoing = side.active.find((q) => q.id === outId);
    return outgoing && (p.primaryPosition === outgoing.primaryPosition || p.secondaryPosition === outgoing.primaryPosition);
  }) ?? [];
  return <>
    <PageHeader eyebrow={cup ? `${cup.name} · ${cup.rounds.find((r) => r.round === (live?.round ?? lastCupRound))?.name}` : `RODADA ${live?.round ?? lastRound}`} title={live ? 'Bola rolando' : 'Apito final'} description={live ? 'Suas decisões passam a valer no próximo minuto.' : 'Resultados confirmados. Finanças e condição física atualizadas.'} />
    {!live && <RoundReview />}
    <section className={styles.panel}>
      <div className={styles.matchClock} aria-live="off">{live ? `${minute}′ · ${paused ? 'Pausado' : 'Em jogo'}` : match.forfeitTeamIds?.length ? 'Encerrado · W.O.' : '90′ · Encerrado'}</div>
      <div className={styles.scoreboard}><div><ClubBadge name={home.name} image={home.identity?.facts.image} size="large" /><strong>{home.name}</strong></div><strong aria-label="Placar da partida">{match.score?.home ?? 0} – {match.score?.away ?? 0}</strong><div><ClubBadge name={away.name} image={away.identity?.facts.image} size="large" /><strong>{away.name}</strong></div></div>
      {match.penalties && <p className={styles.matchMeta}>Pênaltis: {match.penalties.home}–{match.penalties.away} · Classificado: {teams.find((t) => t.id === match.winnerTeamId)?.name}</p>}
      <div className={styles.controls}>
        {live ? <><button className={styles.primaryButton} onClick={togglePause}>{paused ? 'Retomar' : 'Pausar'}</button><label className={styles.filterLabel}>Velocidade<select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}><option value={1}>1×</option><option value={2}>2×</option><option value={5}>5×</option></select></label><button className={styles.secondaryButton} onClick={finishMatchNow}>Simular até o fim</button></> : <><button className={styles.primaryButton} disabled={seasonComplete(careerOf(state)) || systems.board.status === 'dismissed'} onClick={() => navigate('lineup')}>Preparar próximo jogo</button><button className={styles.secondaryButton} onClick={() => navigate('dashboard')}>Próxima rodada</button></>}
      </div>
      {match.statistics && <div className={styles.matchStats}>{(['possession', 'shots', 'shotsOnTarget', 'xG'] as const).map((key, i) => <div key={key}><strong>{match.statistics!.home[key]}{key === 'possession' ? '%' : ''}</strong><span>{['Posse', 'Finalizações', 'No alvo', 'xG'][i]}</span><strong>{match.statistics!.away[key]}{key === 'possession' ? '%' : ''}</strong></div>)}</div>}
    </section>
    {live && side && <section className={styles.panel}>
      <div className={styles.panelHeading}><h2>Comando técnico</h2><span className={styles.subtleTag}>{side.substitutions}/5 SUBSTITUIÇÕES</span></div>
      <div className={styles.controls}>
        <label className={styles.filterLabel}>Postura em campo<select value={side.team.lineup.tactic.style} onChange={(e) => changeStyle(e.target.value as PlayingStyle)}><option value="defensive">Defensiva</option><option value="balanced">Equilibrada</option><option value="attacking">Ofensiva</option></select></label>
        <label className={styles.filterLabel}>Sai<select value={outId} onFocus={() => { if (!paused) togglePause(); }} onChange={(e) => { setOutId(e.target.value); setInId(''); }}><option value="">Escolher titular</option>{side.active.map((p) => <option key={p.id} value={p.id}>{positionLabels[p.primaryPosition]} · {p.name} · {Math.round(p.fitness)}%{side.yellows[p.id] ? ' · AMARELADO' : ''}</option>)}</select></label>
        <label className={styles.filterLabel}>Entra<select value={inId} onChange={(e) => setInId(e.target.value)}><option value="">Escolher reserva</option>{compatibleBench.map((p) => <option key={p.id} value={p.id}>{p.name} · F {p.overall} · {Math.round(p.fitness)}% · {traitInfo[playerTrait(p)].label}</option>)}</select></label>
        <button className={styles.secondaryButton} disabled={!outId || !inId || side.substitutions >= 5} onClick={() => { substitute(outId, inId); setOutId(''); setInId(''); }}>Substituir</button>
      </div>
    </section>}
    <div className={styles.managerGrid}>
      <section className={styles.panel}><div className={styles.panelHeading}><h2>Lances da partida</h2><label className={styles.highlightFilter}><input type="checkbox" checked={onlyHighlights} onChange={(e) => setOnlyHighlights(e.target.checked)} />Só gols, cartões e trocas</label></div><ol className={`${styles.compactList} ${styles.matchTimeline}`}>{timeline.map((event) => <li key={event.key} className={event.highlight ? styles.highlightEvent : undefined}><strong className={styles.accent}>{event.minute}′</strong><span>{event.text}<small>{teams.find((t) => t.id === event.teamId)?.name}</small></span></li>)}{!timeline.length && <li className={styles.muted}>Aguardando o primeiro lance.</li>}</ol></section>
      <section className={styles.panel}><div className={styles.panelHeading}><h2>Placar da rodada</h2></div><ul className={styles.compactList}>{matches.map((m) => <li key={m.id}><span>{teams.find((t) => t.id === m.homeTeamId)?.name}<small>{teams.find((t) => t.id === m.awayTeamId)?.name}</small></span><strong className={styles.nowrap}>{m.score?.home ?? 0} – {m.score?.away ?? 0}{m.penalties && <small>Pên. {m.penalties.home}–{m.penalties.away}</small>}{m.forfeitTeamIds?.length ? ' W.O.' : ''}</strong></li>)}</ul></section>
    </div>
    {projectedLeague && <section className={styles.panel} aria-label="Classificação provisória"><div className={styles.panelHeading}><h2>Se terminasse agora</h2><span className={styles.subtleTag}>TABELA AO VIVO · {minute}′</span></div><p className={styles.tableNote}><strong>{projectionNote}</strong><br />Projeção com os placares atuais. A classificação oficial será confirmada ao final da rodada.</p><StandingsTable league={projectedLeague} selectedTeamId={team.id} compact /></section>}
  </>;
}
