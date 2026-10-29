import type { League, Team } from '../../engine/models';
import { useGameStore } from '../store/gameStore';
import { matchOutcome, padRound } from '../utils';
import { ClubBadge } from '../components/ClubBadge';
import { Icon } from '../components/Icon';
import { StandingsTable } from '../components/StandingsTable';
import { PageHeader } from '../components/PageHeader';
import styles from '../App.module.css';

export function Dashboard({ league, team }: { league: League; team: Team }) {
  const { currentRound, advanceRound, isAdvancing, error, navigate } = useGameStore();
  const standing = league.standings.find((row) => row.teamId === team.id)!;
  const pending = league.schedule.find((round) => round.matches.some((match) => match.status !== 'finished'));
  const nextMatch = pending?.matches.find((match) => match.homeTeamId === team.id || match.awayTeamId === team.id);
  const homeTeam = league.teams.find((club) => club.id === nextMatch?.homeTeamId);
  const awayTeam = league.teams.find((club) => club.id === nextMatch?.awayTeamId);
  const lastResults = league.schedule.flatMap((round) => round.matches).filter((match) => match.status === 'finished' && (match.homeTeamId === team.id || match.awayTeamId === team.id)).slice(-5);
  const champion = !pending ? league.teams.find((club) => club.id === league.standings[0]?.teamId) : undefined;
  const condition = Math.round(team.squad.reduce((sum, player) => sum + player.fitness, 0) / team.squad.length);
  return <>
    <PageHeader eyebrow="CENTRAL DO CLUBE" title={team.name} description={`${team.city} · Seu próximo capítulo começa aqui.`}><ClubBadge name={team.name} size="large" /></PageHeader>
    {champion && <section role="status" className={styles.seasonEnd}><Icon name="standings" /><div><h2>Temporada encerrada</h2><p>Campeão: <strong>{champion.name}</strong>. As {league.schedule.length} rodadas foram concluídas.</p></div></section>}
    <div className={styles.metricGrid}>
      <Metric label="POSIÇÃO NA LIGA" value={`${standing.position}º`} detail={`de ${league.teams.length} clubes`} accent />
      <Metric label="PONTOS CONQUISTADOS" value={String(standing.points)} detail={`${standing.wins}V · ${standing.draws}E · ${standing.losses}D`} />
      <Metric label="SALDO DE GOLS" value={`${standing.goalDifference > 0 ? '+' : ''}${standing.goalDifference}`} detail={`${standing.goalsFor} marcados · ${standing.goalsAgainst} sofridos`} />
      <Metric label="CONDIÇÃO DO ELENCO" value={`${condition}%`} detail={`${team.squad.length} jogadores no clube`} />
    </div>
    <div className={styles.dashboardGrid}>
      <section className={styles.panel} aria-labelledby="next-match"><div className={styles.panelHeading}><h2 id="next-match">Próximo jogo</h2><span className={styles.subtleTag}>{pending ? `RODADA ${padRound(currentRound)}` : 'TEMPORADA CONCLUÍDA'}</span></div>
        {nextMatch && homeTeam && awayTeam ? <><div className={styles.matchMeta}><span className={styles.liveDot} /> {league.name}<span>·</span><span>{nextMatch.homeTeamId === team.id ? 'Em casa' : 'Fora de casa'}</span></div>
          <div className={styles.matchup}><div><ClubBadge name={homeTeam.name} size="large" /><strong>{homeTeam.name}</strong><small>MANDANTE</small></div><span className={styles.versus}>VS</span><div><ClubBadge name={awayTeam.name} size="large" /><strong>{awayTeam.name}</strong><small>VISITANTE</small></div></div>
          <div className={styles.stadiumLine}>{homeTeam.city} · Capacidade para {homeTeam.stadium.capacity.toLocaleString('pt-BR')} torcedores</div></>
          : <div className={styles.finishedMessage}>{champion ? 'A última rodada já entrou para a história.' : 'Seu clube folga nesta rodada.'}</div>}
        <div className={styles.advanceBar}><span>{pending ? 'O campeonato segue. É hora de entrar em campo.' : 'Confira a classificação e os resultados finais.'}</span><button className={styles.primaryButton} onClick={() => void advanceRound()} disabled={isAdvancing || !pending}>{isAdvancing ? 'Simulando…' : pending ? 'Avançar rodada' : 'Temporada concluída'}<Icon name="arrow" /></button></div>
        {error && <p role="alert" className={styles.error}>{error}</p>}
      </section>
      <section className={styles.panel} aria-labelledby="recent-results"><div className={styles.panelHeading}><h2 id="recent-results">Últimos resultados</h2><span className={styles.subtleTag}>FORMA RECENTE</span></div>
        <div className={styles.formRow}>{Array.from({ length: 5 }, (_, index) => {
          const match = lastResults[index];
          const outcome = match ? matchOutcome(match, team.id) : undefined;
          return <span key={match?.id ?? index} className={`${styles.formBadge} ${outcome ? styles[`result${outcome}`] : ''}`} title={outcome === 'V' ? 'Vitória' : outcome === 'D' ? 'Derrota' : outcome === 'E' ? 'Empate' : 'A disputar'}>{outcome ?? '–'}</span>;
        })}</div>
        {lastResults.length === 0 ? <div className={styles.emptyResults}><Icon name="calendar" /><strong>A bola ainda não rolou.</strong><p>Seus últimos cinco resultados aparecerão aqui.</p></div>
          : <ul className={styles.resultList}>{[...lastResults].reverse().map((match) => {
            const home = match.homeTeamId === team.id;
            const opponent = league.teams.find((club) => club.id === (home ? match.awayTeamId : match.homeTeamId))!;
            return <li key={match.id}><span><small>{home ? 'CASA' : 'FORA'}</small>{opponent.name}</span><strong>{home ? match.score!.home : match.score!.away} – {home ? match.score!.away : match.score!.home}</strong></li>;
          })}</ul>}
        <div className={styles.panelFooter}><button className={styles.textButton} onClick={() => navigate('calendar')}>Ver calendário completo <Icon name="arrow" /></button></div>
      </section>
    </div>
    <section className={styles.panel}><div className={styles.panelHeading}><h2>De olho na tabela</h2><button className={styles.textButton} onClick={() => navigate('standings')}>Classificação completa <Icon name="arrow" /></button></div><StandingsTable league={league} selectedTeamId={team.id} compact /></section>
  </>;
}

function Metric({ label, value, detail, accent = false }: { label: string; value: string; detail: string; accent?: boolean }) {
  return <section className={styles.metric}><h2>{label}</h2><strong className={accent ? styles.accent : ''}>{value}</strong><span>{detail}</span></section>;
}
