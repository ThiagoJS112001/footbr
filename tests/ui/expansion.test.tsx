// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../src/ui/App';
import { careerOf, initialGameData, useGameStore } from '../../src/ui/store/gameStore';
import { useUiStore } from '../../src/ui/store/uiStore';
import { ownTeam } from '../../src/engine/career/world';
import { autoPickLineup, LineupUnavailableError } from '../../src/engine/league';
import { startRound, stepRound } from '../../src/engine/league/season';
import { changeMatchStyle } from '../../src/engine/simulation/simulateMatch';
import { seasonSeed } from '../../src/engine/career/career';
import type { Career } from '../../src/engine/career/career';
import type { Lineup } from '../../src/engine/models';
import { saveKey } from '../../src/ui/store/gameStore';

beforeEach(() => { localStorage.clear(); useGameStore.setState({ ...initialGameData }); });
afterEach(cleanup);
function start(cupParticipant = false) {
  useGameStore.getState().startNewGame(42);
  const state = useGameStore.getState();
  state.selectTeam(cupParticipant ? state.systems.cup.rounds[0].matches[0].homeTeamId : state.league!.teams[19].id);
}

describe('decisões rápidas de carreira na interface', () => {
  it('carrega um slot v1 em andamento sem sortear novamente o passado da partida', async () => {
    start();
    for (let i = 0; i < 2; i++) await useGameStore.getState().advanceRound();
    const legacy = JSON.parse(useGameStore.getState().exportGame()!);
    legacy.version = 1;
    delete legacy.data.career.systems;
    delete legacy.data.lastCompetition;
    delete legacy.data.lastCupRound;
    for (const team of [...legacy.data.career.league.teams, ...legacy.data.career.otherLeague.teams]) for (const player of team.squad) delete player.potential;
    legacy.data.progress = { minute: 12, commands: [{ minute: 6, type: 'style', style: 'attacking' }] };
    const c = legacy.data.career as Career;
    const lineups: Record<string, Lineup> = {};
    for (const team of c.league.teams) {
      try { lineups[team.id] = team.id === c.selectedTeamId && c.lineup ? c.lineup : autoPickLineup(team); }
      catch (error) { if (!(error instanceof LineupUnavailableError)) throw error; }
    }
    let expected = startRound(c.league, seasonSeed(c), lineups);
    for (let i = 1; i <= 12; i++) {
      if (i === 7) expected = { ...expected, games: expected.games.map((g) => g.home.team.id === c.selectedTeamId || g.away.team.id === c.selectedTeamId ? changeMatchStyle(g, c.selectedTeamId!, 'attacking') : g) };
      expected = stepRound(expected);
    }
    localStorage.setItem(saveKey(1), JSON.stringify(legacy));
    useGameStore.setState({ ...initialGameData });
    useGameStore.getState().loadGame(1);
    expect(useGameStore.getState().error).toBeNull();
    expect(useGameStore.getState().live).toEqual(expected);
    expect(useGameStore.getState().systems.cup.status).toBe('deferred');
    expect(useGameStore.getState().paused).toBe(true);
  });
  it('permite aceitar uma proposta da IA e consultar a movimentação registrada', async () => {
    start();
    const offer = useGameStore.getState().systems.offers[0];
    expect(offer).toBeDefined();
    useGameStore.getState().navigate('market');
    render(<App />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: `Aceitar proposta por ${offer.playerName}` }));
    expect(useGameStore.getState().error).toBeNull();
    expect(ownTeam(careerOf(useGameStore.getState())).squad.some((p) => p.id === offer.playerId)).toBe(false);
    await user.click(screen.getByRole('button', { name: 'História' }));
    expect(screen.getByRole('table', { name: 'Histórico de transferências' })).toHaveTextContent(offer.playerName);
  });

  it('avalia um jovem, revela potencial e o promove ao elenco profissional', async () => {
    start();
    const prospect = useGameStore.getState().systems.academy.prospects[0];
    render(<App />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Categorias de Base' }));
    await user.click(screen.getByRole('button', { name: `Avaliar ${prospect.player.name}` }));
    expect(screen.getByText(`${prospect.player.potential} · teto estimado`)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: `Promover ${prospect.player.name}` }));
    expect(useGameStore.getState().error).toBeNull();
    expect(useGameStore.getState().systems.academy.promoted).toBe(1);
    expect(screen.getByRole('button', { name: `Promover ${prospect.player.name}` })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Elenco' }));
    expect(screen.getByRole('table', { name: 'Elenco do clube' })).toHaveTextContent(prospect.player.name);
  });

  it('permite escolher outro emprego sem reiniciar o mundo após uma demissão', async () => {
    start();
    const previous = useGameStore.getState().selectedTeamId;
    const state = useGameStore.getState();
    useGameStore.setState({ systems: { ...state.systems, board: { ...state.systems.board, status: 'dismissed', confidence: 10 } } });
    render(<App />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Ver propostas de emprego' }));
    const jobs = screen.getAllByRole('button', { name: /^Assumir / });
    expect(jobs).toHaveLength(3);
    await user.click(jobs[0]);
    expect(useGameStore.getState().selectedTeamId).not.toBe(previous);
    expect(useGameStore.getState().season).toBe(1);
    expect(useGameStore.getState().currentRound).toBe(1);
    expect(useGameStore.getState().systems.board.status).toBe('active');
    expect(screen.getByRole('heading', { name: 'Central do Clube' })).toBeInTheDocument();
  });

  it('compara um candidato do mercado com o elenco e preserva filtros ao navegar', async () => {
    start();
    useGameStore.getState().navigate('market');
    render(<App />);
    const user = userEvent.setup();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Posição' }), 'GK');
    const table = screen.getByRole('table', { name: 'Jogadores no mercado' });
    await user.click(within(within(table).getAllByRole('row')[1]).getByRole('button'));
    await user.click(screen.getByRole('button', { name: 'Comparar com meu elenco' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Comparar jogadores' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Jogador B' })).toHaveValue(useUiStore.getState().compareRight);
    expect(screen.getByText('Finalização')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mercado' }));
    expect(screen.getByRole('combobox', { name: 'Posição' })).toHaveValue('GK');
    expect(screen.getByRole('region', { name: 'Negociação' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Elenco' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filtrar por posição' }), 'CB');
    await user.click(screen.getByRole('button', { name: 'Finanças' }));
    expect(screen.getByText('Planejamento rápido')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Elenco' }));
    expect(screen.getByRole('combobox', { name: 'Filtrar por posição' })).toHaveValue('CB');
  });

  it('prepara a copa pelo mesmo botão e exibe resumo sem avançar outra rodada da liga', async () => {
    start(true);
    for (let i = 0; i < 4; i++) await useGameStore.getState().advanceRound();
    expect(useGameStore.getState().currentRound).toBe(5);
    render(<App />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Preparar partida' }));
    expect(screen.getByText(/Próximo compromisso: Copa dos Horizontes/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Jogar partida' }));
    expect(useGameStore.getState().liveCompetition).toBe('cup');
    await user.click(screen.getByRole('button', { name: 'Simular até o fim' }));
    expect(useGameStore.getState().error).toBeNull();
    expect(useGameStore.getState().currentRound).toBe(5);
    expect(screen.getByText('Entender a partida e os desfalques')).toBeInTheDocument();
    expect(useGameStore.getState().systems.lastSummary?.competition).toBe('cup');
  });

  it('salva e retoma uma partida de copa com as mesmas escalações, minuto e decisões', async () => {
    start(true);
    for (let i = 0; i < 4; i++) await useGameStore.getState().advanceRound();
    useGameStore.getState().kickOff();
    for (let i = 0; i < 15; i++) useGameStore.getState().tickMatch();
    useGameStore.getState().changeStyle('defensive');
    useGameStore.getState().saveGame(3);
    const live = structuredClone(useGameStore.getState().live);
    useGameStore.setState({ ...initialGameData });
    useGameStore.getState().loadGame(3);
    expect(useGameStore.getState().error).toBeNull();
    expect(useGameStore.getState().liveCompetition).toBe('cup');
    expect(useGameStore.getState().live).toEqual(live);
    expect(useGameStore.getState().paused).toBe(true);
    useGameStore.getState().finishMatchNow();
    expect(useGameStore.getState().currentRound).toBe(5);
  });
});
