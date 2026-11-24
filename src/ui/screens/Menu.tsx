import { useId, useMemo, useState } from 'react';
import { ClipboardList, Database, FolderOpen, Megaphone, PlusCircle, Settings2 } from 'lucide-react';
import { decodeSave } from '../../engine/save/save';
import { Brand } from '../components/Brand';
import { Icon } from '../components/Icon';
import { SaveControls } from '../components/SaveControls';
import { TacticalPitch } from '../components/TacticalPitch';
import { saveKey, useGameStore } from '../store/gameStore';
import { decodeStoredSave } from '../store/saveStorage';
import styles from './Menu.module.css';

function readSavedCareers() {
  return [0, 1, 2, 3].flatMap((slot) => {
    try {
      const raw = localStorage.getItem(saveKey(slot));
      if (!raw) return [];
      const { career } = decodeSave(decodeStoredSave(raw));
      const team = career.league.teams.find(({ id }) => id === career.selectedTeamId);
      return team ? [{ slot, team, season: career.season }] : [];
    } catch {
      return [];
    }
  });
}

const features = [
  'Dispute três divisões e a Copa dos Horizontes.',
  'Monte a escalação e ajuste as táticas do seu clube.',
  'Negocie transferências e desenvolva jogadores na base.',
  'Importe dados e monte sua própria base de clubes.',
];

export function Menu() {
  const { startNewGame, selectedTeamId, navigate, error, live, isAdvancing, loadGame, saveStatus, lineup, season, source } = useGameStore();
  const [showSaves, setShowSaves] = useState(false);
  const savesId = useId();
  const saves = useMemo(readSavedCareers, [saveStatus]);
  const canLoad = !live && !isAdvancing;
  const formation = lineup?.tactic.formation ?? '4-4-2';

  return <main className={styles.menu}>
    <header className={styles.header}>
      <Brand />
      <span>FUTEBOL. DO SEU JEITO.</span>
    </header>
    <div className={styles.columns}>
      <section className={styles.intro}>
        <div className={styles.kicker}>Uma nova carreira no futebol</div>
        <h1>Seu clube.<br />Sua <em>história.</em></h1>
        <p>Assuma um clube, monte seu elenco e leve sua equipe da primeira escalação à última rodada.</p>
        <div className={styles.actions}>
          <button className={styles.continue} disabled={!selectedTeamId && (!canLoad || !saves.length)}
            onClick={() => selectedTeamId ? navigate('dashboard') : loadGame(saves[0].slot)}>
            <Icon name="match" /> {live ? 'Retomar partida' : 'Continuar jogo'} <Icon name="next" />
          </button>
          <button disabled={!!live} onClick={() => startNewGame()}>
            <PlusCircle aria-hidden="true" /> Novo jogo <Icon name="next" />
          </button>
          <button aria-expanded={showSaves} aria-controls={savesId} onClick={() => setShowSaves(!showSaves)}>
            <FolderOpen aria-hidden="true" /> Carregar save <Icon name="next" />
          </button>
        </div>
        <div className={styles.shortcuts}>
          <button disabled={!!live} onClick={() => navigate('data-import')}><Database aria-hidden="true" /> Importação de Dados</button>
          <button disabled={!!live} onClick={() => navigate('base-editor')}><Settings2 aria-hidden="true" /> Editor de clubes e elencos</button>
        </div>
      </section>

      <div className={styles.middle}>
        <section className={styles.panel}>
          <div className={styles.panelHeading}>
            <h2><Icon name="save" /> Saves locais</h2>
            <button className={styles.link} aria-expanded={showSaves} aria-controls={savesId} onClick={() => setShowSaves(!showSaves)}>
              {showSaves ? 'Fechar' : 'Ver todos'} <Icon name="next" size={16} />
            </button>
          </div>
          {saves.length ? <ul className={styles.saves}>
            {saves.slice(0, showSaves ? saves.length : 3).map(({ slot, team, season }) => <li key={slot}>
              <span className={styles.slot} aria-hidden="true">{slot || 'A'}</span>
              <div><strong>{team.name}</strong><small><Icon name="calendar" size={15} /> Temporada {season} · Série {['A', 'B', 'C'][team.division - 1]}</small></div>
              <button disabled={!canLoad} aria-label={`Carregar save ${slot ? `do slot ${slot}` : 'automático'} de ${team.name}`} onClick={() => loadGame(slot)}>
                <Icon name="match" size={18} />
              </button>
            </li>)}
          </ul> : <div className={styles.empty}>
            <FolderOpen aria-hidden="true" />
            <strong>Nenhuma carreira salva</strong>
            <span>Inicie um novo jogo ou importe um save.</span>
          </div>}
          <div id={savesId} hidden={!showSaves}>{showSaves && <SaveControls compact />}</div>
          {error && <p role="alert" className={styles.error}>{error}</p>}
        </section>
        <section className={styles.panel}>
          <div className={styles.panelHeading}><h2><Megaphone aria-hidden="true" /> Recursos da carreira</h2></div>
          <ul className={styles.features}>
            {features.map((feature) => <li key={feature}><Icon name="check" size={18} /> {feature}</li>)}
          </ul>
        </section>
      </div>

      <section className={`${styles.panel} ${styles.tactics}`}>
        <div className={styles.panelHeading}><h2><ClipboardList aria-hidden="true" /> Configuração da temporada</h2></div>
        <div className={styles.pitch}><TacticalPitch formation={formation} /></div>
        <div className={styles.seasonInfo}>
          <div><Icon name="lineup" /><span>Formação</span><strong>{formation}</strong></div>
          <div><Database aria-hidden="true" /><span>Base</span><strong>{source ? 'Importada' : 'Fictícia'}</strong></div>
          <div><Icon name="calendar" /><span>Temporada</span><strong>{season}</strong></div>
        </div>
      </section>
    </div>
    <div className={styles.numbers} aria-label="Formato do campeonato">
      <div><Icon name="squad" /><strong>60</strong><span>clubes</span></div>
      <div><Icon name="cup" /><strong>3</strong><span>divisões</span></div>
      <div><Icon name="calendar" /><strong>38</strong><span>rodadas por divisão</span></div>
    </div>
    <footer className={styles.footer}><span>UM NOVO JEITO DE VIVER O FUTEBOL.</span><span>FootBR · Manager de Futebol</span></footer>
  </main>;
}
