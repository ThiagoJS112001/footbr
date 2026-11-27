import { lazy, Suspense, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { careerOf, useGameStore } from './store/gameStore';
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
import { AcademyScreen } from './screens/Academy';
import { BoardScreen } from './screens/Board';
import { CompareScreen } from './screens/Compare';
import { CoachScreen } from './screens/Coach';
import { SeasonAwardsScreen } from './screens/Awards';
import { seasonComplete } from '../engine/career/progression';

const BaseEditor = lazy(() => import('./screens/BaseEditor').then(({ BaseEditor }) => ({ default: BaseEditor })));
const DataImport = lazy(() => import('./screens/DataImport').then(({ DataImport }) => ({ default: DataImport })));
const History = lazy(() => import('./screens/History').then(({ History }) => ({ default: History })));
const loadingScreen = <p role="status">Carregando…</p>;

export function App() {
  const { screen, league, selectedTeamId, currentRound } = useGameStore(useShallow(({ screen, league, selectedTeamId, currentRound }) => ({
    screen, league, selectedTeamId, currentRound,
  })));
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
        if (seasonComplete(careerOf(state))) state.navigate('awards');
        else void state.advanceRound();
      } else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  if (screen === 'base-editor' || screen === 'data-import') {
    return <Suspense fallback={loadingScreen}>
      {screen === 'base-editor' ? <BaseEditor /> : <DataImport />}
    </Suspense>;
  }
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
    {screen === 'history' && <Suspense fallback={loadingScreen}><History /></Suspense>}
    {screen === 'academy' && <AcademyScreen />}
    {screen === 'board' && <BoardScreen />}
    {screen === 'coach' && <CoachScreen />}
    {screen === 'awards' && <SeasonAwardsScreen />}
    {screen === 'compare' && <CompareScreen />}
    {screen === 'standings' && <Standings league={league} selectedTeamId={team.id} />}
    {(screen === 'calendar' || screen === 'cup') && <Calendar league={league} selectedTeamId={team.id} currentRound={currentRound} />}
  </Layout>;
}
