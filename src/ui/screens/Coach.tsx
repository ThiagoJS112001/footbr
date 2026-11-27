import { useState } from 'react';
import { careerWeek, coachBetFixtures, coachOf, coachSuspended, jobRequirements, minimumIntegrity, offeredSalary, openCoachVacancies } from '../../engine/career/coach';
import { availableJobs, createBoard } from '../../engine/career/board';
import { worldLeagues, worldTeams } from '../../engine/career/world';
import type { CoachBet } from '../../engine/career/types';
import { ClubBadge } from '../components/ClubBadge';
import { DataTable } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { Panel, StatCard } from '../components/Panel';
import { careerOf, useGameStore } from '../store/gameStore';
import { currency } from '../utils';
import styles from '../App.module.css';
import views from './ClubViews.module.css';

const tabs = ['Visão geral', 'Histórico', 'Mercado de Técnicos', 'Integridade e disciplina', 'Patrimônio e apostas'] as const;
const exits = { performance: 'Demissão por desempenho', discipline: 'Demissão disciplinar', transfer: 'Mudança de clube' };
const movements = { promotion: 'Acesso', relegation: 'Rebaixamento' };

export function CoachScreen() {
  const state = useGameStore();
  const career = careerOf(state);
  const coach = coachOf(career);
  const employed = career.systems.board.status === 'active';
  const suspended = coachSuspended(career);
  const [tab, setTab] = useState<(typeof tabs)[number]>(employed ? 'Visão geral' : 'Mercado de Técnicos');
  const [draftName, setDraftName] = useState(coach.name);
  const [negotiating, setNegotiating] = useState('');
  const [salary, setSalary] = useState(0);
  const [fixtureId, setFixtureId] = useState('');
  const [selection, setSelection] = useState<CoachBet['selection']>('home');
  const [stake, setStake] = useState(100);
  const week = careerWeek(career);
  const clubs = new Map(worldTeams(career).map((team) => [team.id, team]));
  const current = clubs.get(career.selectedTeamId!);
  const jobs = tab === 'Mercado de Técnicos' ? availableJobs(career) : [];
  const vacancies = tab === 'Mercado de Técnicos' ? openCoachVacancies(career).filter(({ team }) => !jobs.some((job) => job.id === team.id)) : [];
  const opportunities = tab === 'Patrimônio e apostas' ? coachBetFixtures(career) : [];
  const fixture = opportunities.find((item) => item.match.id === fixtureId) ?? opportunities[0];
  const totals = coach.stints.reduce((sum, entry) => ({
    games: sum.games + entry.games, wins: sum.wins + entry.wins, draws: sum.draws + entry.draws, losses: sum.losses + entry.losses,
    titles: sum.titles + entry.titles.length,
  }), { games: 0, wins: 0, draws: 0, losses: 0, titles: 0 });
  const percentage = totals.games ? Math.round((totals.wins * 3 + totals.draws) / (totals.games * 3) * 100) : 0;
  const seasons = new Set(coach.stints.map((entry) => entry.season)).size;
  const honors = (career.systems.competitionAwards ?? []).filter((edition) => edition.coach?.user).slice().reverse();
  return <>
    <PageHeader eyebrow="TRAJETÓRIA PROFISSIONAL" title="Minha Carreira" description={`${coach.name} · ${employed ? current?.name : 'Desempregado'}`}>
      {(!employed || suspended) && <button className={styles.primaryButton} onClick={state.coachWeek}>Avançar uma semana</button>}
    </PageHeader>
    {coach.integrity < minimumIntegrity && <p className={styles.notice}>Você está temporariamente inelegível para contratação. Recupere sua integridade até 15% para voltar ao mercado. {!employed && 'A recuperação é de 2 pontos por semana de liga, até o limite de 15.'}</p>}
    {suspended && <p className={styles.notice}>Suspensão disciplinar · {coach.suspendedUntil - week} semana(s) restantes.</p>}
    <div className={`${styles.metricGrid} ${views.coachMetrics}`}>
      <StatCard label="Reputação profissional" value={`${coach.reputation}/100`} detail={<progress aria-label="Reputação profissional" max={100} value={coach.reputation} />} />
      <StatCard label="Integridade pública" value={`${coach.integrity}/100`} detail={<progress aria-label="Integridade pública" max={100} value={coach.integrity} />} />
      <StatCard label="Temporadas disputadas" value={seasons} />
      <StatCard label="Títulos" value={totals.titles} />
      <StatCard label="Aproveitamento" value={`${percentage}%`} />
    </div>
    <div className={views.tabs} role="group" aria-label="Seções da carreira">{tabs.map((item) =>
      <button key={item} className={item === tab ? styles.primaryButton : styles.secondaryButton} aria-pressed={item === tab} onClick={() => setTab(item)}>{item}</button>)}</div>
    {tab === 'Visão geral' && <Panel title="Perfil do treinador" icon="user" className={views.surface}>
      <form className={styles.controls} onSubmit={(e) => { e.preventDefault(); state.renameCoach(draftName); }}>
        <label className={styles.filterLabel}>Nome do treinador<input maxLength={60} required value={draftName} onChange={(e) => setDraftName(e.target.value)} /></label>
        <button className={styles.secondaryButton}>Salvar nome</button>
      </form>
      <div className={styles.controls}><span>{totals.games} partidas</span><span>{totals.wins} vitórias</span><span>{totals.draws} empates</span><span>{totals.losses} derrotas</span>
        <span>{new Set(coach.stints.map((entry) => entry.teamId)).size} clubes comandados</span></div>
    </Panel>}
    {tab === 'Histórico' && <div className={views.stack}><Panel title="Histórico da carreira" icon="history" className={views.surface}>
      <DataTable caption="Passagens por clubes" rows={[...coach.stints].reverse()} getRowId={(row) => `${row.teamId}:${row.season}:${row.started}`} pageSize={15} columns={[
        { id: 'season', label: 'Temporada', render: (row) => `${row.season} · rod. ${row.started}–${row.ended ?? 'atual'}` },
        { id: 'club', label: 'Clube', render: (row) => clubs.get(row.teamId)?.name ?? row.teamId },
        { id: 'record', label: 'J / V / E / D', render: (row) => `${row.games} / ${row.wins} / ${row.draws} / ${row.losses}` },
        { id: 'titles', label: 'Títulos', render: (row) => row.titles.join(', ') || '—' },
        { id: 'movement', label: 'Desfecho', render: (row) => row.exit ? exits[row.exit] : row.movement ? movements[row.movement] : '—' },
      ]} />
    </Panel><Panel title="Premiações do treinador" icon="cup" className={views.surface}>
      {honors.length ? <ul className={styles.compactList}>{honors.map((edition) =>
        <li key={`${edition.season}-${edition.id}`}><span><strong>Melhor Técnico · {edition.name}</strong>
          <small>Temporada {edition.season} · {edition.coach?.teamName}</small></span></li>)}</ul>
        : <p className={styles.tableNote}>Nenhuma premiação registrada para o treinador.</p>}
    </Panel></div>}
    {tab === 'Mercado de Técnicos' && <Panel title="Oportunidades de Carreira" icon="market" className={views.surface}>
      {jobs.length ? <div className={views.careerCards}>{jobs.map((team) => {
        const league = worldLeagues(career).find((item) => item.teams.some((club) => club.id === team.id))!;
        const row = league.standings.find((item) => item.teamId === team.id)!;
        const requirements = jobRequirements(team);
        return <article key={team.id} className={views.careerCard}>
          <ClubBadge name={team.name} image={team.identity?.facts.image} /><h3>{team.name}</h3>
          <p>Divisão {team.division} · {row.position}º lugar · Meta até {createBoard(team, league).targetPosition}º</p>
          <p>Salário de {currency(offeredSalary(team))} por semana</p>
          <p className={styles.muted}>Reputação e integridade de referência: {requirements.reputation} e {requirements.integrity}</p>
          <button className={styles.primaryButton} aria-label={`Assumir ${team.name}`} onClick={() => state.acceptJob(team.id)}>Aceitar proposta</button>
          {negotiating === team.id ? <form className={views.stack} onSubmit={(event) => { event.preventDefault(); state.acceptJob(team.id, salary); }}>
            <label className={styles.filterLabel}>Salário semanal (R$)<input required type="number" min={offeredSalary(team)} value={salary} onChange={(e) => setSalary(Number(e.target.value))} /></label>
            <button className={styles.secondaryButton}>Enviar contraproposta</button>
          </form> : <button className={styles.secondaryButton} onClick={() => { setNegotiating(team.id); setSalary(offeredSalary(team)); }}>Negociar salário</button>}
        </article>;
      })}</div> : <p className={styles.tableNote}>{coach.integrity < minimumIntegrity ? 'O mercado reabre ao recuperar 15 de integridade.' : suspended ? 'As propostas voltam após cumprir a suspensão.' : 'Nenhum clube interessado nesta semana.'}</p>}
      {vacancies.length > 0 && <details className={styles.reviewDetails}><summary>Outras vagas disponíveis</summary>
        <DataTable caption="Outras vagas" rows={vacancies} getRowId={({ team }) => team.id} pageSize={8} columns={[
          { id: 'team', label: 'Clube', render: ({ team }) => team.name },
          { id: 'standing', label: 'Situação', render: ({ team, position }) => `Divisão ${team.division} · ${position}º lugar` },
          { id: 'criteria', label: 'Reputação / integridade de referência', render: ({ team }) => {
            const criteria = jobRequirements(team);
            return `${criteria.reputation} / ${criteria.integrity}`;
          } },
        ]} />
      </details>}
    </Panel>}
    {tab === 'Integridade e disciplina' && <Panel title="Histórico disciplinar" icon="shield" className={views.surface}>
      <p className={styles.tableNote}>A integridade pública reflete infrações comprovadas. Clubes tradicionais exigem um histórico mais sólido.</p>
      <DataTable caption="Ocorrências disciplinares" rows={[...coach.incidents].reverse().map((entry, index) => ({ ...entry, id: index }))} getRowId={(row) => String(row.id)} pageSize={12} columns={[
        { id: 'week', label: 'Semana', render: (row) => row.week },
        { id: 'text', label: 'Ocorrência', render: (row) => row.text },
      ]} />
    </Panel>}
    {tab === 'Patrimônio e apostas' && <div className={views.stack}>
      <Panel title="Patrimônio pessoal" icon="finances" className={views.surface}>
        <p className={styles.tableNote}>Saldo pessoal fictício de {currency(coach.cash)} · Salário semanal de {currency(coach.salary)}</p>
      </Panel>
      <Panel title="Apostas fictícias" icon="target" className={views.surface}>
        <p className={styles.tableNote}>Apostar na sua competição é uma infração disciplinar. As apostas usam o saldo pessoal fictício e são liquidadas pelo placar simulado.</p>
        {fixture && <form className={styles.controls} onSubmit={(e) => { e.preventDefault(); state.coachBet(fixture.match.id, selection, stake); }}>
          <label className={styles.filterLabel}>Abordagem<select value={fixture.match.id} onChange={(e) => setFixtureId(e.target.value)}>{opportunities.map((item) => <option key={item.match.id} value={item.match.id}>{item.label}</option>)}</select></label>
          <label className={styles.filterLabel}>Palpite<select value={selection} onChange={(e) => setSelection(e.target.value as CoachBet['selection'])}>
            <option value="home">Mandante · {fixture.odds.home}×</option><option value="draw">Empate · {fixture.odds.draw}×</option><option value="away">Visitante · {fixture.odds.away}×</option>
          </select></label>
          <label className={styles.filterLabel}>Valor fictício (R$)<input type="number" min={100} max={Math.min(5000, coach.cash)} value={stake} required onChange={(e) => setStake(Number(e.target.value))} /></label>
          <button className={styles.secondaryButton} disabled={coach.cash < 100}>Aceitar risco e apostar</button>
          <button type="button" className={styles.secondaryButton} onClick={() => state.coachBet(fixture.match.id, 'declined')}>Recusar abordagem</button>
          <button type="button" className={styles.secondaryButton} onClick={() => state.coachBet(fixture.match.id, 'reported')}>Denunciar abordagem</button>
        </form>}
        <DataTable caption="Histórico de apostas fictícias" rows={[...coach.bets].reverse()} getRowId={(row) => row.id} pageSize={10} columns={[
          { id: 'game', label: 'Partida', render: (row) => row.label },
          { id: 'stake', label: 'Valor fictício', render: (row) => currency(row.stake) },
          { id: 'status', label: 'Resultado', render: (row) => row.status === 'won' ? 'Ganha' : row.status === 'lost' ? 'Perdida' : 'Pendente' },
          { id: 'report', label: 'Investigação', render: (row) => row.discovered ? 'Infração comprovada' : '—' },
        ]} />
      </Panel>
    </div>}
  </>;
}
