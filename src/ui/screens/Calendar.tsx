import { useState } from 'react';
import type { League, Match } from '../../engine/models';
import { allCups, competitionTeams, managedCup, pendingCupRound } from '../../engine/career/cup';
import { ClubBadge } from '../components/ClubBadge';
import { Icon } from '../components/Icon';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { StandingsTable } from '../components/StandingsTable';
import { MatchRatingsDialog } from '../components/MatchRatingsDialog';
import { careerOf, useGameStore } from '../store/gameStore';
import { useUiStore } from '../store/uiStore';
import { padRound, seasonDate } from '../utils';
import { CupBracket } from './Cup';
import styles from '../App.module.css';
import views from './ClubViews.module.css';

const calendarViews = [
  { label: 'Próximos jogos', icon: 'calendar' },
  { label: 'Resultados', icon: 'trend' },
  { label: 'Por rodada', icon: 'standings' },
] as const;

export function Calendar({ league, selectedTeamId, currentRound }: { league: League; selectedTeamId: string; currentRound: number }) {
  const onlyMine = useUiStore((state) => state.calendarOnlyMine);
  const state = useGameStore();
  const career = careerOf(state);
  const [competitionId, setCompetitionId] = useState(state.screen === 'cup' ? career.systems.cup.id : 'all');
  const [view, setView] = useState<(typeof calendarViews)[number]['label']>(state.screen === 'cup' ? 'Por rodada' : 'Próximos jogos');
  const [ratedMatchId, setRatedMatchId] = useState<string | null>(null);
  const [resultLimit, setResultLimit] = useState(10);
  const stateCup = managedCup(career, 'state');
  const cups = allCups(career).filter((cup) => !career.systems.stateCups?.includes(cup) || cup === stateCup);
  const selectedCup = cups.find((cup) => cup.id === competitionId);
  const summaryCup = selectedCup ?? career.systems.cup;
  const cupRound = pendingCupRound(career, summaryCup);
  const teams = new Map(competitionTeams(career).map((team) => [team.id, team]));
  const playerNames = ratedMatchId ? new Map([
    ...career.systems.playerHistory.map((player) => [player.playerId, player.playerName] as const),
    ...career.systems.transfers.map((player) => [player.playerId, player.playerName] as const),
    ...[...teams.values()].flatMap((team) => team.squad).concat(career.freeAgents).map((player) => [player.id, player.name] as const),
  ]) : undefined;
  const isOwn = (match: Match) => match.homeTeamId === selectedTeamId || match.awayTeamId === selectedTeamId;
  const visible = (match: Match) => !onlyMine || isOwn(match);
  const leagueRounds = league.schedule.map((round) => ({
    key: `league-${round.round}`, week: round.round, dayOffset: 1, title: `Rodada ${padRound(round.round)}`, name: league.name,
    matches: round.matches, cup: false,
  }));
  const cupRounds = cups.flatMap((cup) => cup.rounds.map((round) => ({
    key: `${cup.id}-${round.round}`, week: round.afterRound, dayOffset: 5, title: round.name, name: cup.name,
    matches: round.matches, cup: true, cupId: cup.id,
  })));
  const rounds = [
    ...(!selectedCup ? leagueRounds : []),
    ...cupRounds.filter((round) => competitionId === 'all' || round.cupId === competitionId),
  ].sort((a, b) => a.week - b.week || a.dayOffset - b.dayOffset);
  const results = view === 'Resultados';
  const agenda = rounds.flatMap((round) => round.matches.filter((match) => visible(match) && (match.status === 'finished') === results)
    .map((match) => ({ match, round })));
  if (results) agenda.reverse();

  const renderMatch = (match: Match) => {
    const home = teams.get(match.homeTeamId);
    const away = teams.get(match.awayTeamId);
    const matchup = <>
      <span className={styles.calendarHome}>{home?.name}<ClubBadge name={home?.name ?? 'A definir'} image={home?.identity?.facts.image} /></span>
      <strong className={styles.calendarScore} aria-label={match.score ? `Placar ${match.score.home} a ${match.score.away}` : 'Jogo a disputar'}>
        {match.score ? `${match.score.home} – ${match.score.away}` : '×'}{match.forfeitTeamIds?.length ? <small>W.O.</small> : null}
        {match.penalties && <small>Pên. {match.penalties.home}–{match.penalties.away}</small>}
        {match.status === 'finished' && <small className={views.fixtureRatingLink}>Ver notas</small>}
      </strong>
      <span className={styles.calendarAway}><ClubBadge name={away?.name ?? 'A definir'} image={away?.identity?.facts.image} />{away?.name}</span>
    </>;
    if (match.status !== 'finished') return <div className={views.calendarMatch}>{matchup}</div>;
    return <button type="button" className={`${views.calendarMatch} ${views.ratedFixture}`} aria-haspopup="dialog"
      aria-label={`Notas da partida: ${home?.name} × ${away?.name}`} onClick={() => setRatedMatchId(match.id)}>
      {matchup}
    </button>;
  };

  const ratedMatch = ratedMatchId ? rounds.flatMap((round) => round.matches).find((match) => match.id === ratedMatchId) : undefined;
  return <>
    {ratedMatch && playerNames && <MatchRatingsDialog key={ratedMatch.id} match={ratedMatch} clubId={selectedTeamId}
      teams={teams} playerNames={playerNames} onClose={() => setRatedMatchId(null)} />}
    <PageHeader eyebrow="AGENDA DE JOGOS" title="Calendário" description="Acompanhe os próximos jogos, resultados e o andamento das competições." />
    <div className={views.calendarControls}>
      <label className={styles.filterLabel}>Competição
        <span className={views.competitionPicker}><Icon name="cup" size={19} /><select value={competitionId} onChange={(event) => setCompetitionId(event.target.value)}>
          <option value="all">Todas as competições</option>
          <option value={league.id}>{league.name}</option>
          {cups.map((cup) => <option key={cup.id} value={cup.id}>{cup.name}</option>)}
        </select></span>
      </label>
      <div className={views.calendarTabs} role="group" aria-label="Visualização do calendário">
        {calendarViews.map(({ label, icon }) => <button key={label} aria-pressed={view === label}
          className={view === label ? styles.primaryButton : styles.secondaryButton} onClick={() => setView(label)}><Icon name={icon} size={18} />{label}</button>)}
      </div>
      {!(selectedCup && view === 'Por rodada') && <label className={styles.filterLabel}>Exibir jogos
        <select value={onlyMine ? 'mine' : 'all'} onChange={(event) => useUiStore.setState({ calendarOnlyMine: event.target.value === 'mine' })}>
          <option value="mine">Somente meu clube</option><option value="all">Todos os clubes</option>
        </select>
      </label>}
    </div>
    <div className={`${views.split} ${views.calendarLayout}`}>
      <div className={views.stack}>
        {view === 'Por rodada' ? selectedCup ? (
          <section aria-label={selectedCup.name} className={views.stack}><CupBracket career={career} cup={selectedCup} /></section>
        ) : (
          <div className={styles.roundList}>{rounds.filter((round) => !round.cup || round.matches.some(visible)).map((round) => {
            const finished = round.matches.every((match) => match.status === 'finished');
            const next = !round.cup && round.week === currentRound && !finished;
            return <details className={styles.roundCard} key={round.key} open={next || (round.cup && round.week === 0 && !finished)}>
              <summary><span><strong>{round.title}</strong><small>{round.cup ? round.name : round.week <= league.schedule.length / 2 ? 'TURNO' : 'RETURNO'}</small></span>
                <span className={finished ? styles.finishedTag : next ? styles.currentTag : styles.subtleTag}>{finished ? 'Concluída' : next ? 'Próxima rodada' : 'A disputar'}</span></summary>
              <ul>{round.matches.filter(visible).map((match) => <li key={match.id} className={`${views.calendarRoundGame} ${isOwn(match) ? styles.ownMatch : ''}`}>{renderMatch(match)}</li>)}</ul>
            </details>;
          })}</div>
        ) : <Panel title={view} icon={results ? 'trend' : 'calendar'} className={views.surface}>
          {agenda.length ? <ul className={views.calendarAgenda}>{agenda.slice(0, results ? resultLimit : 10).map(({ match, round }) => (
            <li key={`${round.key}-${match.id}`}>
              <time>{seasonDate(state.season, round.week, round.dayOffset, state.source?.seasons[0]?.year)}</time>
              <div className={views.calendarCompetition}><span className={round.cup ? styles.subtleTag : styles.pill}><Icon name="cup" size={14} />{round.name}</span><small>{round.title}</small></div>
              {renderMatch(match)}
            </li>
          ))}</ul> : <p className={views.empty}>{results ? 'Nenhum resultado para esta seleção.' : 'Nenhum jogo a disputar nesta seleção.'}</p>}
          {results && agenda.length > resultLimit && <div className={styles.controls}><button className={styles.secondaryButton}
            onClick={() => setResultLimit(resultLimit + 10)}>Mostrar mais resultados</button></div>}
        </Panel>}
      </div>
      <aside className={views.stack}>
        <Panel title={league.name} icon="cup" className={`${views.surface} ${views.calendarStandings} ${views.dense}`}
          action={<button className={styles.textButton} onClick={() => state.navigate('standings')}>Ver classificação <Icon name="arrow" size={15} /></button>}>
          <StandingsTable league={league} selectedTeamId={selectedTeamId} compact leaders={3} showRecord />
        </Panel>
        <Panel title={summaryCup.name} icon="cup" className={views.surface}
          action={<button className={styles.textButton} onClick={() => { setCompetitionId(summaryCup.id); setView('Por rodada'); }}>Ver chaveamento <Icon name="arrow" size={15} /></button>}>
          <div className={views.empty}><Icon name="compare" size={32} /><strong>{summaryCup.championId ? `Campeão: ${teams.get(summaryCup.championId)?.name}`
            : summaryCup.status === 'deferred' ? 'A copa começa na próxima temporada.' : cupRound ? cupRound.name : 'Aguardando a próxima etapa'}</strong></div>
        </Panel>
      </aside>
    </div>
  </>;
}
