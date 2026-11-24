import { formationSlots, formations } from '../../engine/league/lineup';
import { Smile, Zap } from 'lucide-react';
import type { League, Team, Tactic } from '../../engine/models';
import { careerOf, useGameStore } from '../store/gameStore';
import { nextCupEvent } from '../../engine/career/progression';
import { competitionTeams } from '../../engine/career/cup';
import { RoundReview } from '../components/RoundReview';
import { seasonComplete } from '../../engine/career/progression';
import { recentClubMatches } from '../../engine/career/history';
import { averageOverall, currency, matchOutcome, padRound, positionLabels, seasonDate } from '../utils';
import { ClubBadge } from '../components/ClubBadge';
import { Icon } from '../components/Icon';
import { StandingsTable } from '../components/StandingsTable';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { ConditionRing } from '../components/ConditionRing';
import { PlayerAvatar } from '../components/PlayerAvatar';
import styles from '../App.module.css';
import { autoPickLineup } from '../../engine/league';
import { clubProfile, profileInfo } from '../../engine/models/personality';
import { rivalryBetween } from '../../engine/career/stories';
import { PreparationChecklist } from '../components/PreparationChecklist';
import { TacticalPitch } from '../components/TacticalPitch';
import overview from './Dashboard.module.css';

export function Dashboard({ league, team }: { league: League; team: Team }) {
  const state = useGameStore();
  const { currentRound, season, isAdvancing, navigate, beginNextSeason, news, finances, systems } = state;
  const career = careerOf(state);
  let readyLineup = state.lineup;
  try { readyLineup ??= autoPickLineup(team, undefined, true); } catch { /* Os avisos explicam a falta de escalação. */ }
  const tactic = readyLineup?.tactic ?? team.defaultTactic;
  const slots = formationSlots(tactic.formation);
  const eligible = team.squad.filter((player) => !player.injury && !player.discipline.suspendedMatches);
  const disabled = isAdvancing || systems.board.status === 'dismissed';
  const profile = profileInfo[clubProfile(team)];
  const cupEvent = nextCupEvent(career);
  const cup = cupEvent?.round;
  const standing = league.standings.find((row) => row.teamId === team.id)!;
  const pending = league.schedule.find((round) => round.matches.some((match) => match.status !== 'finished'));
  const nextMatch = (cup?.matches ?? pending?.matches)?.find((match) => match.homeTeamId === team.id || match.awayTeamId === team.id);
  const clubs = competitionTeams(career);
  const homeTeam = clubs.find((club) => club.id === nextMatch?.homeTeamId);
  const awayTeam = clubs.find((club) => club.id === nextMatch?.awayTeamId);
  const lastResults = recentClubMatches(career);
  const champion = seasonComplete(career) ? league.teams.find((club) => club.id === league.standings[0]?.teamId) : undefined;
  const condition = Math.round(team.squad.reduce((sum, player) => sum + player.fitness, 0) / team.squad.length);
  const morale = Math.round(team.squad.reduce((sum, player) => sum + player.morale, 0) / team.squad.length);
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
      <PageHeader eyebrow={`${league.name} · TEMPORADA ${padRound(season)}`} title="Central do Clube" description="Visão geral do clube, próxima partida, desempenho, elenco e principais atualizações." />
    </div>
    {champion && <section role="status" className={styles.seasonEnd}><Icon name="standings" size={30} /><div><h2>Temporada encerrada</h2><p>Campeão: <strong>{champion.name}</strong>. Seu clube terminou em {standing.position}º lugar. Revise os contratos antes de continuar.</p><button className={styles.primaryButton} onClick={beginNextSeason}>Começar próxima temporada</button></div></section>}
    <div className={overview.top}>
        <Panel title="Próxima Partida" icon="cup" className={overview.fixture}>
          {nextMatch && homeTeam && awayTeam ? <>
            <p className={styles.matchMeta}>{cup ? `${cupEvent?.cup.name} · ${cup.name}` : `${league.name} · ${currentRound <= league.schedule.length / 2 ? 'Turno' : 'Returno'}`}</p>
            {rivalryBetween(career, homeTeam.id, awayTeam.id) && <p className={styles.derbyTag}>DIA DE CLÁSSICO · {rivalryBetween(career, homeTeam.id, awayTeam.id)!.reason}</p>}
            <div className={`${styles.matchup} ${overview.matchup}`}><div><ClubBadge name={homeTeam.name} image={homeTeam.identity?.facts.image} size="large" /><strong>{homeTeam.name}</strong></div><span className={styles.versus}>×</span><div><ClubBadge name={awayTeam.name} image={awayTeam.identity?.facts.image} size="large" /><strong>{awayTeam.name}</strong></div></div>
            <div className={`${styles.fixtureDetails} ${overview.fixtureDetails}`}><span><Icon name="calendar" size={16} />{seasonDate(season, cup?.afterRound ?? currentRound, cup ? 5 : true, state.source?.seasons[0]?.year)}</span><span><Icon name="stadium" size={16} />{homeTeam.city}</span></div>
          </> : <div className={styles.finishedMessage}>{champion ? 'Mais uma temporada entrou para a história.' : 'Seu clube folga nesta rodada.'}</div>}
          {!champion && <div className={overview.matchActions}>
            <button className={styles.secondaryButton} disabled={disabled} onClick={() => navigate('lineup')}><Icon name="calendar" size={18} /> Preparar partida</button>
            <button className={styles.primaryButton} disabled={disabled} aria-keyshortcuts="J" title="Atalho J" onClick={() => void state.advanceRound()}><Icon name="match" size={18} /> {isAdvancing ? 'Simulando…' : 'Jogar rodada'}</button>
            <button className={styles.secondaryButton} disabled={disabled} onClick={state.kickOff}><Icon name="trend" size={18} /> Acompanhar ao vivo</button>
            <button className={styles.secondaryButton} disabled={disabled} onClick={() => void state.advanceToDecision()}>Simular até a próxima decisão</button>
          </div>}
        </Panel>
        <div className={overview.squadOverview}>
          <dl className={overview.metrics}>
            <div><Icon name="lineup" /><dt>Formação</dt><dd>{tactic.formation}</dd></div>
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
        <Panel title={`Classificação · Divisão ${team.division}`} icon="standings" footer={link('Ver tabela completa', () => navigate('standings'))}>
          <div className={styles.compactStandings}><StandingsTable league={league} selectedTeamId={team.id} compact /></div>
        </Panel>
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
    <RoundReview compact />
    <div className={styles.clubIdentity}><span className={styles.traitBadge}>{profile.label}</span><span>{profile.description}</span></div>
    <div className={overview.lower}>
        <Panel title="Elenco · Destaques" icon="squad" className={styles.highlightsPanel} footer={link('Ver elenco completo', () => navigate('squad'))}>
          <ul className={styles.highlightList}>{highlights.map((player) => <li key={player.id}><PlayerAvatar player={player} /><span><strong>{player.name}</strong><small>{positionLabels[player.primaryPosition]}</small></span><span className={styles.rating}>{player.overall}</span></li>)}</ul>
        </Panel>
        <Panel title="Finanças" icon="finances" className={styles.financialPanel} action={<Icon name="trend" size={19} />}>
          <dl className={styles.financeSummary}><div><dt>Saldo do clube</dt><dd className={team.budget < 0 ? styles.loss : styles.accent}>{currency(team.budget)}</dd></div><div><dt>Receitas <small>(temporada)</small></dt><dd className={styles.accent}>{currency(income)}</dd></div><div><dt>Despesas <small>(temporada)</small></dt><dd className={expenses ? styles.loss : ''}>{currency(expenses)}</dd></div></dl>
          <div className={styles.smallPanelLink}>{link('Ver finanças', () => navigate('finances'))}</div>
        </Panel>
        <Panel title="Condição do Elenco" icon="condition" className={styles.conditionPanel}>
          <div className={styles.conditionBody}><ConditionRing value={condition} /><dl className={styles.conditionLegend}>{[[styles.greenDot, 'Aptos', fit], [styles.yellowDot, 'Em recuperação', recovering], [styles.redDot, 'Depto. médico', injured], [styles.grayDot, 'Suspensos', suspended]].map(([color, label, count]) => <div key={String(label)}><dt><i className={String(color)} />{label}</dt><dd>{count}</dd></div>)}</dl></div>
        </Panel>
        <Panel title="Últimos resultados" icon="history" action={<span className={styles.subtleTag}>FORMA RECENTE</span>} footer={link('Ver calendário', () => navigate('calendar'))}>
          <div className={styles.formRow}>{Array.from({ length: 5 }, (_, index) => {
            const match = lastResults[index];
            const outcome = match ? matchOutcome(match, team.id) : undefined;
            return <span key={match?.id ?? index} className={`${styles.formBadge} ${outcome ? styles[`result${outcome}`] : ''}`} title={outcome === 'V' ? 'Vitória' : outcome === 'D' ? 'Derrota' : outcome === 'E' ? 'Empate' : 'A disputar'}>{outcome ?? '–'}</span>;
          })}</div>
          {!lastResults.length ? <p className={styles.emptyResults}>A bola ainda não rolou. Seus resultados aparecerão aqui.</p> : <ul className={styles.resultList}>{[...lastResults].reverse().slice(0, 3).map((match) => {
            const home = match.homeTeamId === team.id;
            const opponent = clubs.find((club) => club.id === (home ? match.awayTeamId : match.homeTeamId))!;
            return <li key={match.id}><span><small>{home ? 'CASA' : 'FORA'}</small>{opponent.name}</span><strong>{home ? match.score!.home : match.score!.away} – {home ? match.score!.away : match.score!.home}</strong></li>;
          })}</ul>}
        </Panel>
    </div>
    {!seasonComplete(career) && <Panel title="Ajustes para o próximo jogo" icon="squad">
      <p className={styles.matchMeta}>{cupEvent ? cupEvent.cup.name + ' · ' + cupEvent.round.name : 'Rodada ' + currentRound} · {nextMatch && homeTeam && awayTeam ? homeTeam.name + ' × ' + awayTeam.name : 'Folga'}</p>
      <div className={styles.controls}>
        <label className={styles.filterLabel}>Formação<select disabled={disabled} value={tactic.formation} onChange={(event) => state.updateTactic({ formation: event.target.value as Tactic['formation'] })}>{formations.map((formation) => <option key={formation}>{formation}</option>)}</select></label>
        <label className={styles.filterLabel}>Postura<select disabled={disabled} value={tactic.style} onChange={(event) => state.updateTactic({ style: event.target.value as Tactic['style'] })}><option value="defensive">Defensiva</option><option value="balanced">Equilibrada</option><option value="attacking">Ofensiva</option></select></label>
      </div>
      <PreparationChecklist team={team} lineup={readyLineup} career={career} />
      <div className={styles.quickRoster}>
        <table><thead><tr><th scope="col">Posição</th><th scope="col">Titular</th><th scope="col">Força</th><th scope="col">Condição</th></tr></thead><tbody>{slots.map((position, index) => {
          const starter = team.squad.find((player) => player.id === readyLineup?.starterIds[index]);
          const options = eligible.filter((player) => player.id === starter?.id || (!readyLineup?.starterIds.includes(player.id) && (player.primaryPosition === position || player.secondaryPosition === position)));
          return <tr key={index}><th scope="row">{positionLabels[position]}</th><td><select aria-label={'Titular ' + (index + 1) + ' · ' + positionLabels[position]} value={starter?.id ?? ''} disabled={disabled || !starter} onChange={(event) => state.pickPlayer(index, event.target.value)}>
            {!starter && <option value="">Sem titular</option>}{options.map((player) => <option key={player.id} value={player.id}>{player.name} · F {player.overall} · {Math.round(player.fitness)}%</option>)}
          </select></td><td>{starter?.overall ?? '—'}</td><td>{starter ? Math.round(starter.fitness) + '%' : '—'}</td></tr>;
        })}</tbody></table>
        <div><h3>Reservas e desfalques</h3><ul className={styles.compactList}>{team.squad.filter((player) => !readyLineup?.starterIds.includes(player.id)).map((player) => <li key={player.id}><span>{player.name}<small>{positionLabels[player.primaryPosition]} · {player.injury ? 'Lesão · ' + player.injury.remainingDays + ' dia(s)' : player.discipline.suspendedMatches ? 'Suspenso · ' + player.discipline.suspendedMatches + ' jogo(s)' : Math.round(player.fitness) + '% de condição'}</small></span><strong>{player.overall}</strong></li>)}</ul></div>
      </div>
    </Panel>}
  </>;
}
