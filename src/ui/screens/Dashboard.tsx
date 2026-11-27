import { Smile, Zap } from 'lucide-react';
import type { League, Team } from '../../engine/models';
import { careerOf, useGameStore } from '../store/gameStore';
import { hasLineupAbsences, nextCupEvent, seasonComplete } from '../../engine/career/progression';
import { activeSponsor, needsSeasonSponsor, seasonSponsorMessage } from '../../engine/career/sponsors';
import { coachSuspended } from '../../engine/career/coach';
import { competitionTeams } from '../../engine/career/cup';
import { RoundReview } from '../components/RoundReview';
import { averageOverall, formationLabel, padRound, seasonDate } from '../utils';
import { ClubBadge } from '../components/ClubBadge';
import { Icon } from '../components/Icon';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import styles from '../App.module.css';
import { autoPickLineup } from '../../engine/league';
import { clubProfile, profileInfo } from '../../engine/models/personality';
import { rivalryBetween } from '../../engine/career/stories';
import { TacticalPitch } from '../components/TacticalPitch';
import overview from './Dashboard.module.css';

export function Dashboard({ league, team }: { league: League; team: Team }) {
  const state = useGameStore();
  const { currentRound, season, isAdvancing, navigate, news, systems } = state;
  const career = careerOf(state);
  let readyLineup = state.lineup;
  try { readyLineup ??= autoPickLineup(team, undefined, true); } catch { /* Os avisos explicam a falta de escalação. */ }
  const tactic = readyLineup?.tactic ?? team.defaultTactic;
  const coachIsSuspended = coachSuspended(career);
  const disabled = isAdvancing || systems.board.status === 'dismissed' || coachIsSuspended;
  const needsSponsor = needsSeasonSponsor(career);
  const needsLineup = hasLineupAbsences(career);
  const profile = profileInfo[clubProfile(team)];
  const cupEvent = nextCupEvent(career);
  const cup = cupEvent?.round;
  const standing = league.standings.find((row) => row.teamId === team.id)!;
  const pending = league.schedule.find((round) => round.matches.some((match) => match.status !== 'finished'));
  const nextMatch = (cup?.matches ?? pending?.matches)?.find((match) => match.homeTeamId === team.id || match.awayTeamId === team.id);
  const clubs = competitionTeams(career);
  const homeTeam = clubs.find((club) => club.id === nextMatch?.homeTeamId);
  const awayTeam = clubs.find((club) => club.id === nextMatch?.awayTeamId);
  const champion = seasonComplete(career) ? league.teams.find((club) => club.id === league.standings[0]?.teamId) : undefined;
  const condition = Math.round(team.squad.reduce((sum, player) => sum + player.fitness, 0) / team.squad.length);
  const morale = Math.round(team.squad.reduce((sum, player) => sum + player.morale, 0) / team.squad.length);
  const expiring = team.squad.filter((p) => p.contract?.yearsRemaining === 1);
  const fit = team.squad.filter((p) => !p.injury && !p.discipline.suspendedMatches && p.fitness >= 70).length;
  const injured = team.squad.filter((p) => p.injury).length;
  const suspended = team.squad.filter((p) => !p.injury && p.discipline.suspendedMatches).length;
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
      <PageHeader eyebrow={`${league.name} · TEMPORADA ${padRound(season)}`} title="Central do Clube" description="Visão geral do clube, próxima partida, desempenho, elenco e principais atualizações." />
    </div>
    {systems.board.status === 'active' && !activeSponsor(career, team.id) && <div className={styles.notice}>
      {needsSponsor ? seasonSponsorMessage : 'Três propostas de patrocínio estão disponíveis.'} <button className={styles.textButton} onClick={() => navigate('finances')}>Comparar patrocinadores</button>
    </div>}
    {champion && <section role="status" className={styles.seasonEnd}><Icon name="standings" size={30} /><div><h2>Temporada encerrada</h2><p>Campeão: <strong>{champion.name}</strong>. Seu clube terminou em {standing.position}º lugar.</p><button className={styles.primaryButton} onClick={() => navigate('awards')}>Ver premiações da temporada</button></div></section>}
    <div className={overview.top}>
        <Panel title="Próxima Partida" icon="cup" className={overview.fixture}>
          {nextMatch && homeTeam && awayTeam ? <>
            <p className={styles.matchMeta}>{cup ? `${cupEvent?.cup.name} · ${cup.name}` : `${league.name} · ${currentRound <= league.schedule.length / 2 ? 'Turno' : 'Returno'}`}</p>
            {rivalryBetween(career, homeTeam.id, awayTeam.id) && <p className={styles.derbyTag}>DIA DE CLÁSSICO · {rivalryBetween(career, homeTeam.id, awayTeam.id)!.reason}</p>}
            <div className={`${styles.matchup} ${overview.matchup}`}><div><ClubBadge name={homeTeam.name} image={homeTeam.identity?.facts.image} size="large" /><strong>{homeTeam.name}</strong></div><span className={styles.versus}>×</span><div><ClubBadge name={awayTeam.name} image={awayTeam.identity?.facts.image} size="large" /><strong>{awayTeam.name}</strong></div></div>
            <div className={`${styles.fixtureDetails} ${overview.fixtureDetails}`}><span><Icon name="calendar" size={16} />{seasonDate(season, cup?.afterRound ?? currentRound, cup ? 5 : true, state.source?.seasons[0]?.year)}</span><span><Icon name="stadium" size={16} />{homeTeam.city}</span></div>
          </> : <div className={styles.finishedMessage}>{champion ? 'Mais uma temporada entrou para a história.' : 'Seu clube folga nesta rodada.'}</div>}
          {coachIsSuspended && <div className={styles.controls}><button className={styles.secondaryButton} onClick={() => navigate('coach')}>Acompanhar suspensão</button></div>}
          {!champion && <div className={overview.matchActions}>
            <button className={styles.secondaryButton} disabled={disabled} onClick={() => navigate('lineup')}><Icon name="calendar" size={18} /> Preparar partida</button>
            <button className={styles.primaryButton} disabled={disabled || needsSponsor} aria-keyshortcuts="J" title="Atalho J" onClick={() => needsLineup ? navigate('lineup') : void state.advanceRound()}><Icon name="match" size={18} /> {isAdvancing ? 'Simulando…' : 'Jogar rodada'}</button>
            <button className={styles.secondaryButton} disabled={disabled || needsSponsor} onClick={() => needsLineup ? navigate('lineup') : state.kickOff()}><Icon name="trend" size={18} /> Acompanhar ao vivo</button>
          </div>}
        </Panel>
        <div className={overview.squadOverview}>
          <dl className={overview.metrics}>
            <div><Icon name="lineup" /><dt>Formação</dt><dd>{formationLabel(tactic.formation)}</dd></div>
            <div><Zap aria-hidden="true" /><dt>Força média</dt><dd>{Math.round(averageOverall(team))}</dd></div>
            <div><Icon name="squad" /><dt>Condição do elenco</dt><dd>{condition}%</dd></div>
            <div><Smile aria-hidden="true" /><dt>Moral</dt><dd>{morale}%</dd></div>
          </dl>
          <Panel title="Resumo do Elenco" icon="squad" className={overview.squad}>
            <div className={overview.squadBody}>
              <TacticalPitch formation={tactic.formation} variant="overview" />
              <div>
                <ul className={overview.squadList}>
                  <li><Icon name="check" /> {readyLineup?.starterIds.length ?? 0} titulares confirmados</li>
                  <li><Icon name="squad" /> {readyLineup?.substituteIds.length ?? 0} reservas disponíveis</li>
                  <li><Icon name="condition" /> {injured} {injured === 1 ? 'lesionado' : 'lesionados'}</li>
                  {suspended > 0 && <li><Icon name="shield" /> {suspended} {suspended === 1 ? 'suspenso' : 'suspensos'}</li>}
                </ul>
                <button className={overview.outline} onClick={() => navigate('lineup')}>Ver escalação <Icon name="arrow" size={18} /></button>
              </div>
            </div>
          </Panel>
        </div>
    </div>
    <div className={overview.lower}>
        <div className={overview.roundSummary}>
          {systems.lastSummary?.teamId === team.id ? <RoundReview compact /> : <Panel title="Resumo da rodada" icon="history">
            <p className={styles.tableNote}>O resumo aparece após a primeira partida.</p>
          </Panel>}
        </div>
        <Panel title="Notícias do Clube" icon="news">
          <ul className={overview.news}>{updates.map((item) => <li key={item.kind}>
            <button onClick={() => navigate(item.kind === 'club' ? 'history' : item.kind === 'squad' ? 'squad' : champion ? 'standings' : 'calendar')}>
              <span className={overview.newsIcon}><Icon name={item.kind === 'club' ? 'cup' : item.kind === 'squad' ? 'shirt' : 'calendar'} size={25} /></span>
              <span><strong>{item.headline}</strong><small>{item.detail}</small></span>
              <Icon name="next" size={18} />
            </button>
          </li>)}</ul>
        </Panel>
        <div className={overview.side}>
          <Panel title="Mercado / Propostas" icon="market">
            <div className={overview.sideBody}>
              <p className={overview.offer}><Icon name="market" size={20} /> {offers > 0 ? `${offers} proposta(s) para seus jogadores.` : 'Nenhuma proposta pendente.'}</p>
              <button className={overview.outline} onClick={() => navigate('market')}>Abrir mercado <Icon name="arrow" size={18} /></button>
            </div>
          </Panel>
          <Panel title="Objetivos da Diretoria" icon="target">
            <div className={overview.sideBody}>
              <ul className={overview.squadList}>
                <li><Icon name="target" size={18} /> {objective} na Divisão {team.division}</li>
                <li><Icon name="standings" size={18} /> Atual: {standing.position}º lugar · {standing.points} pontos</li>
              </ul>
              {link(`Diretoria: ${systems.board.confidence}% de confiança`, () => navigate('board'))}
            </div>
          </Panel>
        </div>
    </div>
    <div className={styles.clubIdentity}><span className={styles.traitBadge}>{profile.label}</span><span>{profile.description}</span></div>
  </>;
}
