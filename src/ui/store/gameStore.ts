import { create } from 'zustand';
import { generateLeague } from '../../engine/generators/league';
import { calculateStandings, generateSchedule, playRound } from '../../engine/league';
import type { League } from '../../engine/models';

export type GameScreen = 'dashboard' | 'squad' | 'standings' | 'calendar';
export type Screen = 'menu' | 'club-selection' | GameScreen;

interface GameData {
  league: League | null;
  selectedTeamId: string | null;
  currentRound: number;
  seed: number | null;
  screen: Screen;
  isAdvancing: boolean;
  error: string | null;
}

interface GameActions {
  startNewGame: (seed?: number) => void;
  selectTeam: (teamId: string) => void;
  navigate: (screen: GameScreen | 'menu') => void;
  advanceRound: () => Promise<void>;
}

export const initialGameData: GameData = {
  league: null, selectedTeamId: null, currentRound: 1, seed: null,
  screen: 'menu', isAdvancing: false, error: null,
};

export const useGameStore = create<GameData & GameActions>((set, get) => ({
  ...initialGameData,
  startNewGame: (providedSeed) => {
    try {
      const seed = providedSeed ?? crypto.getRandomValues(new Uint32Array(1))[0];
      const league = generateLeague(seed, 20);
      league.schedule = generateSchedule(league.teams.map((team) => team.id));
      league.standings = calculateStandings(league, seed);
      set({ ...initialGameData, league, seed, screen: 'club-selection' });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Não foi possível iniciar o jogo.' });
    }
  },
  selectTeam: (teamId) => {
    if (!get().league?.teams.some((team) => team.id === teamId)) return;
    set({ selectedTeamId: teamId, screen: 'dashboard', error: null });
  },
  navigate: (screen) => {
    if (screen !== 'menu' && (!get().league || !get().selectedTeamId)) return;
    set({ screen, error: null });
  },
  advanceRound: async () => {
    const { league, seed, selectedTeamId, isAdvancing } = get();
    if (!league || seed === null || !selectedTeamId || isAdvancing
      || league.schedule.every((round) => round.matches.every((match) => match.status === 'finished'))) return;
    set({ isAdvancing: true, error: null });
    // Permite pintar o estado de carregamento antes da simulação síncrona.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    if (get().league !== league) return;
    try {
      const next = playRound(league, seed);
      const pending = next.schedule.find((round) => round.matches.some((match) => match.status !== 'finished'));
      set({ league: next, currentRound: pending?.round ?? next.schedule.length, isAdvancing: false });
    } catch (error) {
      set({ isAdvancing: false, error: error instanceof Error ? error.message : 'Não foi possível avançar a rodada. Tente novamente.' });
    }
  },
}));
