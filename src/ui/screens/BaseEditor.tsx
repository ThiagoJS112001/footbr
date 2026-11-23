import { useMemo, useState } from 'react';
import type { Player, PlayerPosition } from '../../engine/models';
import { createCareer } from '../../engine/career/career';
import { createCustomCareer, decodeCustomBase, editablePositions } from '../../engine/career/customBase';
import type { CustomBase } from '../../engine/career/customBase';
import { worldTeams } from '../../engine/career/world';
import { useGameStore } from '../store/gameStore';
import { PageHeader } from '../components/PageHeader';
import { positionLabels } from '../utils';
import styles from '../App.module.css';

export function BaseEditor() {
  const { navigate, startCustomGame } = useGameStore();
  const [base, setBase] = useState<CustomBase>(() => ({ version: 1, seed: crypto.getRandomValues(new Uint32Array(1))[0], clubs: {}, players: {} }));
  const [clubId, setClubId] = useState('');
  const [error, setError] = useState('');
  const teams = useMemo(() => worldTeams(createCareer(base.seed, true)), [base.seed]);
  const club = teams.find((team) => team.id === clubId) ?? teams[0];
  const editPlayer = (player: Player, change: Partial<CustomBase['players'][string]>) => {
    const { name, age, overall, primaryPosition } = player;
    setBase((previous) => ({ ...previous, players: { ...previous.players,
      [player.id]: { ...(previous.players[player.id] ?? { name, age, overall, primaryPosition }), ...change } } }));
  };
  const raw = () => JSON.stringify(base, null, 2);
  const validate = () => createCustomCareer(decodeCustomBase(raw()));
  const run = async (action: () => void | Promise<void>) => {
    try { await action(); setError(''); }
    catch (problem) { setError(problem instanceof Error ? problem.message : 'Falha ao processar a base.'); }
  };
  return <main className={styles.selection}>
    <button className={styles.textButton} onClick={() => navigate('menu')}>Voltar ao menu</button>
    <PageHeader eyebrow="NOVA CARREIRA" title="Editor de clubes e elencos" description="Edite a base fictícia, exporte uma cópia ou comece uma carreira com suas mudanças." />
    <div className={styles.controls}>
      <label className={styles.filterLabel}>Clube<select value={club.id} onChange={(event) => setClubId(event.target.value)}>
        {teams.map((team) => <option key={team.id} value={team.id}>D{team.division} · {base.clubs[team.id] ?? team.name}</option>)}
      </select></label>
      <label className={styles.filterLabel}>Nome do clube<input maxLength={100} value={base.clubs[club.id] ?? club.name} onChange={(event) => setBase({ ...base, clubs: { ...base.clubs, [club.id]: event.target.value } })} /></label>
      <label className={styles.filterLabel}>Importar JSON<input type="file" accept="application/json,.json" onChange={(event) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = '';
        if (file) void run(async () => {
          if (file.size > 1_000_000) throw new Error('Arquivo de base muito grande.');
          const imported = decodeCustomBase(await file.text());
          createCustomCareer(imported);
          setClubId('');
          setBase(imported);
        });
      }} /></label>
      <button className={styles.secondaryButton} onClick={() => void run(() => {
        validate();
        const url = URL.createObjectURL(new Blob([raw()], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = 'footbr-base.json';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      })}>Exportar JSON</button>
      <button className={styles.primaryButton} onClick={() => void run(() => startCustomGame(validate()))}>Jogar com esta base</button>
    </div>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <section className={styles.panel}>
      <ul className={styles.compactList}>{club.squad.map((player, index) => {
        const current = base.players[player.id] ?? player;
        return <li key={player.id}><div className={styles.controls}>
          <label className={styles.filterLabel}>Jogador {index + 1}<input maxLength={100} value={current.name} onChange={(event) => editPlayer(player, { name: event.target.value })} /></label>
          <label className={styles.filterLabel}>Posição<select value={current.primaryPosition} onChange={(event) => editPlayer(player, { primaryPosition: event.target.value as PlayerPosition })}>{editablePositions.map((position) => <option key={position} value={position}>{positionLabels[position]}</option>)}</select></label>
          <label className={styles.filterLabel}>Idade<input type="number" min={16} max={60} value={current.age || ''} onChange={(event) => editPlayer(player, { age: Number(event.target.value) })} /></label>
          <label className={styles.filterLabel}>Força<input type="number" min={1} max={99} value={current.overall || ''} onChange={(event) => editPlayer(player, { overall: Number(event.target.value) })} /></label>
        </div></li>;
      })}</ul>
    </section>
  </main>;
}
