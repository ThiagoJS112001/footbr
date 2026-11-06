// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initialGameData, saveKey, useGameStore } from '../../src/ui/store/gameStore';
import { App } from '../../src/ui/App';
import { decodeStoredSave } from '../../src/ui/store/saveStorage';

beforeEach(() => { localStorage.clear(); useGameStore.setState({ ...initialGameData }); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function start() {
  useGameStore.getState().startNewGame(42);
  useGameStore.getState().selectTeam(useGameStore.getState().league!.teams[19].id);
}

describe('carreira integrada', () => {
  it('Avançar prepara a escalação, inicia a partida e retorna ao painel após o resultado', async () => {
    start();
    render(<App />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Avançar' }));
    expect(screen.getByRole('heading', { name: 'Escalação e tática' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Avançar' }));
    expect(screen.getByRole('heading', { name: 'Bola rolando' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Avançar' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Simular até o fim' }));
    await user.click(screen.getByRole('button', { name: 'Avançar' }));
    expect(screen.getByRole('heading', { name: 'Central do Clube' })).toBeInTheDocument();
    expect(useGameStore.getState().currentRound).toBe(2);
  });
  it('preserva titulares e reservas escolhidos e fecha a mesma rodada somente uma vez', () => {
    start();
    useGameStore.getState().autoLineup();
    const chosen = useGameStore.getState().lineup!;
    const omitted = chosen.substituteIds[0];
    useGameStore.getState().toggleReserve(omitted);
    useGameStore.getState().kickOff();
    const state = useGameStore.getState();
    const game = state.live!.games.find((g) => g.home.team.id === state.selectedTeamId || g.away.team.id === state.selectedTeamId)!;
    const side = game.home.team.id === state.selectedTeamId ? game.home : game.away;
    expect(side.bench.some((p) => p.id === omitted)).toBe(false);
    useGameStore.getState().finishMatchNow();
    expect(useGameStore.getState().lineup?.substituteIds).not.toContain(omitted);
    const league = useGameStore.getState().league;
    const finances = useGameStore.getState().finances;
    useGameStore.getState().finishMatchNow();
    expect(useGameStore.getState().league).toBe(league);
    expect(useGameStore.getState().finances).toBe(finances);
  });

  it('permite continuar e salvar uma rodada com W.O. por falta de jogadores elegíveis', () => {
    start();
    const state = useGameStore.getState();
    useGameStore.setState({ league: { ...state.league!, teams: state.league!.teams.map((team) => team.id === state.selectedTeamId ? { ...team, squad: team.squad.map((p) => ({ ...p, injury: { description: 'Lesão', remainingDays: 7 } })) } : team) } });
    useGameStore.getState().kickOff();
    expect(useGameStore.getState().error).toBeNull();
    expect(useGameStore.getState().live!.forfeits.some((m) => m.forfeitTeamIds?.includes(state.selectedTeamId!))).toBe(true);
    const raw = useGameStore.getState().exportGame()!;
    useGameStore.setState({ ...initialGameData });
    useGameStore.getState().importGame(raw);
    expect(useGameStore.getState().error).toBeNull();
    useGameStore.getState().finishMatchNow();
    expect(useGameStore.getState().currentRound).toBe(2);
  });

  it('retoma o mesmo minuto, placar, postura e substituição após carregar o save', () => {
    start();
    useGameStore.getState().kickOff();
    for (let i = 0; i < 12; i++) useGameStore.getState().tickMatch();
    const s = useGameStore.getState();
    const game = s.live!.games.find((g) => g.home.team.id === s.selectedTeamId || g.away.team.id === s.selectedTeamId)!;
    const side = game.home.team.id === s.selectedTeamId ? game.home : game.away;
    const pair = side.active.flatMap((p) => side.bench.filter((q) => q.primaryPosition === p.primaryPosition).map((q) => [p.id, q.id]));
    s.substitute(pair[0][0], pair[0][1]);
    useGameStore.getState().changeStyle('attacking');
    useGameStore.getState().saveGame(2);
    const before = structuredClone(useGameStore.getState().live);
    const commands = useGameStore.getState().commands;
    useGameStore.setState({ ...initialGameData });
    useGameStore.getState().loadGame(2);
    expect(useGameStore.getState().error).toBeNull();
    expect(useGameStore.getState().live).toEqual(before);
    expect(useGameStore.getState().commands).toEqual(commands);
    expect(useGameStore.getState().paused).toBe(true);
    expect(useGameStore.getState().screen).toBe('match');
    useGameStore.getState().finishMatchNow();
    const completed = useGameStore.getState().league;
    useGameStore.getState().loadGame(2);
    useGameStore.getState().finishMatchNow();
    expect(useGameStore.getState().league).toEqual(completed);
    expect(useGameStore.getState().currentRound).toBe(2);
  });

  it('rejeita importação inválida e informa falha de armazenamento sem perder a carreira', () => {
    start();
    const previous = useGameStore.getState().league;
    useGameStore.getState().importGame('{"version":99}');
    expect(useGameStore.getState().league).toBe(previous);
    expect(useGameStore.getState().error).toMatch(/inválido|incompatível/);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota'); });
    useGameStore.getState().saveGame(1);
    expect(useGameStore.getState().saveStatus).toBe('Falha ao salvar');
    expect(JSON.parse(useGameStore.getState().exportGame()!).version).toBe(2);
    expect(useGameStore.getState().league).toBe(previous);
  });

  it('permite pausar, substituir e mudar postura na tela da partida', async () => {
    start();
    useGameStore.getState().kickOff();
    useGameStore.getState().togglePause();
    render(<App />);
    const user = userEvent.setup();
    const outgoing = screen.getByRole('combobox', { name: 'Sai' });
    await user.selectOptions(outgoing, within(outgoing).getAllByRole('option')[1].getAttribute('value')!);
    const incoming = screen.getByRole('combobox', { name: 'Entra' });
    await user.selectOptions(incoming, within(incoming).getAllByRole('option')[1].getAttribute('value')!);
    await user.click(screen.getByRole('button', { name: 'Substituir' }));
    expect(useGameStore.getState().commands).toHaveLength(1);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Postura em campo' }), 'defensive');
    expect(useGameStore.getState().commands.at(-1)).toMatchObject({ type: 'style', style: 'defensive', minute: 0 });
    expect(screen.getByRole('button', { name: 'Retomar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mercado' })).toBeDisabled();
    expect(decodeStoredSave(localStorage.getItem(saveKey())!)).toContain('substitution');
  });

  it('permite assumir um clube da segunda divisão e comprar com proposta pela interface', async () => {
    useGameStore.getState().startNewGame(42);
    render(<App />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Divisão 2' }));
    await user.click(screen.getAllByRole('button', { name: /^Assumir / })[0]);
    expect(useGameStore.getState().league!.teams[0].division).toBe(2);
    await user.click(screen.getByRole('button', { name: 'Mercado' }));
    const table = screen.getByRole('table', { name: 'Jogadores no mercado' });
    await user.click(within(table).getAllByRole('button').find((button) => !['Jogador', 'Idade', 'Força', 'Preço pedido'].some((label) => button.textContent?.startsWith(label)))!);
    expect(screen.getByRole('region', { name: 'Negociação' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Enviar proposta' }));
    expect(useGameStore.getState().error).toBeNull();
    const team = useGameStore.getState().league!.teams.find((t) => t.id === useGameStore.getState().selectedTeamId)!;
    expect(team.squad).toHaveLength(26);
    await user.click(screen.getByRole('button', { name: 'Finanças' }));
    expect(screen.getByRole('table', { name: 'Extrato financeiro' })).toHaveTextContent('Compra');
  });
});
