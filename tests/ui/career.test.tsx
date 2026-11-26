import { createCareer } from '../../src/engine/career/career';
import { renewalDemand } from '../../src/engine/career/renewals';
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initialGameData, saveKey, useGameStore } from '../../src/ui/store/gameStore';
import { App } from '../../src/ui/App';
import { decodeStoredSave } from '../../src/ui/store/saveStorage';

if (!HTMLDialogElement.prototype.showModal) {
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value(this: HTMLDialogElement) { this.setAttribute('open', ''); } },
    close: { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute('open'); } },
  });
}

beforeEach(() => { localStorage.clear(); useGameStore.setState({ ...initialGameData }); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function start() {
  useGameStore.getState().startCustomGame(createCareer(42));
  useGameStore.getState().selectTeam(useGameStore.getState().league!.teams[19].id);
}

describe('carreira integrada', () => {
  it('negocia na Diretoria e confere o impacto antes de aceitar as condições', async () => {
    start();
    const state = useGameStore.getState();
    const original = state.league!.teams.find((team) => team.id === state.selectedTeamId)!;
    const player = original.squad.find((p) => p.contract?.yearsRemaining === 1)!;
    const demand = renewalDemand(player);
    state.navigate('board');
    render(<App />);
    const user = userEvent.setup();
    expect(screen.getByText(/contratos? a renovar/)).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Contratos com um ano restante' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ver renovações' }));
    await user.click(screen.getByRole('button', { name: `Negociar renovação de ${player.name}` }));
    const dialog = within(screen.getByRole('dialog', { name: `Renovação · ${player.name}` }));
    const salary = dialog.getByRole('spinbutton', { name: 'Salário mensal (R$)' });
    await user.clear(salary);
    await user.type(salary, String(demand.salary));
    const bonus = screen.getByRole('spinbutton', { name: 'Luvas (R$)' });
    await user.clear(bonus);
    await user.type(bonus, '0');
    await user.click(screen.getByRole('button', { name: 'Enviar proposta' }));
    expect(screen.getByText('Contraproposta do jogador')).toBeInTheDocument();
    expect(useGameStore.getState().finances).toEqual(state.finances);
    expect(useGameStore.getState().league!.teams.find((team) => team.id === state.selectedTeamId)!.budget).toBe(original.budget);
    await user.click(screen.getByRole('button', { name: 'Usar condições pedidas' }));
    expect(screen.getByLabelText('Impacto financeiro da renovação')).toHaveTextContent('Nova folha mensal');
    expect(dialog.getByText('Luvas em parcela única')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Aceitar condições' }));
    const updated = useGameStore.getState().league!.teams.find((team) => team.id === state.selectedTeamId)!;
    expect(updated.budget).toBe(original.budget - demand.bonus);
    expect(updated.squad.find((p) => p.id === player.id)?.contract).toEqual({ salary: demand.salary, yearsRemaining: demand.years + 1 });
    expect(useGameStore.getState().finances.slice(state.finances.length)).toEqual([
      expect.objectContaining({ description: `Luvas de renovação · ${player.name}`, amount: -demand.bonus }),
    ]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Recolher renovações' }));
    expect(screen.queryByRole('table', { name: 'Contratos com um ano restante' })).not.toBeInTheDocument();
  });

  it('abre a escalação pela Central do Clube e inicia a partida pela escalação', async () => {
    start();
    render(<App />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Avançar' }));
    expect(screen.getByRole('heading', { name: 'Escalação e tática' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Avançar' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Jogar partida' }));
    expect(screen.getByRole('heading', { name: 'Bola rolando' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Avançar' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Simular até o fim' }));
    await user.click(within(screen.getByRole('navigation', { name: 'Navegação principal' })).getByRole('button', { name: 'Central do Clube' }));
    expect(screen.getByRole('heading', { name: 'Central do Clube' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Avançar' })).toBeEnabled();
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
    render(<App />);
    const user = userEvent.setup();
    expect(screen.getByRole('heading', { name: 'Bola rolando' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Sai' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Pausar partida' }));
    expect(screen.getByRole('heading', { name: 'Partida pausada' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Banco de reservas' })).toBeInTheDocument();
    const outgoing = screen.getByRole('combobox', { name: 'Sai' });
    await user.selectOptions(outgoing, within(outgoing).getAllByRole('option')[1].getAttribute('value')!);
    const incoming = screen.getByRole('combobox', { name: 'Entra' });
    await user.selectOptions(incoming, within(incoming).getAllByRole('option')[1].getAttribute('value')!);
    await user.click(screen.getByRole('button', { name: 'Confirmar substituição' }));
    expect(useGameStore.getState().commands).toHaveLength(1);
    const game = useGameStore.getState();
    const session = game.live!.games.find((item) => item.home.team.id === game.selectedTeamId || item.away.team.id === game.selectedTeamId)!;
    const side = session.home.team.id === game.selectedTeamId ? session.home : session.away;
    const reserve = side.bench.find((p) => side.active.some((q) => p.primaryPosition === q.primaryPosition))!;
    const starter = side.active.find((p) => p.primaryPosition === reserve.primaryPosition)!;
    const bank = within(screen.getByRole('table', { name: 'Banco de reservas' }));
    const source = bank.getByText(reserve.name).closest('tr')!;
    const target = screen.getByTitle(starter.name);
    const dataTransfer = { setData: vi.fn(), getData: () => reserve.id };
    fireEvent.dragStart(source, { dataTransfer });
    fireEvent.dragOver(target, { dataTransfer });
    fireEvent.drop(target, { dataTransfer });
    expect(useGameStore.getState().commands.at(-1)).toMatchObject({ type: 'substitution', outId: starter.id, inId: reserve.id });
    expect(bank.queryByText(reserve.name)).not.toBeInTheDocument();
    expect(screen.getByTitle(reserve.name)).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Postura em campo' }), 'defensive');
    expect(useGameStore.getState().commands.at(-1)).toMatchObject({ type: 'style', style: 'defensive', minute: 0 });
    expect(screen.getByRole('button', { name: 'Retomar partida' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mercado' })).toBeDisabled();
    expect(decodeStoredSave(localStorage.getItem(saveKey())!)).toContain('substitution');
    await user.click(screen.getByRole('button', { name: '4×' }));
    expect(useGameStore.getState().speed).toBe(4);
    await user.click(screen.getByRole('button', { name: 'Retomar partida' }));
    expect(screen.getByRole('heading', { name: 'Bola rolando' })).toBeInTheDocument();
  });

  it('permite assumir um clube da segunda divisão e comprar com proposta pela interface', async () => {
    useGameStore.getState().startCustomGame(createCareer(42));
    render(<App />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Série B' }));
    const secondDivision = useGameStore.getState().otherLeague!;
    expect(screen.getByRole('combobox', { name: 'Liga / Competição' })).toHaveValue(secondDivision.id);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Ordenar por' }), 'reputation');
    const topClub = [...secondDivision.teams].sort((a, b) => b.reputation - a.reputation)[0];
    expect(screen.getAllByRole('button', { name: /^Assumir / })[0]).toHaveAccessibleName(`Assumir ${topClub.name}`);
    await user.type(screen.getByRole('searchbox', { name: 'Buscar clube' }), topClub.name);
    await user.click(screen.getByRole('button', { name: `Assumir ${topClub.name}` }));
    expect(useGameStore.getState().league!.teams[0].division).toBe(2);
    await user.click(screen.getByRole('button', { name: 'Mercado' }));
    expect(screen.queryByRole('table', { name: 'Jogadores no mercado' })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Faixa etária' }), '18–25');
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
