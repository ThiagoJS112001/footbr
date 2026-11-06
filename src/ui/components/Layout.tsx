import type { ReactNode } from 'react';
import type { League, Team } from '../../engine/models';
import { careerOf, useGameStore } from '../store/gameStore';
import { dueCupRound } from '../../engine/career/cup';
import { seasonComplete } from '../../engine/career/progression';
import type { GameScreen } from '../store/gameStore';
import { ClubBadge } from './ClubBadge';
import { Icon } from './Icon';
import { padRound, seasonDate } from '../utils';
import { SaveControls } from './SaveControls';
import { Brand } from './Brand';
import styles from '../App.module.css';

const navigation: { screen: GameScreen; label: string }[] = [
  { screen: 'dashboard', label: 'Central do Clube' }, { screen: 'squad', label: 'Elenco' },
  { screen: 'lineup', label: 'Escalação' }, { screen: 'match', label: 'Partida' },
  { screen: 'standings', label: 'Classificação' }, { screen: 'calendar', label: 'Calendário' },
  { screen: 'cup', label: 'Copa' }, { screen: 'academy', label: 'Categorias de Base' },
  { screen: 'market', label: 'Mercado' }, { screen: 'finances', label: 'Finanças' }, { screen: 'history', label: 'História' },
  { screen: 'board', label: 'Diretoria' },
];

export function Layout({ league, team, children }: { league: League; team: Team; children: ReactNode }) {
  const state = useGameStore();
  const { screen, navigate, currentRound, season, live, isAdvancing, kickOff, error, message, saveStatus } = state;
  const career = careerOf(state);
  const complete = seasonComplete(career);
  const cup = dueCupRound(career);
  const dismissed = career.systems.board.status === 'dismissed';
  const advance = () => {
    if (dismissed) { navigate('board'); return; }
    if (screen === 'lineup') kickOff();
    else navigate(screen === 'match' ? 'dashboard' : 'lineup');
  };
  return <div className={styles.appShell}>
    <a className={styles.skipLink} href="#main-content">Pular para o conteúdo</a>
    <aside className={styles.sidebar}>
      <Brand />
      <p className={styles.navCaption}>SEU CLUBE. SUA HISTÓRIA.</p>
      <nav aria-label="Navegação principal">{navigation.map((item) => <button key={item.screen} title={item.label} disabled={!!live && item.screen !== 'match'} onClick={() => navigate(item.screen)} className={screen === item.screen ? styles.activeNav : ''} aria-current={screen === item.screen ? 'page' : undefined}><Icon name={item.screen} />{item.label}{screen === item.screen && <span className={styles.navIndicator} />}</button>)}</nav>
      <div className={styles.sidebarBottom}><div className={styles.seasonMarker}><span className={styles.liveDot} /><span>TEMPORADA {padRound(season)}</span></div><button onClick={() => navigate('menu')} className={styles.textButton}><Icon name="exit" />Menu e saves</button></div>
    </aside>
    <div className={styles.workspace}>
      <header className={styles.topbar}>
        <div className={styles.topbarClub}><ClubBadge name={team.name} size="large" /><div><strong>{team.name}</strong><span><Icon name="user" size={14} />Você · Treinador</span></div></div>
        <div className={styles.topbarActions}><div className={styles.dateBlock}><Icon name="calendar" size={25} /><div><strong>{seasonDate(season, cup?.afterRound ?? currentRound, cup ? 5 : !!live || complete)}</strong><span>{complete ? 'Temporada encerrada' : cup ? `Copa · ${cup.name}` : `Rodada ${padRound(currentRound)} de ${league.schedule.length}`} · Temporada {padRound(season)}</span></div></div><button className={styles.advanceButton} disabled={!!live || isAdvancing || complete && !dismissed} title={dismissed ? 'Conferir propostas de emprego' : screen === 'lineup' ? 'Iniciar partida com a escalação atual' : 'Preparar a próxima partida'} onClick={advance}><Icon name="match" size={21} /><span>Avançar</span></button></div>
      </header>
      <main id="main-content" className={`${styles.content} ${screen === 'dashboard' ? styles.dashboardContent : ''}`} key={screen}>{error && <p role="alert" className={styles.error}>{error}</p>}{message && <p className={styles.notice}>{message}</p>}{dismissed && screen !== 'board' && <p role="alert" className={styles.error}>Seu vínculo com o clube foi encerrado. <button className={styles.textButton} onClick={() => navigate('board')}>Ver propostas de emprego</button></p>}{children}</main>
      <details className={styles.savePanel}><summary><Icon name="save" size={16} />Salvar e carregar<span>{saveStatus || 'Gerenciar arquivos'}</span></summary><SaveControls compact /></details>
      <footer className={styles.workspaceFooter}><span>FOOTBR · MANAGER DE FUTEBOL</span><span>Temporada {padRound(season)} · {saveStatus}</span></footer>
    </div>
  </div>;
}
