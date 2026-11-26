import { useEffect, useId, useRef, useState } from 'react';
import type { Player, Team } from '../../engine/models';
import type { Career } from '../../engine/career/career';
import type { RenewalTerms } from '../../engine/career/types';
import { activeLoan } from '../../engine/career/market';
import { clubSeasonRatings } from '../../engine/career/ratings';
import { maxRenewalAttempts, renewalStatus } from '../../engine/career/renewals';
import { completedRounds } from '../../engine/career/world';
import { DataTable } from '../components/DataTable';
import { Panel } from '../components/Panel';
import { Icon } from '../components/Icon';
import { useGameStore } from '../store/gameStore';
import { currency, positionLabels } from '../utils';
import styles from '../App.module.css';
import views from './ClubViews.module.css';

const ratingLabel = (value: number) => value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function ContractRenewals({ career, team }: { career: Career; team: Team }) {
  const [playerId, setPlayerId] = useState('');
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const expiring = team.squad.filter((player) => player.contract?.yearsRemaining === 1 && !activeLoan(career, player.id));
  const player = expiring.find((item) => item.id === playerId);
  const averages = expanded ? clubSeasonRatings(career, team.id) : new Map<string, number>();
  const round = completedRounds(career);
  return <div className={views.stack}>
    <Panel title="Renovação de contratos" icon="news" className={`${views.surface} ${views.renewalPanel}`}
      action={<div className={views.renewalActions}>
        <span className={styles.pill}>{expiring.length} {expiring.length === 1 ? 'contrato a renovar' : 'contratos a renovar'}</span>
        <button className={styles.secondaryButton} type="button" aria-expanded={expanded} aria-controls={listId} onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Recolher renovações' : 'Ver renovações'} <Icon name="chevron" size={16} />
        </button>
      </div>}>
      <div id={listId} hidden={!expanded}>{expanded && <>
      <p className={styles.tableNote}>Jogadores com um ano de contrato restante. A força e as notas da temporada pesam na negociação. Após os 32 anos, as exigências diminuem.</p>
      <DataTable caption="Contratos com um ano restante" rows={expiring} getRowId={(row) => row.id}
        getRowClassName={(row) => row.id === player?.id ? styles.selectedRow : ''} initialSort={{ id: 'strength', direction: 'desc' }} columns={[
          { id: 'player', label: 'Jogador', sortValue: (row) => row.name, render: (row) => row.name },
          { id: 'position', label: 'Posição', render: (row) => positionLabels[row.primaryPosition] },
          { id: 'age', label: 'Idade', sortValue: (row) => row.age, render: (row) => row.age },
          { id: 'strength', label: 'Força', sortValue: (row) => row.overall, render: (row) => <span className={styles.rating}>{row.overall}</span> },
          { id: 'rating', label: 'Nota média', sortValue: (row) => averages.get(row.id) ?? -1, render: (row) => averages.has(row.id) ? ratingLabel(averages.get(row.id)!) : '—' },
          { id: 'salary', label: 'Salário mensal', sortValue: (row) => row.contract!.salary, render: (row) => currency(row.contract!.salary) },
          { id: 'action', label: 'Negociação', render: (row) => {
            const status = renewalStatus(career, row.id);
            return status?.status === 'blocked'
              ? <span className={styles.muted}>Aguarde {status.availableAfterRound - round} sem.</span>
              : <button className={styles.secondaryButton} aria-label={`Negociar renovação de ${row.name}`} aria-haspopup="dialog" onClick={() => setPlayerId(row.id)}>
                {status?.status === 'counter' ? 'Ver contraproposta' : 'Negociar'}
              </button>;
          } },
        ]} />
      </>}</div>
    </Panel>
    {player && <RenewalForm key={player.id} career={career} team={team} player={player} onClose={() => setPlayerId('')} />}
  </div>;
}

