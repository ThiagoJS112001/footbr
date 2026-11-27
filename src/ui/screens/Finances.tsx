import { useId, useState } from 'react';
import type { Team } from '../../engine/models';
import { payroll } from '../../engine/career/career';
import { careerOf, useGameStore } from '../store/gameStore';
import { financeForecast } from '../../engine/career/progression';
import { Panel, StatCard } from '../components/Panel';
import { Icon } from '../components/Icon';
import { PageHeader } from '../components/PageHeader';
import { DataTable } from '../components/DataTable';
import { currency } from '../utils';
import styles from '../App.module.css';
import { Sponsorships } from './Sponsorships';
import views from './ClubViews.module.css';

export function Finances({ team }: { team: Team }) {
  const state = useGameStore();
  const [expanded, setExpanded] = useState(false);
  const statementId = useId();
  const { finances, season } = state;
  const career = careerOf(state);
  const forecast = financeForecast(career);
  const rows = finances.filter((e) => e.season === season && (!e.teamId || e.teamId === team.id)).map((e, index) => ({ ...e, id: String(index) }));
  const income = rows.filter((e) => e.amount > 0).reduce((sum, e) => sum + e.amount, 0);
  const expenses = rows.filter((e) => e.amount < 0).reduce((sum, e) => sum - e.amount, 0);
  return <>
    <PageHeader eyebrow="CONTAS DO CLUBE" title="Finanças" description="Bilheteria, patrocínio, salários e manutenção são lançados ao final de cada rodada." />
    <div className={styles.metricGrid}>{[['Saldo disponível', currency(team.budget)], ['Receitas na temporada', currency(income)], ['Despesas na temporada', currency(expenses)], ['Folha mensal', currency(payroll(team))]].map(([label, value]) => <StatCard label={label} value={value} key={label} />)}</div>
    <Panel title="Planejamento rápido" icon="trend"><div className={styles.metricGrid}><StatCard label="Saldo projetado em quatro semanas" value={currency(forecast.fourWeeks)} /><StatCard label="Reserva sugerida · dois meses de salários" value={currency(forecast.salaryReserve)} /><StatCard label="Disponível preservando a reserva" value={currency(forecast.spendingRoom)} /><StatCard label="Resultado operacional semanal estimado" value={currency(forecast.weekly)} /></div><p className={styles.tableNote}>{forecast.note} A bilheteria líquida corresponde a 20% da arrecadação bruta, após a operação do evento.</p></Panel>
    {team.budget < 0 && <p className={styles.error}>Clube no vermelho: contratações e renovações bloqueadas, com juros de 1% por rodada sobre a dívida inicial. Venda jogadores para recuperar o saldo.</p>}
    <Sponsorships career={career} team={team} />
    <Panel title="Extrato da temporada" icon="news" className={views.surface}
      action={<button className={styles.secondaryButton} type="button" aria-expanded={expanded} aria-controls={statementId} onClick={() => setExpanded(!expanded)}>
        {expanded ? 'Recolher extrato' : 'Ver extrato'} <Icon name="chevron" size={16} />
      </button>}>
      <div id={statementId} hidden={!expanded}>
        {expanded && <DataTable caption="Extrato financeiro" scrollClassName={views.statementScroll} rows={[...rows].reverse()} getRowId={(e) => e.id} columns={[
          { id: 'round', label: 'Rodada', render: (e) => e.round || 'Início' },
          { id: 'description', label: 'Lançamento', render: (e) => e.description },
          { id: 'amount', label: 'Valor', align: 'right', render: (e) => <span className={e.amount < 0 ? styles.loss : styles.accent}>{currency(e.amount)}</span> },
          { id: 'balance', label: 'Saldo', align: 'right', render: (e) => currency(e.balance) },
        ]} />}
      </div>
    </Panel>
  </>;
}
