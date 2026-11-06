import { useEffect, useState } from 'react';
import type { League, MatchEvent, Team } from '../../engine/models';
import type { PlayingStyle } from '../../engine/models/Tactic';
import { matchSnapshot } from '../../engine/simulation/simulateMatch';
import { careerOf, useGameStore } from '../store/gameStore';
import { worldTeams } from '../../engine/career/world';
import { RoundReview } from '../components/RoundReview';
import { PageHeader } from '../components/PageHeader';
import { ClubBadge } from '../components/ClubBadge';
import { positionLabels } from '../utils';
import styles from '../App.module.css';

export function MatchScreen({ league, team }: { league: League; team: Team }) {
  const state = useGameStore();
  const { live, lastRound, lastCupRound, lastCompetition, liveCompetition, systems, paused, speed, tickMatch, togglePause, setSpeed, changeStyle, substitute, finishMatchNow, navigate } = state;
  const teams = worldTeams(careerOf(state));
  const competition = live ? liveCompetition : lastCompetition;
  const [outId, setOutId] = useState('');
  const [inId, setInId] = useState('');
  useEffect(() => {
    if (!live || paused) return;
    const timer = window.setInterval(tickMatch, 700 / speed);
    return () => window.clearInterval(timer);
  }, [!!live, paused, speed, tickMatch]);
  const matches = live ? [...live.games.map(matchSnapshot), ...live.forfeits] : competition === 'cup' ? systems.cup.rounds.find((r) => r.round === lastCupRound)?.matches ?? [] : league.schedule.find((r) => r.round === lastRound)?.matches ?? [];
  const match = matches.find((m) => m.homeTeamId === team.id || m.awayTeamId === team.id);
  const session = live?.games.find((g) => g.home.team.id === team.id || g.away.team.id === team.id);
  const side = session?.home.team.id === team.id ? session.home : session?.away;
  const playerNames = new Map(teams.flatMap((t) => t.squad.map((p) => [p.id, p.name] as const)));
  const name = (id: string) => playerNames.get(id) ?? 'Jogador transferido';
  const describe = (event: MatchEvent) => event.type === 'goal' ? `GOL! ${event.playerName ?? name(event.playerId)}`
    : event.type === 'card' ? `${event.card === 'red' ? 'Cartão vermelho' : 'Cartão amarelo'} · ${name(event.playerId)}`
      : event.type === 'injury' ? `Lesão · ${name(event.playerId)}` : `Sai ${name(event.playerOutId)}, entra ${name(event.playerInId)}`;
  const minute = live?.games[0]?.minute ?? 90;
  if (!match) return <><PageHeader eyebrow="DIA DE JOGO" title="Partida" description="Prepare a escalação para acompanhar a próxima rodada." /><button className={styles.primaryButton} onClick={() => navigate('lineup')}>Preparar partida</button></>;
  const home = teams.find((t) => t.id === match.homeTeamId)!;
  const away = teams.find((t) => t.id === match.awayTeamId)!;
  const compatibleBench = side?.bench.filter((p) => {
    const outgoing = side.active.find((q) => q.id === outId);
    return outgoing && (p.primaryPosition === outgoing.primaryPosition || p.secondaryPosition === outgoing.primaryPosition);
  }) ?? [];
  return <>
    <PageHeader eyebrow={competition === 'cup' ? `${systems.cup.name} · ${systems.cup.rounds.find((r) => r.round === (live?.round ?? lastCupRound))?.name}` : `RODADA ${live?.round ?? lastRound}`} title={live ? 'Bola rolando' : 'Apito final'} description={live ? 'Suas decisões passam a valer no próximo minuto.' : 'Resultados confirmados. Finanças e condição física atualizadas.'} />
    {!live && <RoundReview />}
    <section className={styles.panel}>
      <div className={styles.matchClock} aria-live="off">{live ? `${minute}′ · ${paused ? 'Pausado' : 'Em jogo'}` : match.forfeitTeamIds?.length ? 'Encerrado · W.O.' : '90′ · Encerrado'}</div>
      <div className={styles.scoreboard}><div><ClubBadge name={home.name} image={home.identity?.facts.image} size="large" /><strong>{home.name}</strong></div><strong aria-label="Placar da partida">{match.score?.home ?? 0} – {match.score?.away ?? 0}</strong><div><ClubBadge name={away.name} image={away.identity?.facts.image} size="large" /><strong>{away.name}</strong></div></div>
      {match.penalties && <p className={styles.matchMeta}>Pênaltis: {match.penalties.home}–{match.penalties.away} · Classificado: {teams.find((t) => t.id === match.winnerTeamId)?.name}</p>}
      <div className={styles.controls}>
        {live ? <><button className={styles.primaryButton} onClick={togglePause}>{paused ? 'Retomar' : 'Pausar'}</button><label className={styles.filterLabel}>Velocidade<select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}><option value={1}>1×</option><option value={2}>2×</option><option value={5}>5×</option></select></label><button className={styles.secondaryButton} onClick={finishMatchNow}>Simular até o fim</button></> : <button className={styles.primaryButton} onClick={() => navigate('dashboard')}>Próxima rodada</button>}
      </div>
      {match.statistics && <div className={styles.matchStats}>{(['possession', 'shots', 'shotsOnTarget', 'xG'] as const).map((key, i) => <div key={key}><strong>{match.statistics!.home[key]}{key === 'possession' ? '%' : ''}</strong><span>{['Posse', 'Finalizações', 'No alvo', 'xG'][i]}</span><strong>{match.statistics!.away[key]}{key === 'possession' ? '%' : ''}</strong></div>)}</div>}
    </section>
    {live && side && <section className={styles.panel}>
      <div className={styles.panelHeading}><h2>Comando técnico</h2><span className={styles.subtleTag}>{side.substitutions}/5 SUBSTITUIÇÕES</span></div>
      <div className={styles.controls}>
        <label className={styles.filterLabel}>Postura em campo<select value={side.team.lineup.tactic.style} onChange={(e) => changeStyle(e.target.value as PlayingStyle)}><option value="defensive">Defensiva</option><option value="balanced">Equilibrada</option><option value="attacking">Ofensiva</option></select></label>
        <label className={styles.filterLabel}>Sai<select value={outId} onFocus={() => { if (!paused) togglePause(); }} onChange={(e) => { setOutId(e.target.value); setInId(''); }}><option value="">Escolher titular</option>{side.active.map((p) => <option key={p.id} value={p.id}>{positionLabels[p.primaryPosition]} · {p.name}</option>)}</select></label>
        <label className={styles.filterLabel}>Entra<select value={inId} onChange={(e) => setInId(e.target.value)}><option value="">Escolher reserva</option>{compatibleBench.map((p) => <option key={p.id} value={p.id}>{p.name} · F {p.overall}</option>)}</select></label>
        <button className={styles.secondaryButton} disabled={!outId || !inId || side.substitutions >= 5} onClick={() => { substitute(outId, inId); setOutId(''); setInId(''); }}>Substituir</button>
      </div>
    </section>}
    <div className={styles.managerGrid}>
      <section className={styles.panel}><div className={styles.panelHeading}><h2>Lances da partida</h2></div><ol className={styles.compactList}>{[...match.events].reverse().map((event, index) => <li key={`${event.minute}-${index}`}><strong className={styles.accent}>{event.minute}′</strong><span>{describe(event)}<small>{teams.find((t) => t.id === event.teamId)?.name}</small></span></li>)}{!match.events.length && <li className={styles.muted}>Aguardando o primeiro lance.</li>}</ol></section>
      <section className={styles.panel}><div className={styles.panelHeading}><h2>Placar da rodada</h2></div><ul className={styles.compactList}>{matches.map((m) => <li key={m.id}><span>{teams.find((t) => t.id === m.homeTeamId)?.name}<small>{teams.find((t) => t.id === m.awayTeamId)?.name}</small></span><strong className={styles.nowrap}>{m.score?.home ?? 0} – {m.score?.away ?? 0}{m.penalties && <small>Pên. {m.penalties.home}–{m.penalties.away}</small>}{m.forfeitTeamIds?.length ? ' W.O.' : ''}</strong></li>)}</ul></section>
    </div>
  </>;
}
