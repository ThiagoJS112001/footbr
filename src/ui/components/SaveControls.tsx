import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import styles from '../App.module.css';

export function SaveControls({ compact = false }: { compact?: boolean }) {
  const { selectedTeamId, live, isAdvancing, saveGame, loadGame, exportGame, importGame, season } = useGameStore();
  const [slot, setSlot] = useState(0);
  const canLoad = !live && !isAdvancing;
  return <div className={compact ? styles.saveCompact : styles.controls}>
    <label className={styles.filterLabel}>Arquivo<select value={slot} onChange={(e) => setSlot(Number(e.target.value))}><option value={0}>Automático</option>{[1, 2, 3].map((n) => <option value={n} key={n}>Slot {n}</option>)}</select></label>
    {selectedTeamId && <button className={styles.secondaryButton} onClick={() => saveGame(slot)}>Salvar</button>}
    <button className={styles.secondaryButton} disabled={!canLoad} onClick={() => loadGame(slot)}>Carregar</button>
    {selectedTeamId && <button className={styles.textButton} onClick={() => {
      const raw = exportGame();
      if (!raw) return;
      const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `footbr-temporada-${season}.json`; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }}>Exportar save</button>}
    <label className={styles.importLabel}>Importar save<input type="file" accept=".json,application/json" disabled={!canLoad} onChange={async (e) => {
      const file = e.target.files?.[0];
      if (file) {
        try { if (file.size > 30_000_000) throw new Error('Arquivo muito grande.'); importGame(await file.text()); }
        catch { useGameStore.setState({ error: 'Não foi possível ler o arquivo de save.' }); }
      }
      e.target.value = '';
    }} /></label>
  </div>;
}
