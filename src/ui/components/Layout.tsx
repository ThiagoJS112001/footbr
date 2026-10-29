import type { ReactNode } from 'react';
import type { League, Team } from '../../engine/models';
import { useGameStore } from '../store/gameStore';
import type { GameScreen } from '../store/gameStore';
import { ClubBadge } from './ClubBadge';
import { Icon } from './Icon';
import { padRound } from '../utils';
import styles from '../App.module.css';

const navigation: { screen: GameScreen; label: string }[] = [
  { screen: 'dashboard', label: 'Painel' }, { screen: 'squad', label: 'Elenco' },
  { screen: 'standings', label: 'Classificação' }, { screen: 'calendar', label: 'Calendário' },
];

export function Layout({ league, team, children }: { league: League; team: Team; children: ReactNode }) {
  const { screen, navigate, currentRound } = useGameStore();
  return <div className={styles.appShell}>
    <a className={styles.skipLink} href="#main-content">Pular para o conteúdo</a>
    <aside className={styles.sidebar}>
      <span className={styles.brand}><span className={styles.brandIcon}><Icon name="shield" /></span>foot<span className={styles.brandAccent}>br.</span></span>
      <div className={styles.sidebarClub}><ClubBadge name={team.name} /><div><strong>{team.name}</strong><small>SEU CLUBE</small></div></div>
      <p className={styles.navCaption}>CENTRAL DE COMANDO</p>
      <nav aria-label="Navegação principal">{navigation.map((item) => <button key={item.screen} onClick={() => navigate(item.screen)} className={screen === item.screen ? styles.activeNav : ''} aria-current={screen === item.screen ? 'page' : undefined}><Icon name={item.screen} />{item.label}{screen === item.screen && <span className={styles.navIndicator} />}</button>)}</nav>
      <div className={styles.sidebarBottom}><div className={styles.seasonMarker}><span className={styles.liveDot} /><span>TEMPORADA 01</span></div><p>Uma camisa. Uma história.<br />Um clube nas suas mãos.</p><button onClick={() => navigate('menu')} className={styles.textButton}><Icon name="exit" />Menu inicial</button></div>
    </aside>
    <div className={styles.workspace}><header className={styles.topbar}><span>{league.name}</span><div><span className={styles.liveDot} /><span>Rodada {padRound(currentRound)} <span className={styles.muted}>/ {league.schedule.length}</span></span><span className={styles.managerAvatar}>DT</span></div></header><main id="main-content" className={styles.content} key={screen}>{children}</main><footer className={styles.workspaceFooter}><span>FOOTBR · O FUTEBOL NAS SUAS MÃOS</span><span>Temporada 01</span></footer></div>
  </div>;
}
