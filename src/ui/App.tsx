import { useEffect } from 'react';
import { useGameStore } from './store/gameStore';
import { Layout } from './components/Layout';
import { Menu } from './screens/Menu';
import { ClubSelection } from './screens/ClubSelection';
import { Dashboard } from './screens/Dashboard';
import { Squad } from './screens/Squad';
import { Standings } from './screens/Standings';
import { Calendar } from './screens/Calendar';
import { LineupScreen } from './screens/Lineup';
import { MatchScreen } from './screens/Match';
import { Market } from './screens/Market';
import { Finances } from './screens/Finances';
import { History } from './screens/History';
import { AcademyScreen } from './screens/Academy';
import { BoardScreen } from './screens/Board';
import { CompareScreen } from './screens/Compare';
import { BaseEditor } from './screens/BaseEditor';
import { DataImport } from './screens/DataImport';

export function App() {
  const { screen, league, selectedTeamId, currentRound } = useGameStore();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.target instanceof Element && event.target.closest('input, textarea, select, button, a, summary, [contenteditable="true"], [role="dialog"]')) return;
      const state = useGameStore.getState();
      if (state.screen === 'match' && state.live) {
        if (event.code === 'Space') state.togglePause();
        else if (['1', '2', '4', '8'].includes(event.key)) state.setSpeed(Number(event.key));
        else return;
      } else if (state.screen === 'dashboard' && !state.live && state.systems.board.status === 'active' && event.key.toLowerCase() === 'j') {
        void state.advanceRound();
      } else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  if (screen === 'base-editor') return <BaseEditor />;
  if (screen === 'data-import') return <DataImport />;
  if (screen === 'menu' || !league) return <Menu />;
  const team = league.teams.find((candidate) => candidate.id === selectedTeamId);
  if (screen === 'club-selection' || !team) return <ClubSelection league={league} />;
  return <Layout league={league} team={team}>
    {screen === 'dashboard' && <Dashboard league={league} team={team} />}
    {screen === 'squad' && <Squad team={team} />}
    {screen === 'lineup' && <LineupScreen team={team} />}
    {screen === 'match' && <MatchScreen league={league} team={team} />}
    {screen === 'market' && <Market team={team} />}
    {screen === 'finances' && <Finances team={team} />}
    {screen === 'history' && <History />}
    {screen === 'academy' && <AcademyScreen />}
    {screen === 'board' && <BoardScreen />}
    {screen === 'compare' && <CompareScreen />}
    {screen === 'standings' && <Standings league={league} selectedTeamId={team.id} />}
    {(screen === 'calendar' || screen === 'cup') && <Calendar league={league} selectedTeamId={team.id} currentRound={currentRound} />}
  </Layout>;
}
