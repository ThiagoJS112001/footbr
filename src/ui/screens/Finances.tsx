import type { Team } from '../../engine/models';
import { payroll } from '../../engine/career/career';
import { careerOf, useGameStore } from '../store/gameStore';
import { financeForecast } from '../../engine/career/progression';
import { Panel } from '../components/Panel';
import { PageHeader } from '../components/PageHeader';
import { DataTable } from '../components/DataTable';
import { StatCard } from '../components/Panel';
import { currency } from '../utils';
import styles from '../App.module.css';

export function Finances({ team }: { team: Team }) {
  const state = useGameStore();
  const { finances, season } = state;
  const forecast = financeForecast(careerOf(state));
  const rows = finances.filter((e) => e.season === season && (!e.teamId || e.teamId === team.id)).map((e, index) => ({ ...e, id: String(index) }));
  const income = rows.filter((e) => e.amount > 0).reduce((sum, e) => sum + e.amount, 0);
  const expenses = rows.filter((e) => e.amount < 0).reduce((sum, e) => sum - e.amount, 0);
  const balances = rows.map((e) => e.balance);
  const min = Math.min(0, ...balances);
  const max = Math.max(1, ...balances);
  const points = balances.map((b, i) => `${10 + i / Math.max(1, balances.length - 1) * 780},${140 - (b - min) / (max - min) * 120}`).join(' ');
  return <>
    <PageHeader eyebrow="CONTAS DO CLUBE" title="Finanças" description="Bilheteria, patrocínio, salários e manutenção são lançados ao final de cada rodada." />
    <div className={styles.metricGrid}>{[['Saldo disponível', currency(team.budget)], ['Receitas na temporada', currency(income)], ['Despesas na temporada', currency(expenses)], ['Folha mensal', currency(payroll(team))]].map(([label, value]) => <StatCard label={label} value={value} key={label} />)}</div>
    <Panel title="Planejamento rápido" icon="trend"><div className={styles.metricGrid}><StatCard label="Saldo projetado em quatro semanas" value={currency(forecast.fourWeeks)} /><StatCard label="Reserva sugerida · dois meses de salários" value={currency(forecast.salaryReserve)} /><StatCard label="Disponível preservando a reserva" value={currency(forecast.spendingRoom)} /><StatCard label="Resultado operacional semanal estimado" value={currency(forecast.weekly)} /></div><p className={styles.tableNote}>{forecast.note} A bilheteria líquida corresponde a 20% da arrecadação bruta, após a operação do evento.</p></Panel>
    {team.budget < 0 && <p className={styles.error}>Clube no vermelho: contratações e renovações bloqueadas, com juros de 1% por rodada sobre a dívida inicial. Venda jogadores para recuperar o saldo.</p>}
    <section className={styles.panel}><div className={styles.panelHeading}><h2>Evolução do saldo · temporada {season}</h2></div>
      <svg className={styles.balanceChart} viewBox="0 0 800 160" role="img" aria-label={`Evolução do saldo de ${currency(balances[0] ?? team.budget)} para ${currency(team.budget)}`}><line x1="10" y1={140 - (0 - min) / (max - min) * 120} x2="790" y2={140 - (0 - min) / (max - min) * 120} stroke="var(--line)" strokeDasharray="4" /><polyline points={points} fill="none" stroke="var(--accent)" strokeWidth="3" vectorEffect="non-scaling-stroke" /></svg>
      <div className={styles.tableNote}>Faixa do gráfico: {currency(min)} a {currency(max)} · Cada ponto representa um lançamento.</div>
    </section>
    <section className={styles.panel}><div className={styles.panelHeading}><h2>Extrato da temporada</h2></div><DataTable caption="Extrato financeiro" rows={[...rows].reverse()} getRowId={(e) => e.id} columns={[
      { id: 'round', label: 'Rodada', render: (e) => e.round || 'Início' },
      { id: 'description', label: 'Lançamento', render: (e) => e.description },
      { id: 'amount', label: 'Valor', align: 'right', render: (e) => <span className={e.amount < 0 ? styles.loss : styles.accent}>{currency(e.amount)}</span> },
      { id: 'balance', label: 'Saldo', align: 'right', render: (e) => currency(e.balance) },
    ]} /></section>
  </>;
}
