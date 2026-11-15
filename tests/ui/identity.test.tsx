// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/ui/App';
import { careerOf, initialGameData, useGameStore } from '../../src/ui/store/gameStore';
import { ownTeam } from '../../src/engine/career/world';
import { autoPickLineup } from '../../src/engine/league';
import { startRound, stepRound } from '../../src/engine/league/season';
import { simulationConfig } from '../../src/engine/simulation/config';

beforeEach(() => { localStorage.clear(); useGameStore.setState({ ...initialGameData }); useGameStore.getState().startNewGame(42); useGameStore.getState().selectTeam(useGameStore.getState().league!.teams[19].id); });
afterEach(cleanup);

describe('ritmo e identidade na interface', () => {
  it('preserva partidas antigas em andamento e só usa o novo motor na partida seguinte', () => {
    const c = careerOf(useGameStore.getState());
    for (const team of [...c.league.teams, ...c.otherLeague.teams]) for (const player of team.squad) delete player.trait;
    const lineups = Object.fromEntries(c.league.teams.map((team) => [team.id, autoPickLineup(team, undefined, true, false)]));
    c.lineup = lineups[c.selectedTeamId!];
    let expected = startRound(c.league, c.seed, lineups, { ...simulationConfig, personality: false });
    for (let i = 0; i < 12; i++) expected = stepRound(expected);
    const raw = JSON.stringify({ version: 2, data: { career: c, lastRound: null, progress: { minute: 12, commands: [], lineups } } });
    useGameStore.getState().importGame(raw);
    expect(useGameStore.getState().error).toBeNull();
    expect(useGameStore.getState().live).toEqual(expected);
    const upgraded = useGameStore.getState().exportGame()!;
    expect(JSON.parse(upgraded).data.progress.engineVersion).toBe(1);
    useGameStore.setState({ ...initialGameData });
    useGameStore.getState().importGame(upgraded);
    expect(useGameStore.getState().live).toEqual(expected);
    useGameStore.getState().finishMatchNow();
    useGameStore.getState().kickOff();
    expect(useGameStore.getState().live!.games.every((g) => g.config.personality !== false)).toBe(true);
  });
  it('joga direto da central, mostra a projeção e prepara o jogo seguinte pelo resultado', async () => {
    const state = useGameStore.getState();
    const expected = autoPickLineup(ownTeam(careerOf(state)), undefined, true);
    render(<App />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Jogar com a escalação atual' }));
    await user.click(screen.getByRole('button', { name: 'Pausar' }));
    expect(useGameStore.getState().lineup).toEqual(expected);
    expect(screen.getByRole('region', { name: 'Classificação provisória' })).toBeInTheDocument();
    expect(useGameStore.getState().league!.schedule[0].matches.every((m) => m.status === 'scheduled')).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Simular até o fim' }));
    await user.click(screen.getByRole('button', { name: 'Preparar próximo jogo' }));
    expect(screen.getByRole('heading', { name: 'Escalação e tática' })).toBeInTheDocument();
    expect(useGameStore.getState().currentRound).toBe(2);
  });

  it('salva e reaplica um plano tático mantendo-o após exportar e carregar a carreira', async () => {
    useGameStore.getState().navigate('lineup');
    render(<App />);
    const user = userEvent.setup();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Postura' }), 'defensive');
    await user.click(screen.getByRole('button', { name: 'Salvar Copa' }));
    const saved = structuredClone(useGameStore.getState().lineup);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Postura' }), 'attacking');
    await user.click(screen.getByRole('button', { name: 'Usar Copa' }));
    expect(useGameStore.getState().lineup).toEqual(saved);
    const raw = useGameStore.getState().exportGame()!;
    act(() => useGameStore.getState().importGame(raw));
    expect(useGameStore.getState().error).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Escalação' }));
    expect(screen.getByRole('button', { name: 'Usar Copa' })).toBeEnabled();
  });

  it('observa um jogador, mantém a seleção e sinaliza mudança no valor de mercado', async () => {
    useGameStore.getState().navigate('market');
    render(<App />);
    const user = userEvent.setup();
    const table = screen.getByRole('table', { name: 'Jogadores no mercado' });
    await user.click(within(within(table).getAllByRole('row')[1]).getByRole('button'));
    await user.click(screen.getByRole('button', { name: 'Observar jogador' }));
    const watch = useGameStore.getState().systems.watchlist[0];
    await user.click(screen.getByRole('button', { name: 'Finanças' }));
    await user.click(screen.getByRole('button', { name: 'Mercado' }));
    expect(screen.getByRole('button', { name: 'Deixar de observar' })).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Lista' }), 'watch');
    expect(screen.getByRole('table', { name: 'Jogadores no mercado' })).toHaveTextContent(watch.playerName);
    const s = useGameStore.getState();
    const change = (league: NonNullable<typeof s.league>) => ({ ...league, teams: league.teams.map((t) => ({ ...t, squad: t.squad.map((p) => p.id === watch.playerId ? { ...p, marketValue: p.marketValue + 10000 } : p) })) });
    act(() => useGameStore.setState({ league: change(s.league!), otherLeague: change(s.otherLeague!) }));
    expect(screen.getByRole('heading', { name: 'Novidades dos observados' })).toBeInTheDocument();
    expect(useGameStore.getState().systems.watchlist[0].value).toBe(watch.value);
  });

  it('contrata por empréstimo com custos visíveis e preserva o vínculo ao carregar', async () => {
    useGameStore.getState().navigate('market');
    render(<App />);
    const user = userEvent.setup();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Lista' }), 'loans');
    const table = screen.getByRole('table', { name: 'Jogadores no mercado' });
    await user.click(within(within(table).getAllByRole('row')[1]).getByRole('button'));
    expect(screen.getByLabelText('Custo da contratação')).toHaveTextContent('Custo estimado até o retorno');
    await user.click(screen.getByRole('button', { name: 'Confirmar empréstimo' }));
    expect(useGameStore.getState().error).toBeNull();
    expect(screen.getByRole('heading', { name: 'Empréstimos em andamento' })).toBeInTheDocument();
    const raw = useGameStore.getState().exportGame()!;
    act(() => useGameStore.getState().importGame(raw));
    expect(useGameStore.getState().systems.loans[0].status).toBe('active');
    expect(useGameStore.getState().error).toBeNull();
  });

  it('negocia uma proposta recebida sem vender antes do aceite final', async () => {
    useGameStore.getState().navigate('market');
    const offer = useGameStore.getState().systems.offers[0];
    const budget = ownTeam(careerOf(useGameStore.getState())).budget;
    render(<App />);
    const user = userEvent.setup();
    const input = screen.getByRole('spinbutton', { name: `Contraproposta por ${offer.playerName} (R$)` });
    await user.clear(input);
    await user.type(input, String(offer.amount + 1000));
    await user.click(within(input.closest('form')!).getByRole('button', { name: 'Negociar valor' }));
    expect(ownTeam(careerOf(useGameStore.getState())).budget).toBe(budget);
    expect(screen.getByText('Resposta final do comprador')).toBeInTheDocument();
    const revised = useGameStore.getState().systems.offers.find((o) => o.id === offer.id)!;
    await user.click(screen.getByRole('button', { name: `Aceitar proposta por ${offer.playerName}` }));
    expect(ownTeam(careerOf(useGameStore.getState())).budget).toBe(budget + revised.amount);
    expect(useGameStore.getState().error).toBeNull();
  });
});
