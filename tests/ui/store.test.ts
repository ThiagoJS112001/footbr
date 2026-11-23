import { beforeEach, describe, expect, it } from 'vitest';
import { initialGameData, useGameStore } from '../../src/ui/store/gameStore';
import { availableJobs, createBoard } from '../../src/engine/career/board';
import { createAcademy } from '../../src/engine/career/academy';
import { careerOf } from '../../src/ui/store/gameStore';
import { nextCompetition, seasonComplete } from '../../src/engine/career/progression';
import { arrangeDivisions, worldLeagues } from '../../src/engine/career/world';
import { decodeSave } from '../../src/engine/save/save';

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
    expect(useGameStore.getState().currentRound).toBe(1);
    expect(useGameStore.getState().systems.lastSummary).toMatchObject({ competition: 'state', round: 1 });
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
    const table = worldLeagues(careerOf(useGameStore.getState())).sort((a, b) => a.teams[0].division - b.teams[0].division);
    const promoted = table[2].standings[0].teamId;
    const relegated = table[1].standings[19].teamId;
    const nationalChampion = useGameStore.getState().systems.cup.championId;
    if (useGameStore.getState().systems.board.status === 'dismissed') useGameStore.getState().acceptJob(availableJobs(careerOf(useGameStore.getState()))[0].id);
    useGameStore.getState().beginNextSeason();
    expect(useGameStore.getState().error).toBeNull();
    const next = decodeSave(useGameStore.getState().exportGame()!).career;
    const nextTable = worldLeagues(next).sort((a, b) => a.teams[0].division - b.teams[0].division);
    expect(nextTable.map((league) => league.teams.length)).toEqual([20, 20, 20]);
    expect(nextTable[1].teams.some((team) => team.id === promoted)).toBe(true);
    expect(nextTable[2].teams.some((team) => team.id === relegated)).toBe(true);
    expect(next.systems.stateCups).toHaveLength(15);
    expect(next.systems.continentalCups).toHaveLength(2);
    expect(next.systems.continentalCups![0].rounds[0].matches[0].homeTeamId).toBe(nationalChampion);
    const qualifiedLeague = nextTable.find((league) => league.teams.some((team) => team.id === nationalChampion))!;
    const qualified = qualifiedLeague.teams.find((team) => team.id === nationalChampion)!;
    useGameStore.setState({ ...arrangeDivisions(nextTable, qualifiedLeague), selectedTeamId: qualified.id, lineup: null,
      systems: { ...next.systems, board: createBoard(qualified, qualifiedLeague), academy: createAcademy(qualified, next.seed, next.season),
        offers: next.systems.offers.filter((offer) => offer.status !== 'pending') } });
    for (let i = 0; i < 16 && nextCompetition(careerOf(useGameStore.getState())) !== 'continental'; i++) {
      await useGameStore.getState().advanceRound();
      expect(useGameStore.getState().error).toBeNull();
    }
    useGameStore.getState().kickOff();
    useGameStore.getState().tickMatch();
    const live = useGameStore.getState().live;
    expect(useGameStore.getState().liveCompetition).toBe('continental');
    expect(live?.games[0].minute).toBe(1);
    const raw = useGameStore.getState().exportGame()!;
    useGameStore.setState({ ...initialGameData });
    useGameStore.getState().importGame(raw);
    expect(useGameStore.getState().error).toBeNull();
    expect(useGameStore.getState().live).toEqual(live);
    useGameStore.getState().finishMatchNow();
    expect(useGameStore.getState().systems.lastSummary?.competition).toBe('continental');
  }, 30000);

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
