import { useEffect, useId, useRef, useState } from 'react';
import type { Career } from '../../engine/career/career';
import { awardLabels } from '../../engine/career/awardTypes';
import type { AwardCampaign, AwardSelection, CompetitionAwards } from '../../engine/career/awardTypes';
import { Icon } from '../components/Icon';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { DataTable } from '../components/DataTable';
import { PlayerHonors } from '../components/PlayerHonors';
import { TacticalPitch } from '../components/TacticalPitch';
import { careerOf, useGameStore } from '../store/gameStore';
import { formationLabel, positionLabels } from '../utils';
import styles from '../App.module.css';
import views from './ClubViews.module.css';
import awards from './Awards.module.css';

const rating = (value: number) => value.toFixed(2).replace('.', ',');
const individualKinds = ['golden-ball', 'golden-boot', 'breakthrough', 'golden-glove', 'coach'] as const;
const competitionOrder = { league: 0, cup: 1, continental: 2, 'continental-secondary': 3, state: 4 };

function AthleteDialog({ career, player, onClose }: { career: Career; player: AwardCampaign; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return <dialog ref={ref} className={views.clubDialog} aria-labelledby={titleId}
    onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <header className={views.clubDialogHeader}><div><h2 id={titleId}>{player.playerName}</h2>
      <p>{positionLabels[player.position]} · {player.teamName}</p></div>
      <button className={styles.secondaryButton} onClick={onClose} aria-label="Fechar ficha"><Icon name="close" size={18} /></button>
    </header>
    <PlayerHonors career={career} playerId={player.playerId} />
  </dialog>;
}

function Selection({ title, selection, inspect }: { title: string; selection: AwardSelection | null; inspect: (player: AwardCampaign) => void }) {
  return <Panel title={title} icon="lineup" className={awards.panel} action={selection && <span className={styles.pill}>{formationLabel(selection.formation)}</span>}>
    {selection ? <div className={awards.selection}>
      <TacticalPitch formation={selection.formation} variant="lineup" ratingCards={selection.players.map((player) =>
        ({ name: player.playerName, club: player.teamName, appearances: player.games, rating: player.average }))} />
      <DataTable caption={title} rows={selection.players} getRowId={(player) => player.playerId} columns={[
        { id: 'position', label: 'Pos.', render: (player) => positionLabels[player.slot] },
        { id: 'player', label: 'Jogador', render: (player) => <button className={awards.playerLink} onClick={() => inspect(player)}>{player.playerName}</button> },
        { id: 'club', label: 'Clube', render: (player) => player.teamName },
        { id: 'rating', label: 'Nota', render: (player) => <strong className={awards.gold}>{rating(player.average)}</strong> },
        { id: 'appearances', label: 'J', render: (player) => player.games },
      ]} />
    </div> : <p className={styles.tableNote}>Sem dados suficientes para montar uma seleção com 11 jogadores.</p>}
  </Panel>;
}

function Edition({ edition, inspect, showSelection }: { edition: CompetitionAwards; inspect: (player: AwardCampaign) => void; showSelection: () => void }) {
  return <Panel title={edition.name} icon="cup" className={awards.panel}
    action={edition.selection && <button className={styles.textButton} onClick={showSelection}>Ver seleção <Icon name="arrow" size={16} /></button>}>
    <div className={awards.collective}>
      <div><span>Campeão</span><strong className={awards.gold}>{edition.champion.teamName}</strong></div>
      <div><span>Vice-campeão</span><strong>{edition.runnerUp.teamName}</strong></div>
      {!!edition.promoted.length && <div><span>Promovidos</span><strong>{edition.promoted.map((club) => club.teamName).join(' · ')}</strong></div>}
      {!!edition.relegated.length && <div><span>Rebaixados</span><strong>{edition.relegated.map((club) => club.teamName).join(' · ')}</strong></div>}
    </div>
    <div className={awards.cards}>{individualKinds.map((kind) => {
      if (kind === 'coach') {
        const winner = edition.coach;
        return <article key={kind} className={awards.card}><span>{awardLabels[kind]}</span>
          <strong>{winner?.name ?? 'Sem premiação'}</strong>
          {winner && <><small>{winner.teamName}</small><small>{Math.round(winner.pointsRate * 100)}% de aproveitamento · Meta {winner.expected}º</small></>}
        </article>;
      }
      const winner = edition.players.find((entry) => entry.kind === kind)?.winner;
      const detail = winner && (kind === 'golden-boot' ? `${winner.goals} gols em ${winner.games} jogos`
        : kind === 'golden-glove' ? `${winner.cleanSheets} jogos sem sofrer gols` : `Nota ${rating(winner.average)} · ${winner.games} jogos`);
      return <article key={kind} className={awards.card}><span>{awardLabels[kind]}</span>
        {winner ? <><button className={awards.playerLink} onClick={() => inspect(winner)}>{winner.playerName}</button>
          <small>{winner.teamName}</small><small>{detail}</small></> : <strong>Sem premiação</strong>}
      </article>;
    })}</div>
  </Panel>;
}

export function AwardArchive({ career, ceremony = false }: { career: Career; ceremony?: boolean }) {
  const all = career.systems.competitionAwards ?? [];
  const seasons = [...new Set(all.map((edition) => edition.season))].sort((a, b) => b - a);
  const [season, setSeason] = useState(ceremony ? career.season : seasons[0] ?? career.season);
  const [competition, setCompetition] = useState('all');
  const [player, setPlayer] = useState<AwardCampaign | null>(null);
  const editions = all.filter((edition) => edition.season === season).sort((a, b) =>
    competitionOrder[a.kind] - competitionOrder[b.kind] || (a.division ?? 0) - (b.division ?? 0) || a.name.localeCompare(b.name, 'pt-BR') || a.id.localeCompare(b.id));
  const selected = editions.find((edition) => edition.id === competition);
  const closing = career.systems.seasonAwards?.find((entry) => entry.season === season);
  const coachedClubs = new Set(closing?.coachedClubs ?? (career.selectedTeamId ? [career.selectedTeamId] : []));
  const highlights = editions.flatMap((edition) => [
    ...(edition.coach?.user ? [{ label: awardLabels.coach, detail: edition.coach.name }] : []),
    ...(coachedClubs.has(edition.champion.teamId) ? [{ label: 'Campeão', detail: edition.champion.teamName }] : []),
    ...edition.promoted.filter((club) => coachedClubs.has(club.teamId)).map((club) => ({ label: 'Acesso', detail: club.teamName })),
    ...edition.players.filter(({ winner }) => coachedClubs.has(winner.teamId)).map(({ kind, winner }) => ({ label: awardLabels[kind], detail: winner.playerName })),
    ...(edition.selection?.players ?? []).filter((winner) => coachedClubs.has(winner.teamId)).map((winner) => ({ label: awardLabels.selection, detail: winner.playerName })),
  ].map((item) => ({ ...item, edition })));
  const competitionPicker = useRef<HTMLSelectElement>(null);
  const showSelection = (id: string) => {
    setCompetition(id);
    competitionPicker.current?.focus();
  };
  return <div className={awards.archive}>
    <div className={awards.filters}>
      {!ceremony && !!seasons.length && <label className={styles.filterLabel}>Temporada
        <select value={season} onChange={(event) => { setSeason(Number(event.target.value)); setCompetition('all'); }}>
          {seasons.map((year) => <option key={year} value={year}>Temporada {year}</option>)}
        </select>
      </label>}
      <label className={styles.filterLabel}>Competição
        <select ref={competitionPicker} value={competition} onChange={(event) => setCompetition(event.target.value)}>
          <option value="all">Todas as competições</option>
          {editions.map((edition) => <option key={edition.id} value={edition.id}>{edition.name}
            {editions.some((other) => other.id !== edition.id && other.name === edition.name) ? ` · ${edition.champion.teamName}` : ''}</option>)}
        </select>
      </label>
    </div>
    {player && <AthleteDialog career={career} player={player} onClose={() => setPlayer(null)} />}
    {ceremony && !selected && <Panel title="Destaques da carreira" icon="cup" className={awards.panel}>
      {highlights.length ? <ul className={awards.highlights}>{highlights.map(({ edition, label, detail }, index) =>
        <li key={`${edition.id}-${index}`}><Icon name="cup" size={17} /><span><strong>{detail}</strong><small>{label} · {edition.name}</small></span></li>
      )}</ul> : <p className={styles.tableNote}>Nenhum prêmio ou título registrado para sua carreira nesta temporada.</p>}
    </Panel>}
    {!selected && closing && <Selection title="Seleção da Temporada" selection={closing.selection} inspect={setPlayer} />}
    {selected && <Selection title={awardLabels.selection} selection={selected.selection} inspect={setPlayer} />}
    {(selected ? [selected] : editions).map((edition) => <Edition key={edition.id} edition={edition} inspect={setPlayer}
      showSelection={() => showSelection(edition.id)} />)}
    {!editions.length && <Panel title="Histórico de premiações" icon="cup"><p className={styles.tableNote}>As premiações ficam disponíveis assim que uma competição termina.</p></Panel>}
  </div>;
}

export function SeasonAwardsScreen() {
  const state = useGameStore();
  const career = careerOf(state);
  return <>
    <div className={awards.hero}>
      <PageHeader eyebrow={`TEMPORADA ${career.season}`} title="Premiações da Temporada"
        description="Veja os campeões, a seleção da temporada e as conquistas que entram para a história da carreira.">
        <button className={styles.primaryButton} onClick={state.beginNextSeason}>Começar próxima temporada <Icon name="arrow" size={18} /></button>
      </PageHeader>
    </div>
    <AwardArchive career={career} ceremony />
  </>;
}
