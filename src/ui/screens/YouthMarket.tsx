import { useState } from 'react';
import type { Career } from '../../engine/career/career';
import { isWindowOpen } from '../../engine/career/career';
import { spendingRoom } from '../../engine/career/market';
import { youthCandidates, youthEvaluation, youthRivals } from '../../engine/career/youthMarket';
import { ownTeam } from '../../engine/career/world';
import { ClubBadge } from '../components/ClubBadge';
import { DataTable } from '../components/DataTable';
import { Panel } from '../components/Panel';
import { useGameStore } from '../store/gameStore';
import { currency, positionLabels } from '../utils';
import styles from '../App.module.css';
import views from './ClubViews.module.css';

export function YouthMarket({ career }: { career: Career }) {
  const { currentRound, scoutYouthMarket, offerYouthMarket } = useGameStore();
  const [age, setAge] = useState('');
  const [position, setPosition] = useState('');
  const [clubId, setClubId] = useState('');
  const [ceiling, setCeiling] = useState(0);
  const [selected, setSelected] = useState('');
  const [offer, setOffer] = useState(0);
  const buyer = ownTeam(career);
  const all = youthCandidates(career).map(({ team, prospect }) => ({ team, prospect, ...youthEvaluation(career, buyer.id, prospect) }));
  const rows = all.filter(({ team, prospect: { player }, price }) => (!age || player.age === Number(age)) && (!position || player.primaryPosition === position)
    && (!clubId || team.id === clubId) && (!ceiling || price <= ceiling));
  const clubs = new Map(all.map((row) => [row.team.id, row.team]));
  const player = all.find((row) => row.prospect.player.id === selected);
  const rivals = player ? youthRivals(career, player.team, player.prospect, currentRound) : [];
  const closed = !isWindowOpen(currentRound) || career.systems.board.status !== 'active';
  return <div className={views.stack}>
    <Panel title="Jovens Promessas" icon="academy" className={views.surface}>
      <div className={styles.controls}>
        <label className={styles.filterLabel}>Idade<select value={age} onChange={(e) => setAge(e.target.value)}><option value="">Todas</option>{[16, 17, 18, 19].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className={styles.filterLabel}>Posição<select value={position} onChange={(e) => setPosition(e.target.value)}><option value="">Todas</option>{Object.entries(positionLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        <label className={styles.filterLabel}>Clube<select value={clubId} onChange={(e) => setClubId(e.target.value)}><option value="">Todos</option>{[...clubs.values()].sort((a, b) => a.name.localeCompare(b.name)).map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}</select></label>
        <label className={styles.filterLabel}>Valor estimado máximo (R$)<input type="number" inputMode="numeric" min={0} placeholder="Sem limite" value={ceiling || ''} onChange={(e) => setCeiling(Number(e.target.value))} /></label>
      </div>
      <DataTable key={`${age}:${position}:${clubId}:${ceiling}`} caption="Jovens de outros clubes" rows={rows} pageSize={12} getRowId={(row) => row.prospect.player.id} columns={[
        { id: 'name', label: 'Jogador', render: (row) => <button className={styles.textButton} onClick={() => { setSelected(row.prospect.player.id); setOffer(row.price); }}>{row.prospect.player.name}</button> },
        { id: 'club', label: 'Clube', render: ({ team }) => <span className={styles.tableClub}><ClubBadge name={team.name} image={team.identity?.facts.image} />{team.name}</span> },
        { id: 'age', label: 'Idade', render: ({ prospect }) => prospect.player.age },
        { id: 'position', label: 'Pos.', render: ({ prospect }) => positionLabels[prospect.player.primaryPosition] },
        { id: 'strength', label: 'Força', render: ({ prospect }) => prospect.player.overall },
        { id: 'potential', label: 'Potencial estimado', render: (row) => `${row.low}–${row.high} · ${row.confidence}% de confiança` },
        { id: 'fee', label: 'Valor estimado', sortValue: (row) => row.price, render: (row) => currency(row.price) },
      ]} />
    </Panel>
    {player && <Panel title={player.prospect.player.name} icon="academy" className={views.surface}>
      <p className={styles.tableNote}>Potencial estimado {player.low}–{player.high} · {player.confidence}% de confiança · {rivals.length ? `Interesse de ${rivals.map((club) => club.name).join(' e ')}.` : 'Sem concorrência identificada.'}</p>
      <div className={styles.controls}><button className={styles.secondaryButton} disabled={career.systems.board.status !== 'active' || player.level >= 3 || buyer.budget < (player.level + 1) * 3500}
        onClick={() => scoutYouthMarket(selected)}>{player.level >= 3 ? 'Avaliação completa' : `Solicitar observação · ${currency((player.level + 1) * 3500)}`}</button></div>
      <form className={styles.controls} onSubmit={(event) => { event.preventDefault(); offerYouthMarket(selected, offer); }}>
        <label className={styles.filterLabel}>Proposta pelos direitos (R$)<input type="number" value={offer} min={1000} required onChange={(e) => setOffer(Number(e.target.value))} /></label>
        <button className={styles.primaryButton} disabled={closed || offer > spendingRoom(buyer)}>Enviar proposta para a base</button>
      </form>
      <p className={styles.tableNote}>Verba disponível preservando a folha: {currency(spendingRoom(buyer))}. {closed ? 'Negociações disponíveis na janela de transferências.' : 'O atleta contratado entra na base e pode ser promovido posteriormente.'}</p>
    </Panel>}
  </div>;
}
