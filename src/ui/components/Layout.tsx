import type { ReactNode } from 'react';
import type { League, Team } from '../../engine/models';
import { careerOf, useGameStore } from '../store/gameStore';
import { nextCupEvent } from '../../engine/career/progression';
import { seasonComplete } from '../../engine/career/progression';
import type { GameScreen, Screen } from '../store/gameStore';
import { ClubBadge } from './ClubBadge';
import { Icon } from './Icon';
import { padRound, seasonDate } from '../utils';
import { SaveControls } from './SaveControls';
import { Brand } from './Brand';
import styles from '../App.module.css';

const navigation: { screen: GameScreen; label: string }[] = [
  { screen: 'dashboard', label: 'Central do Clube' }, { screen: 'squad', label: 'Elenco' },
  { screen: 'lineup', label: 'Escalação' },
  { screen: 'standings', label: 'Classificação' }, { screen: 'calendar', label: 'Calendário' },
  { screen: 'match', label: 'Partida' },
  { screen: 'academy', label: 'Categorias de Base' },
  { screen: 'market', label: 'Mercado' }, { screen: 'finances', label: 'Finanças' },
  { screen: 'board', label: 'Diretoria' },
];

const stadiumScreens = new Set<Screen>(['dashboard', 'squad', 'lineup', 'standings', 'academy', 'calendar', 'cup', 'market', 'finances', 'board']);

export function Layout({ league, team, children }: { league: League; team: Team; children: ReactNode }) {
  const state = useGameStore();
  const { screen, navigate, currentRound, season, live, isAdvancing, error, message, saveStatus } = state;
  const career = careerOf(state);
  const complete = seasonComplete(career);
  const cupEvent = nextCupEvent(career);
  const cup = cupEvent?.round;
  const dismissed = career.systems.board.status === 'dismissed';
  const advance = () => {
    if (dismissed) { navigate('board'); return; }
    navigate('lineup');
  };
  return <div className={styles.appShell}>
    <a className={styles.skipLink} href="#main-content">Pular para o conteúdo</a>
    <aside className={styles.sidebar}>
      <Brand />
      <p className={styles.navCaption}>SEU CLUBE. SUA HISTÓRIA.</p>
      <nav aria-label="Navegação principal">{navigation.filter((item) => item.screen !== 'match' || screen === 'match').map((item) => <button key={item.screen} title={item.label} disabled={!!live} onClick={() => navigate(item.screen)} className={screen === item.screen ? styles.activeNav : ''} aria-current={screen === item.screen ? 'page' : undefined}><Icon name={item.screen} />{item.label}{screen === item.screen && <span className={styles.navIndicator} />}</button>)}</nav>
      <div className={styles.sidebarBottom}><div className={styles.seasonMarker}><span className={styles.liveDot} /><span>TEMPORADA {padRound(season)}</span></div><button onClick={() => navigate('menu')} className={styles.textButton}><Icon name="exit" />Menu e saves</button></div>
    </aside>
    <div className={styles.workspace}>
      {screen === 'dashboard' && <header className={styles.topbar}>
        <div className={styles.topbarClub}><ClubBadge name={team.name} image={team.identity?.facts.image} size="large" /><div><strong>{team.name}</strong><span><Icon name="user" size={14} />Você · Treinador</span></div></div>
        <div className={styles.topbarActions}><div className={styles.dateBlock}><Icon name="calendar" size={25} /><div><strong>{seasonDate(season, cup?.afterRound ?? currentRound, cup ? 5 : !!live || complete, state.source?.seasons[0]?.year)}</strong><span>{complete ? 'Temporada encerrada' : cup ? `${cupEvent?.cup.name} · ${cup.name}` : `Rodada ${padRound(currentRound)} de ${league.schedule.length}`} · Temporada {padRound(season)}</span></div></div><button className={styles.advanceButton} disabled={!!live || isAdvancing || complete && !dismissed} title={dismissed ? 'Conferir propostas de emprego' : 'Preparar a próxima partida'} onClick={advance}><Icon name="match" size={21} /><span>Avançar</span></button></div>
      </header>}
      <main id="main-content" className={`${styles.content} ${stadiumScreens.has(screen) ? styles.dashboardContent : ''}`} key={screen}>{error && <p role="alert" className={styles.error}>{error}</p>}{message && <p className={styles.notice}>{message}</p>}{dismissed && screen !== 'board' && <p role="alert" className={styles.error}>Seu vínculo com o clube foi encerrado. <button className={styles.textButton} onClick={() => navigate('board')}>Ver propostas de emprego</button></p>}{children}</main>
      <details className={styles.savePanel}><summary><Icon name="save" size={16} />Salvar e carregar<span>{saveStatus || 'Gerenciar arquivos'}</span></summary><SaveControls compact /></details>
      <footer className={styles.workspaceFooter}><span>FOOTBR · MANAGER DE FUTEBOL{state.source ? ` · Base ${state.source.providers.includes('demo') ? 'de demonstração fictícia' : 'importada'} · Atributos e finanças simulados` : ''}</span><span>Temporada {padRound(season)} · {saveStatus}</span></footer>
    </div>
  </div>;
}
