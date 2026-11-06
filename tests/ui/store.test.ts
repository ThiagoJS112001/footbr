import { beforeEach, describe, expect, it } from 'vitest';
import { initialGameData, useGameStore } from '../../src/ui/store/gameStore';
import { availableJobs } from '../../src/engine/career/board';
import { careerOf } from '../../src/ui/store/gameStore';
import { seasonComplete } from '../../src/engine/career/progression';

beforeEach(() => useGameStore.setState({ ...initialGameData }));

describe('store do jogo', () => {
  it('prepara calendário e tabela e ignora escolhas inválidas', () => {
    useGameStore.getState().startNewGame(42);
    const state = useGameStore.getState();
    expect(state.seed).toBe(42);
    expect(state.currentRound).toBe(1);
    expect(state.league!.schedule).toHaveLength(38);
    expect(state.league!.standings).toHaveLength(20);
    state.selectTeam('inexistente');
    expect(useGameStore.getState().selectedTeamId).toBeNull();
  });

  it('bloqueia cliques concorrentes e conclui exatamente 38 rodadas', async () => {
    useGameStore.getState().startNewGame(2026);
    useGameStore.getState().selectTeam(useGameStore.getState().league!.teams[0].id);
    await Promise.all([useGameStore.getState().advanceRound(), useGameStore.getState().advanceRound()]);
    expect(useGameStore.getState().currentRound).toBe(2);
    for (let index = 0; !seasonComplete(careerOf(useGameStore.getState())) && index < 60; index++) {
      if (useGameStore.getState().systems.board.status === 'dismissed') useGameStore.getState().acceptJob(availableJobs(careerOf(useGameStore.getState()))[0].id);
      await useGameStore.getState().advanceRound();
      expect(useGameStore.getState().error).toBeNull();
    }
    const completed = useGameStore.getState().league!;
    expect(completed.schedule.flatMap((round) => round.matches).filter((match) => match.status === 'finished')).toHaveLength(380);
    expect(completed.standings.every((row) => row.played === 38)).toBe(true);
    expect(useGameStore.getState().currentRound).toBe(38);
    await useGameStore.getState().advanceRound();
    expect(useGameStore.getState().league).toBe(completed);
  });

  it('um novo jogo não recebe o resultado pendente da partida anterior', async () => {
    useGameStore.getState().startNewGame(1);
    useGameStore.getState().selectTeam(useGameStore.getState().league!.teams[0].id);
    const pending = useGameStore.getState().advanceRound();
    useGameStore.getState().startNewGame(2);
    await pending;
    expect(useGameStore.getState().seed).toBe(2);
    expect(useGameStore.getState().currentRound).toBe(1);
    expect(useGameStore.getState().isAdvancing).toBe(false);
    expect(useGameStore.getState().league!.schedule[0].matches.every((match) => match.status === 'scheduled')).toBe(true);
  });
});
