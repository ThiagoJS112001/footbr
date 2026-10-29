import { useGameStore } from './store/gameStore';
import { Layout } from './components/Layout';
import { Menu } from './screens/Menu';
import { ClubSelection } from './screens/ClubSelection';
import { Dashboard } from './screens/Dashboard';
import { Squad } from './screens/Squad';
import { Standings } from './screens/Standings';
import { Calendar } from './screens/Calendar';

export function App() {
  const { screen, league, selectedTeamId, currentRound } = useGameStore();
  if (screen === 'menu' || !league) return <Menu />;
  const team = league.teams.find((candidate) => candidate.id === selectedTeamId);
  if (screen === 'club-selection' || !team) return <ClubSelection league={league} />;
  return <Layout league={league} team={team}>
    {screen === 'dashboard' && <Dashboard league={league} team={team} />}
    {screen === 'squad' && <Squad team={team} />}
    {screen === 'standings' && <Standings league={league} selectedTeamId={team.id} />}
    {screen === 'calendar' && <Calendar league={league} selectedTeamId={team.id} currentRound={currentRound} />}
  </Layout>;
}
