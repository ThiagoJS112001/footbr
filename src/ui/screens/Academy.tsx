import { useState } from 'react';
import { careerOf, useGameStore } from '../store/gameStore';
import { prospectReport, prospectSalary } from '../../engine/career/academy';
import { careerConfig } from '../../engine/career/config';
import { rosterSize } from '../../engine/career/market';
import { ownTeam } from '../../engine/career/world';
import { ClubMetrics, Level } from '../components/ClubMetrics';
import { DataTable } from '../components/DataTable';
import { Icon } from '../components/Icon';
import { PageHeader } from '../components/PageHeader';
import { PlayerTraitBadge } from '../components/PlayerTraitBadge';
import { currency, positionLabels } from '../utils';
import styles from '../App.module.css';
import views from './ClubViews.module.css';

export function AcademyScreen() {
  const state = useGameStore();
  const career = careerOf(state);
  const { academy, board } = career.systems;
  const team = ownTeam(career);
  const [tab, setTab] = useState('Elenco');
  const [sort, setSort] = useState('potential');
  const [selectedId, setSelectedId] = useState(academy.prospects[0]?.player.id);
  const assessedPotential = (prospect: (typeof academy.prospects)[number]) => prospect.assessed ? prospectReport(prospect.player, team).high : 0;
  const rows = academy.prospects.filter((p) => tab === 'Avaliações' ? p.assessed : tab === 'Promoções' ? p.status === 'promoted' : true).sort((a, b) =>
    sort === 'age' ? a.player.age - b.player.age : (sort === 'potential' ? assessedPotential(b) - assessedPotential(a) : 0) || b.player.overall - a.player.overall);
  const selected = rows.find((p) => p.player.id === selectedId) ?? rows[0];
  const report = selected?.assessed ? prospectReport(selected.player, team) : null;
  const salary = selected ? prospectSalary(selected.player.overall) : 0;
  const available = selected?.status === 'available' && board.status === 'active';
  const active = academy.prospects.filter((p) => p.status === 'available');

  return <>
    <PageHeader eyebrow="FORMAÇÃO DE TALENTOS" title="Categorias de Base" description="Revele talentos, avalie o potencial e promova jovens ao elenco principal." />
    <ClubMetrics items={[
      { icon: 'squad', label: 'Jogadores na base', value: active.length },
      { icon: 'target', label: 'Alto potencial avaliado', value: active.filter((p) => assessedPotential(p) >= 80).length },
      { icon: 'trend', label: 'Promoções utilizadas', value: `${academy.promoted}/${careerConfig.maxPromotions}` },
      { icon: 'finances', label: 'Custo da avaliação', value: currency(careerConfig.assessmentFee) },
    ]} />
    <div className={views.tabs} aria-label="Categorias de Base">
      {(['Elenco', 'Avaliações', 'Promoções'] as const).map((name, index) => <button key={name} aria-pressed={name === tab} className={name === tab ? styles.primaryButton : styles.secondaryButton} onClick={() => setTab(name)}>
        <Icon name={(['squad', 'news', 'trend'] as const)[index]} size={17} />{name}{index === 0 && ` (${active.length})`}
      </button>)}
    </div>
    <div className={`${views.split} ${views.academy}`}>
      <section className={`${styles.panel} ${views.surface}`}>
        <div className={styles.tableToolbar}><div><h2>{tab === 'Elenco' ? 'Elenco da base' : tab}</h2><span className={styles.muted}>Selecione um jogador para abrir o perfil.</span></div>
          <label className={styles.filterLabel}>Ordenar por<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="potential">Potencial avaliado</option><option value="overall">Força (maior)</option><option value="age">Idade (menor)</option></select></label>
        </div>
        <DataTable caption={tab} rows={rows} getRowId={({ player }) => player.id} getRowClassName={(p) => p === selected ? styles.selectedRow : ''} columns={[
          { id: 'name', label: 'Jogador', render: ({ player }) => <button className={`${styles.playerButton} ${views.inline}`} aria-pressed={player.id === selected?.player.id} onClick={() => setSelectedId(player.id)}><Icon name="shirt" size={23} className={views.headingIcon} />{player.name}</button> },
          { id: 'position', label: 'Posição', render: ({ player }) => <span className={styles.positionTag}>{positionLabels[player.primaryPosition]}</span> },
          { id: 'age', label: 'Idade', render: ({ player }) => player.age },
          { id: 'overall', label: 'Geral', render: ({ player }) => <span className={styles.rating}>{player.overall}</span> },
          { id: 'potential', label: 'Potencial', render: (p) => p.assessed ? <Stars value={assessedPotential(p)} /> : '—' },
          { id: 'status', label: 'Status', render: ({ status, player }) => status === 'available' ? <PlayerTraitBadge player={player} /> : status === 'promoted' ? 'Promovido' : 'Dispensado' },
        ]} />
      </section>
      {selected && <section className={`${styles.panel} ${views.surface} ${views.summary}`} aria-label="Perfil do jogador da base">
        <div className={views.profileTop}>
          <Icon name="shirt" size={54} className={views.headingIcon} />
          <div><h2>{selected.player.name}</h2><span className={styles.positionTag}>{positionLabels[selected.player.primaryPosition]}</span> <span>{selected.player.age} anos</span></div>
          <span className={`${styles.rating} ${views.profileRating}`} aria-label="Força geral">{selected.player.overall}</span>
        </div>
        <div className={views.profile}>
          <div><strong>Perfil</strong><dl className={styles.financeSummary}>
            <div><dt>Estilo</dt><dd><PlayerTraitBadge player={selected.player} /></dd></div>
            <div><dt>Potencial</dt><dd>{report ? <Stars value={report.high} /> : 'Ainda não avaliado'}</dd></div>
            <div><dt>Salário (base)</dt><dd>{currency(salary)}</dd></div>
            <div><dt>Luvas de promoção</dt><dd>{currency(salary * 2)}</dd></div>
          </dl></div>
          <div><strong>Evolução</strong><p className={styles.muted}>{report ? `${report.low}–${report.high} · faixa estimada` : 'Avalie o jogador para estimar sua margem de evolução.'}</p>
            {report && <Level label="Força atual em relação ao potencial estimado" value={100 * selected.player.overall / report.high} />}
          </div>
        </div>
        <p className={styles.notice}>{selected.status === 'promoted' ? 'Já faz parte do elenco profissional.' : selected.status === 'released' ? 'Dispensado desta seleção da base.' : report ? `${report.readiness} ${report.development} ${report.uncertainty}` : 'O departamento de base ainda não emitiu um parecer.'}</p>
        <div className={views.inline} style={{ flexWrap: 'wrap' }}>
          <button className={styles.secondaryButton} aria-label={`Avaliar ${selected.player.name}`} disabled={!available || selected.assessed || team.budget < careerConfig.assessmentFee} onClick={() => state.assessYouth(selected.player.id)}>Avaliar jogador</button>
          <button className={styles.primaryButton} aria-label={`Promover ${selected.player.name}`} disabled={!available || academy.promoted >= careerConfig.maxPromotions || team.budget < salary * 2 || rosterSize(career, team.id) >= 35} onClick={() => state.promoteYouth(selected.player.id)}>Promover ao principal</button>
          <button className={styles.textButton} disabled={!available} onClick={() => state.releaseYouth(selected.player.id)}>Dispensar</button>
        </div>
      </section>}
    </div>
  </>;
}

function Stars({ value }: { value: number }) {
  const filled = Math.round(value / 20);
  return <span className={views.stars} role="img" aria-label={`${filled} de 5 estrelas`}>{'★'.repeat(filled)}{'☆'.repeat(5 - filled)}</span>;
}
