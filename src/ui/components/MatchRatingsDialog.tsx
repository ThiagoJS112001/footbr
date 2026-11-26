import { useEffect, useId, useRef, useState } from 'react';
import type { Match, Team } from '../../engine/models';
import { matchRatings } from '../../engine/career/ratings';
import { DataTable } from './DataTable';
import { Icon } from './Icon';
import { TacticalPitch } from './TacticalPitch';
import styles from '../App.module.css';
import views from '../screens/ClubViews.module.css';

export function MatchRatingsDialog({ match, clubId, teams, playerNames, onClose }: {
  match: Match; clubId: string; teams: Map<string, Team>; playerNames: Map<string, string>; onClose: () => void;
}) {
  const [teamId, setTeamId] = useState(match.awayTeamId === clubId ? clubId : match.homeTeamId);
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  const ratings = matchRatings(match);
  const byPlayer = new Map(ratings.map((row) => [row.playerId, row]));
  const eventNames = new Map([
    ...(match.commentary ?? []).flatMap((event) => event.playerId && event.playerName ? [[event.playerId, event.playerName] as const] : []),
    ...match.events.flatMap((event) => event.type === 'goal' && event.playerName ? [[event.playerId, event.playerName] as const] : []),
  ]);
  const playerInfo = (id: string) => ({
    id, name: playerNames.get(id) ?? eventNames.get(id) ?? 'Jogador sem registro',
    rating: byPlayer.get(id)?.rating, minutes: byPlayer.get(id)?.minutes,
  });
  const lineup = teamId === match.homeTeamId ? match.homeLineup : match.awayLineup;
  const subs = [...new Set(match.events.flatMap((event) => event.type === 'substitution' && event.teamId === teamId ? [event.playerInId] : []))]
    .filter((id) => !lineup?.starterIds.includes(id)).map(playerInfo);
  return <dialog ref={ref} className={`${views.clubDialog} ${views.ratingsDialog}`} aria-labelledby={titleId}
    onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <header className={views.clubDialogHeader}>
      <div><h2 id={titleId}>Notas dos jogadores</h2>
        <p>{teams.get(match.homeTeamId)?.name} {match.score?.home} – {match.score?.away} {teams.get(match.awayTeamId)?.name}</p>
      </div>
      <button type="button" className={styles.secondaryButton} aria-label="Fechar notas" onClick={onClose}><Icon name="close" size={18} /></button>
    </header>
    {ratings.length && lineup ? <>
      <div className={`${views.tabs} ${views.ratingTabs}`} aria-label="Clube analisado">
        {[match.homeTeamId, match.awayTeamId].map((id) => <button key={id} type="button" aria-pressed={id === teamId}
          className={id === teamId ? styles.primaryButton : styles.secondaryButton} onClick={() => setTeamId(id)}>{teams.get(id)?.name}</button>)}
      </div>
      <div className={views.ratingLayout}>
        <div className={views.pitch}><TacticalPitch variant="lineup" formation={lineup.tactic.formation} ratingCards={lineup.starterIds.map(playerInfo)} /></div>
        <div className={views.ratingBench}>
          <h3>Reservas que entraram</h3>
          {subs.length ? <DataTable caption="Notas dos reservas" rows={subs} getRowId={(row) => row.id} columns={[
            { id: 'name', label: 'Jogador', render: (row) => row.name },
            { id: 'minutes', label: 'Min.', render: (row) => row.minutes ?? 0 },
            { id: 'rating', label: 'Nota', render: (row) => <strong className={styles.accent}>{row.rating?.toFixed(1).replace('.', ',') ?? '—'}</strong> },
          ]} /> : <p className={styles.tableNote}>Nenhum reserva entrou nesta partida.</p>}
          <p className={styles.tableNote}>A nota começa em 6 e varia com os lances registrados. Amarelo desconta 0,35 ponto e vermelho desconta 1,5 ponto, antes do arredondamento.</p>
        </div>
      </div>
    </> : <p className={styles.tableNote}>{match.forfeitTeamIds?.length ? 'Partida decidida por W.O.' : 'Esta partida não tem escalações registradas para calcular as notas.'}</p>}
  </dialog>;
}