function RenewalForm({ career, team, player, onClose }: { career: Career; team: Team; player: Player; onClose: () => void }) {
  const renew = useGameStore((state) => state.renew);
  const error = useGameStore((state) => state.error);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const firstField = useRef<HTMLSelectElement>(null);
  const titleId = useId();
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => {
    const dialog = dialogRef.current!;
    dialog.showModal();
    firstField.current?.focus();
    return () => dialog.close();
  }, []);
  const currentSalary = player.contract!.salary;
  const status = renewalStatus(career, player.id);
  const demand = status?.status === 'counter' ? status.demand : undefined;
  const [terms, setTerms] = useState<RenewalTerms>(() => demand ?? { years: 1, salary: currentSalary, bonus: currentSalary });
  const round = completedRounds(career);
  const weeks = career.league.schedule.length * (terms.years + 1) - round;
  const delta = terms.salary - currentSalary;
  const balance = team.budget - terms.bonus;
  const acceptsDemand = demand && terms.years === demand.years && terms.salary === demand.salary && terms.bonus === demand.bonus;
  const label = acceptsDemand ? 'Aceitar condições' : demand ? 'Enviar contraproposta' : 'Enviar proposta';
  const submit = (proposal: RenewalTerms | null) => {
    setSubmitted(true);
    renew(player.id, proposal);
  };
  return <dialog ref={dialogRef} className={views.clubDialog} aria-labelledby={titleId}
    onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <header className={views.clubDialogHeader}>
      <div>
        <h2 id={titleId}>Renovação · {player.name}</h2>
        <p><span className={styles.positionTag}>{positionLabels[player.primaryPosition]}</span> {player.age} anos · Força {player.overall} · {currency(currentSalary)}/mês</p>
      </div>
      <button type="button" className={styles.secondaryButton} aria-label="Fechar negociação" onClick={onClose}><Icon name="close" size={18} /></button>
    </header>
    {submitted && error && <p className={`${styles.error} ${views.renewalError}`}>{error}</p>}
    {status?.status === 'blocked' ? <p className={styles.tableNote}>A negociação pode ser retomada em {status.availableAfterRound - round} semana(s) de liga.</p> : <>
      {status?.status === 'counter' && <div className={styles.controls}>
        <p><strong>Contraproposta do jogador</strong><br />Mais {status.demand.years} ano(s) · {currency(status.demand.salary)}/mês · {currency(status.demand.bonus)} de luvas<br />
          <small>{status.attempts} de {maxRenewalAttempts} propostas enviadas</small></p>
        <button className={styles.secondaryButton} onClick={() => setTerms(status.demand)}>Usar condições pedidas</button>
        <button className={styles.secondaryButton} onClick={() => submit(null)}>Recusar contraproposta</button>
      </div>}
      <form className={`${styles.controls} ${views.renewalTerms}`} onSubmit={(event) => { event.preventDefault(); submit(terms); }}>
        <label className={styles.filterLabel}>Anos adicionais<select ref={firstField} value={terms.years} onChange={(event) => setTerms({ ...terms, years: Number(event.target.value) })}>
          {[1, 2, 3, 4].map((years) => <option key={years} value={years}>{years}</option>)}
        </select></label>
        <label className={styles.filterLabel}>Salário mensal (R$)<input type="number" required min={100} max={1e10} value={terms.salary} onChange={(event) => setTerms({ ...terms, salary: event.target.valueAsNumber || 0 })} /></label>
        <label className={styles.filterLabel}>Luvas (R$)<input type="number" required min={0} max={1e12} value={terms.bonus} onChange={(event) => setTerms({ ...terms, bonus: event.target.valueAsNumber || 0 })} /></label>
        <button className={styles.primaryButton} disabled={balance < 0}>{label}</button>
      </form>
      <h3 className={views.renewalFinanceTitle}>Impacto financeiro</h3>
      <div className={`${styles.dealSummary} ${views.renewalFinance}`} aria-label="Impacto financeiro da renovação">
        <div><span>Luvas em parcela única</span><strong>{currency(terms.bonus)}</strong></div>
        <div><span>Saldo após pagar as luvas</span><strong className={balance < 0 ? styles.loss : styles.accent}>{currency(balance)}</strong></div>
        <div><span>Nova folha mensal</span><strong>{currency(team.payroll + delta)}</strong></div>
        <div><span>Variação mensal na folha</span><strong>{delta > 0 ? '+' : ''}{currency(delta)}</strong></div>
        <div><span>Salários e luvas até o fim do contrato</span><strong>{currency(terms.bonus + terms.salary * weeks / 4)}</strong></div>
      </div>
      <p className={styles.tableNote}>As luvas só são pagas quando o jogador aceita a renovação. O novo salário começa na assinatura, e o custo estimado cobre {weeks} semanas de liga.</p>
    </>}
  </dialog>;
}
