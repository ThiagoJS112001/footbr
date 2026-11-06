import type { League, Team } from '../../engine/models';
import { careerOf, useGameStore } from '../store/gameStore';
import { dueCupRound } from '../../engine/career/cup';
import { worldTeams } from '../../engine/career/world';
import { RoundReview } from '../components/RoundReview';
import { seasonComplete } from '../../engine/career/progression';
import { recentClubMatches } from '../../engine/career/history';
import { currency, matchOutcome, padRound, positionLabels, seasonDate } from '../utils';
import { ClubBadge } from '../components/ClubBadge';
import { Icon } from '../components/Icon';
import { StandingsTable } from '../components/StandingsTable';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { ConditionRing } from '../components/ConditionRing';
import { PlayerAvatar } from '../components/PlayerAvatar';
import styles from '../App.module.css';

export function Dashboard({ league, team }: { league: League; team: Team }) {
  const state = useGameStore();
  const { currentRound, season, isAdvancing, navigate, beginNextSeason, news, finances, systems } = state;
  const career = careerOf(state);
  const cup = dueCupRound(career);
  const standing = league.standings.find((row) => row.teamId === team.id)!;
  const pending = league.schedule.find((round) => round.matches.some((match) => match.status !== 'finished'));
  const nextMatch = (cup?.matches ?? pending?.matches)?.find((match) => match.homeTeamId === team.id || match.awayTeamId === team.id);
  const homeTeam = worldTeams(career).find((club) => club.id === nextMatch?.homeTeamId);
  const awayTeam = worldTeams(career).find((club) => club.id === nextMatch?.awayTeamId);
  const lastResults = recentClubMatches(career);
  const champion = seasonComplete(career) ? league.teams.find((club) => club.id === league.standings[0]?.teamId) : undefined;
  const condition = Math.round(team.squad.reduce((sum, player) => sum + player.fitness, 0) / team.squad.length);
  const expiring = team.squad.filter((p) => p.contract?.yearsRemaining === 1);
  const highlights = [...team.squad].sort((a, b) => b.overall - a.overall).slice(0, 5);
  const fit = team.squad.filter((p) => !p.injury && !p.discipline.suspendedMatches && p.fitness >= 70).length;
  const recovering = team.squad.filter((p) => !p.injury && !p.discipline.suspendedMatches && p.fitness < 70).length;
  const injured = team.squad.filter((p) => p.injury).length;
  const suspended = team.squad.filter((p) => !p.injury && p.discipline.suspendedMatches).length;
  const entries = finances.filter((e) => e.season === season && (!e.teamId || e.teamId === team.id));
  const income = entries.reduce((sum, e) => sum + Math.max(0, e.amount), 0);
  const expenses = entries.reduce((sum, e) => sum - Math.min(0, e.amount), 0);
  const objective = `Terminar até o ${systems.board.targetPosition}º lugar`;
  const offers = systems.offers.filter((o) => o.status === 'pending').length;
  const link = (label: string, action: () => void) => <button className={styles.textButton} onClick={action}>{label}<Icon name="next" size={16} /></button>;
  const updates = [
    ...news.slice(0, 1).map((headline) => ({ headline, detail: 'Bastidores do clube', kind: 'club' })),
    { headline: expiring.length ? `${expiring.length} contrato(s) na reta final` : `${fit} jogadores prontos para entrar em campo`, detail: expiring.length ? 'Confira as renovações no elenco' : 'Acompanhe a condição dos atletas', kind: 'squad' },
    { headline: champion ? `${champion.name} conquista a liga` : 'Seu caminho na temporada está definido', detail: champion ? 'Confira a classificação final' : `${league.schedule.length} rodadas · Turno e returno`, kind: 'stadium' },
  ];
  return <>
    <div className={styles.clubHero}>
      <PageHeader eyebrow={`${league.name} · TEMPORADA ${padRound(season)}`} title="Central do Clube" description="Visão geral do seu time, próximas partidas, elenco e principais informações."><div className={styles.heroClub}><ClubBadge name={team.name} size="large" /><span>{team.name}<small>{team.city}</small></span></div></PageHeader>
    </div>
    {champion && <section role="status" className={styles.seasonEnd}><Icon name="standings" size={30} /><div><h2>Temporada encerrada</h2><p>Campeão: <strong>{champion.name}</strong>. Seu clube terminou em {standing.position}º lugar. Revise os contratos antes de continuar.</p><button className={styles.primaryButton} onClick={beginNextSeason}>Começar próxima temporada</button></div></section>}
    <RoundReview compact />
    {(offers > 0 || systems.board.confidence < 35) && <div className={styles.pendingActions}>{offers > 0 && <button className={styles.secondaryButton} onClick={() => navigate('market')}>{offers} proposta(s) para seus jogadores</button>}{systems.board.confidence < 35 && <button className={styles.secondaryButton} onClick={() => navigate('board')}>Diretoria: {systems.board.confidence}% de confiança</button>}</div>}
    <div className={styles.dashboardLayout}>
      <div className={styles.dashboardMain}>
        <Panel title="Próxima Partida" icon={cup ? 'cup' : 'calendar'} className={styles.nextMatchPanel} action={<span className={styles.subtleTag}>{cup ? 'COPA' : pending ? `RODADA ${padRound(currentRound)}` : 'ENCERRADA'}</span>}>
          {nextMatch && homeTeam && awayTeam ? <>
            <p className={styles.matchMeta}>{cup ? `${systems.cup.name} · ${cup.name}` : `${league.name} · ${currentRound <= league.schedule.length / 2 ? 'Turno' : 'Returno'}`}</p>
            <div className={styles.matchup}><div><ClubBadge name={homeTeam.name} size="large" /><strong>{homeTeam.name}</strong></div><span className={styles.versus}>×</span><div><ClubBadge name={awayTeam.name} size="large" /><strong>{awayTeam.name}</strong></div></div>
            <div className={styles.fixtureDetails}><span><Icon name="calendar" size={16} />{seasonDate(season, cup?.afterRound ?? currentRound, cup ? 5 : true)}</span><span><Icon name="stadium" size={16} />{homeTeam.city}</span></div>
          </> : <div className={styles.finishedMessage}>{champion ? 'Mais uma temporada entrou para a história.' : 'Seu clube folga nesta rodada.'}</div>}
          <div className={styles.matchAction}><button className={styles.primaryButton} onClick={() => navigate('lineup')} disabled={isAdvancing || !pending && !cup || systems.board.status === 'dismissed'}><Icon name="lineup" size={20} />{isAdvancing ? 'Simulando…' : pending || cup ? 'Preparar partida' : 'Temporada concluída'}</button></div>
        </Panel>
        <Panel title={`Classificação · Divisão ${team.division}`} icon="standings" className={styles.dashboardStandings} footer={link('Ver tabela completa', () => navigate('standings'))}>
          <div className={styles.compactStandings}><StandingsTable league={league} selectedTeamId={team.id} compact /></div>
        </Panel>
        <Panel title="Elenco · Destaques" icon="squad" className={styles.highlightsPanel} footer={link('Ver elenco completo', () => navigate('squad'))}>
          <ul className={styles.highlightList}>{highlights.map((player) => <li key={player.id}><PlayerAvatar /><span><strong>{player.name}</strong><small>{positionLabels[player.primaryPosition]}</small></span><span className={styles.rating}>{player.overall}</span></li>)}</ul>
        </Panel>
        <Panel title="Finanças" icon="finances" className={styles.financialPanel} action={<Icon name="trend" size={19} />}>
          <dl className={styles.financeSummary}><div><dt>Saldo do clube</dt><dd className={team.budget < 0 ? styles.loss : styles.accent}>{currency(team.budget)}</dd></div><div><dt>Receitas <small>(temporada)</small></dt><dd className={styles.accent}>{currency(income)}</dd></div><div><dt>Despesas <small>(temporada)</small></dt><dd className={expenses ? styles.loss : ''}>{currency(expenses)}</dd></div></dl>
          <div className={styles.smallPanelLink}>{link('Ver finanças', () => navigate('finances'))}</div>
        </Panel>
        <Panel title="Condição do Elenco" icon="condition" className={styles.conditionPanel}>
          <div className={styles.conditionBody}><ConditionRing value={condition} /><dl className={styles.conditionLegend}>{[[styles.greenDot, 'Aptos', fit], [styles.yellowDot, 'Em recuperação', recovering], [styles.redDot, 'Depto. médico', injured], [styles.grayDot, 'Suspensos', suspended]].map(([color, label, count]) => <div key={String(label)}><dt><i className={String(color)} />{label}</dt><dd>{count}</dd></div>)}</dl></div>
        </Panel>
        <Panel title="Objetivos da Temporada" icon="target" className={styles.objectivesPanel}>
          <div className={styles.objectiveGrid}><div><Icon name="standings" size={28} /><span><strong>Divisão {team.division}</strong><small>{objective}</small></span></div><div><Icon name="shield" size={28} /><span><strong>{standing.position}º lugar · {standing.points} pontos</strong><small>{standing.wins}V · {standing.draws}E · {standing.losses}D na temporada</small></span></div></div>
          {expiring.length > 0 && <div className={styles.contractReminder}>{link(`${expiring.length} contrato(s) para revisar no elenco`, () => navigate('squad'))}</div>}
          <div className={styles.contractReminder}>{link(`Diretoria: ${systems.board.confidence}% de confiança`, () => navigate('board'))}</div>
        </Panel>
      </div>
      <aside className={styles.dashboardAside} aria-label="Atualizações do clube">
        <Panel title="Notícias do Clube" icon="news" footer={link('Mais notícias', () => navigate('history'))}>
          <ul className={styles.newsList}>{updates.map((item, index) => <li key={index}><div className={`${styles.newsThumb} ${item.kind === 'stadium' ? styles.stadiumThumb : ''}`} aria-hidden="true">{item.kind === 'club' ? <ClubBadge name={team.name} size="large" /> : item.kind === 'squad' ? <Icon name="shirt" size={35} /> : null}</div><div><strong>{item.headline}</strong><small>{item.detail}</small></div></li>)}</ul>
        </Panel>
        <Panel title="Últimos resultados" icon="history" action={<span className={styles.subtleTag}>FORMA RECENTE</span>} footer={link('Ver calendário', () => navigate('calendar'))}>
          <div className={styles.formRow}>{Array.from({ length: 5 }, (_, index) => {
            const match = lastResults[index];
            const outcome = match ? matchOutcome(match, team.id) : undefined;
            return <span key={match?.id ?? index} className={`${styles.formBadge} ${outcome ? styles[`result${outcome}`] : ''}`} title={outcome === 'V' ? 'Vitória' : outcome === 'D' ? 'Derrota' : outcome === 'E' ? 'Empate' : 'A disputar'}>{outcome ?? '–'}</span>;
          })}</div>
          {!lastResults.length ? <p className={styles.emptyResults}>A bola ainda não rolou. Seus resultados aparecerão aqui.</p> : <ul className={styles.resultList}>{[...lastResults].reverse().slice(0, 3).map((match) => {
            const home = match.homeTeamId === team.id;
            const opponent = worldTeams(career).find((club) => club.id === (home ? match.awayTeamId : match.homeTeamId))!;
            return <li key={match.id}><span><small>{home ? 'CASA' : 'FORA'}</small>{opponent.name}</span><strong>{home ? match.score!.home : match.score!.away} – {home ? match.score!.away : match.score!.home}</strong></li>;
          })}</ul>}
        </Panel>
      </aside>
    </div>
  </>;
}
