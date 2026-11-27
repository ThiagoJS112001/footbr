import { createCareer } from '../../src/engine/career/career';
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataTable } from '../../src/ui/components/DataTable';
import type { Column } from '../../src/ui/components/DataTable';
import { ClubSelection } from '../../src/ui/screens/ClubSelection';
import { Squad } from '../../src/ui/screens/Squad';
import { App } from '../../src/ui/App';
import { initialGameData, saveKey, useGameStore } from '../../src/ui/store/gameStore';
import { generateLeague } from '../../src/engine/generators/league';
import { simulateSeason } from '../../src/engine/league';
import { playCupRound } from '../../src/engine/career/cup';
import { careerOf } from '../../src/ui/store/gameStore';
import { nextCompetition } from '../../src/engine/career/progression';
import { ownTeam, replaceTeams } from '../../src/engine/career/world';
import { decodeSave } from '../../src/engine/save/save';

if (!HTMLDialogElement.prototype.showModal) {
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value(this: HTMLDialogElement) { this.setAttribute('open', ''); } },
    close: { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute('open'); } },
  });
}

afterEach(cleanup);
beforeEach(() => useGameStore.setState({ ...initialGameData }));

function dragPlayer(source: Element, target: Element) {
  const data = new Map<string, string>();
  const dataTransfer = { getData: (key: string) => data.get(key), setData: (key: string, value: string) => data.set(key, value) };
  fireEvent.dragStart(source, { dataTransfer });
  fireEvent.dragOver(target, { dataTransfer });
  fireEvent.drop(target, { dataTransfer });
  fireEvent.dragEnd(source, { dataTransfer });
}

async function playDashboardRound(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Jogar rodada' }));
  if (useGameStore.getState().screen === 'lineup') {
    expect(screen.getByRole('alert')).toHaveTextContent('Revise a escalação');
    await user.click(screen.getByRole('button', { name: 'Escalar automaticamente' }));
    await user.click(screen.getByRole('button', { name: 'Central do Clube' }));
    await user.click(screen.getByRole('button', { name: 'Jogar rodada' }));
  }
  await waitFor(() => expect(useGameStore.getState().isAdvancing).toBe(false));
}

describe('componentes da interface', () => {
  it('pagina depois de ordenar todos os registros e volta à primeira página ao mudar a ordem', async () => {
    const user = userEvent.setup();
    const rows = Array.from({ length: 7 }, (_, i) => ({ id: String(i), value: i + 1 }));
    render(<DataTable caption="Lista paginada" rows={rows} pageSize={3} getRowId={(row) => row.id} columns={[{ id: 'value', label: 'Valor', sortValue: (row) => row.value, render: (row) => row.value }]} initialSort={{ id: 'value', direction: 'desc' }} />);
    expect(screen.getAllByRole('cell').map((c) => c.textContent)).toEqual(['7', '6', '5']);
    await user.click(screen.getByRole('button', { name: 'Próxima página' }));
    expect(screen.getAllByRole('cell').map((c) => c.textContent)).toEqual(['4', '3', '2']);
    await user.click(screen.getByRole('button', { name: 'Valor' }));
    expect(screen.getAllByRole('cell').map((c) => c.textContent)).toEqual(['1', '2', '3']);
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled();
  });
  it('ordena números numericamente e textos ao clicar no cabeçalho, nos dois sentidos', async () => {
    const user = userEvent.setup();
    interface Row { id: string; name: string; rating: number }
    const rows: Row[] = [{ id: 'a', name: 'Breno', rating: 9 }, { id: 'b', name: 'Adélio', rating: 80 }, { id: 'c', name: 'Camilo', rating: 70 }];
    const columns: Column<Row>[] = [
      { id: 'name', label: 'Nome', render: (row) => row.name, sortValue: (row) => row.name },
      { id: 'rating', label: 'Força', render: (row) => row.rating, sortValue: (row) => row.rating },
    ];
    render(<DataTable caption="Jogadores de teste" rows={rows} columns={columns} getRowId={(row) => row.id} />);
    const firstName = () => within(screen.getAllByRole('row')[1]).getAllByRole('cell')[0].textContent;
    await user.click(screen.getByRole('button', { name: 'Força' }));
    expect(firstName()).toBe('Breno');
    expect(screen.getByRole('columnheader', { name: 'Força' })).toHaveAttribute('aria-sort', 'ascending');
    await user.click(screen.getByRole('button', { name: 'Força' }));
    expect(firstName()).toBe('Adélio');
    expect(screen.getByRole('columnheader', { name: 'Força' })).toHaveAttribute('aria-sort', 'descending');
    await user.click(screen.getByRole('button', { name: 'Nome' }));
    expect(firstName()).toBe('Adélio');
    expect(rows.map((row) => row.id)).toEqual(['a', 'b', 'c']);
  });

  it('lista os 20 clubes com reputação e overall e permite assumir um clube', async () => {
    useGameStore.getState().startCustomGame(createCareer(2026));
    const league = useGameStore.getState().league!;
    render(<ClubSelection league={league} />);
    const buttons = screen.getAllByRole('button', { name: /^Assumir / });
    expect(buttons).toHaveLength(20);
    for (const team of league.teams) {
      const button = screen.getByRole('button', { name: `Assumir ${team.name}` });
      expect(button).toHaveTextContent('Reputação');
      expect(button).toHaveTextContent('FORÇA MÉDIA');
    }
    await userEvent.setup().click(buttons[0]);
    expect(useGameStore.getState().selectedTeamId).not.toBeNull();
    expect(useGameStore.getState().screen).toBe('dashboard');
  });

  it('filtra o elenco por posição e mantém a ordenação', async () => {
    const team = generateLeague(42).teams[0];
    render(<Squad team={team} />);
    expect(screen.getAllByRole('row')).toHaveLength(26);
    const user = userEvent.setup();
    const positionHeader = screen.getByRole('button', { name: 'Posição' }).closest('th')!;
    const positions = () => screen.getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell')[1].textContent);
    const tacticalOrder = ['GOL', 'LE', 'LD', 'ZAG', 'VOL', 'MC', 'MEI', 'PE', 'PD', 'ATA'];
    expect([...new Set(positions())]).toEqual(tacticalOrder);
    await user.selectOptions(within(positionHeader).getByRole('combobox', { name: 'Filtrar por posição' }), 'GK');
    expect(screen.getAllByRole('row')).toHaveLength(4);
    for (const row of screen.getAllByRole('row').slice(1)) expect(row).toHaveTextContent('GOL');
    expect(positionHeader).toHaveAttribute('aria-sort', 'ascending');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filtrar por posição' }), 'all');
    expect(screen.getAllByRole('row')).toHaveLength(26);
    await user.click(within(positionHeader).getByRole('button', { name: 'Posição' }));
    expect([...new Set(positions())]).toEqual([...tacticalOrder].reverse());
    await user.click(screen.getByRole('button', { name: 'Força' }));
    expect(screen.getByRole('columnheader', { name: 'Força' })).toHaveAttribute('aria-sort', 'ascending');
    await user.click(screen.getByRole('button', { name: 'Idade' }));
    expect(screen.getByRole('columnheader', { name: 'Idade' })).toHaveAttribute('aria-sort', 'ascending');
  });

  it('retoma uma carreira salva pelo menu após recarregar o jogo', async () => {
    const store = useGameStore.getState();
    const previous = localStorage.getItem(saveKey());
    try {
      const career = createCareer(2026);
      const team = career.league.teams[0];
      store.startCustomGame(career);
      store.selectTeam(team.id);
      useGameStore.setState({ ...initialGameData });
      render(<App />);
      expect(screen.getByRole('button', { name: `Carregar save automático de ${team.name}` })).toBeEnabled();
      await userEvent.setup().click(screen.getByRole('button', { name: 'Continuar jogo' }));
      expect(screen.getByRole('heading', { name: 'Central do Clube' })).toBeInTheDocument();
      expect(useGameStore.getState().selectedTeamId).toBe(team.id);
    } finally {
      if (previous === null) localStorage.removeItem(saveKey());
      else localStorage.setItem(saveKey(), previous);
    }
  });

  it('permite novo jogo, escolha, navegação e avanço de rodada pelo painel', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Novo jogo' }));
    expect(screen.getAllByRole('button', { name: /^Assumir / })).toHaveLength(20);
    await user.click(screen.getAllByRole('button', { name: /^Assumir / })[0]);
    act(() => useGameStore.getState().sponsor('raiz'));
    const teamId = useGameStore.getState().selectedTeamId!;
    const teamName = useGameStore.getState().league!.teams.find((team) => team.id === teamId)!.name;
    expect(screen.getByRole('heading', { level: 1, name: 'Central do Clube' })).toBeInTheDocument();
    expect(screen.getAllByText(teamName).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Preparar partida' }));
    expect(screen.getByRole('heading', { name: 'Escalação e tática' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Campo tático/ }).querySelectorAll('[draggable="true"]')).toHaveLength(11);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Formação' }), '4-1-2-1-2');
    const diamond = screen.getByRole('img', { name: 'Campo tático na formação 4-4-2 Losango' });
    expect(diamond.querySelectorAll('[draggable="true"]')).toHaveLength(11);
    expect(diamond.querySelectorAll('[role="meter"]')).toHaveLength(11);
    expect(decodeSave(useGameStore.getState().exportGame()!).career.lineup?.tactic.formation).toBe('4-1-2-1-2');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Postura' }), 'attacking');
    await user.click(screen.getByRole('button', { name: 'Central do Clube' }));
    await user.click(screen.getByRole('button', { name: 'Acompanhar ao vivo' }));
    expect(screen.getByRole('heading', { name: 'Bola rolando' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Simular até o fim' }));
    await waitFor(() => expect(useGameStore.getState().systems.lastSummary?.competition).toBe('state'));
    expect(screen.getByRole('heading', { name: 'Apito final' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Próxima rodada' }));
    for (let i = 0; i < 2 && useGameStore.getState().currentRound === 1; i++) {
      await playDashboardRound(user);
    }
    expect(useGameStore.getState().league!.standings.find((row) => row.teamId === teamId)!.played).toBe(1);
    expect(screen.getByRole('heading', { name: 'Resumo · Rodada 1' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Classificação' }));
    expect(screen.getByRole('table', { name: 'Classificação completa' })).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(21);
    const otherLeague = useGameStore.getState().otherLeague!;
    await user.selectOptions(screen.getByRole('combobox', { name: 'Divisão' }), otherLeague.id);
    expect(within(screen.getByRole('table')).getByText(otherLeague.teams[0].name)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Calendário' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Calendário' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Competição' })).toHaveValue('all');
    expect(screen.getByRole('heading', { name: 'Próximos jogos' })).toBeInTheDocument();
    const summaryRows = within(screen.getByRole('table', { name: 'Resumo da classificação' })).getAllByRole('row').slice(1);
    expect(summaryRows.length).toBeLessThanOrEqual(4);
    expect(summaryRows.some((row) => row.textContent?.includes(teamName))).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Ver chaveamento' }));
    expect(screen.getByRole('combobox', { name: 'Competição' })).toHaveValue(useGameStore.getState().systems.cup.id);
    expect(screen.getByRole('heading', { name: 'Calendário das etapas' })).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Competição' }), 'all');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Exibir jogos' }), 'all');
    expect(screen.getByText('Rodada 38')).toBeInTheDocument();
    const firstLeagueRound = screen.getByText('Rodada 01').closest('details')!;
    expect(within(firstLeagueRound).getAllByLabelText(/^Placar /)).toHaveLength(10);
    await user.click(screen.getByRole('button', { name: 'Resultados' }));
    expect(screen.getByRole('heading', { name: 'Resultados' })).toBeInTheDocument();
    expect(screen.getAllByLabelText(/^Placar /).length).toBeGreaterThan(0);
    await user.click(screen.getAllByRole('button', { name: /^Notas da partida/ })[0]);
    const ratings = within(screen.getByRole('dialog', { name: 'Notas dos jogadores' }));
    expect(ratings.getByRole('img', { name: /Campo tático/ })).toBeInTheDocument();
    expect(ratings.getByRole('heading', { name: 'Reservas que entraram' })).toBeInTheDocument();
    await user.click(ratings.getByRole('button', { name: 'Fechar notas' }));
    await user.click(screen.getByRole('button', { name: 'Elenco' }));
    expect(screen.getByRole('table', { name: 'Elenco do clube' })).toBeInTheDocument();
  }, 15000);

  it('troca um titular suspenso e joga cinco rodadas da liga na central', async () => {
    const user = userEvent.setup();
    const initial = useGameStore.getState();
    initial.startNewGame(42);
    initial.selectTeam(useGameStore.getState().league!.teams[19].id);
    initial.sponsor('raiz');
    for (let i = 0; i < 2 && nextCompetition(careerOf(useGameStore.getState())) === 'state'; i++) await initial.advanceRound();
    const career = careerOf(useGameStore.getState());
    const team = ownTeam(career);
    const suspended = career.lineup!.starterIds[0];
    const injured = team.squad.find((p) => career.lineup!.substituteIds.includes(p.id) && p.primaryPosition !== 'GK')!;
    const updated = replaceTeams(career, [{ ...team, squad: team.squad.map((player) => player.id === suspended
      ? { ...player, discipline: { ...player.discipline, suspendedMatches: 2 } }
      : player.id === injured.id ? { ...player, injury: { description: 'Lesão', remainingDays: 14 } } : player) }]);
    useGameStore.setState(updated);
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Preparar partida' }));
    const suspendedName = team.squad.find((p) => p.id === suspended)!.name;
    expect(screen.getByRole('alert')).toHaveTextContent(suspendedName);
    expect(screen.getByRole('button', { name: 'Jogar partida' })).toBeDisabled();
    const replacement = team.squad.find((p) => p.primaryPosition === 'GK' && p.id !== suspended && !p.injury && !p.discipline.suspendedMatches)!;
    dragPlayer(screen.getByText(replacement.name).closest('tr')!, screen.getByTitle(`${suspendedName} · Suspenso`));
    expect(useGameStore.getState().lineup?.starterIds[0]).toBe(replacement.id);
    const bank = within(screen.getByRole('table', { name: 'Reservas' }));
    const injuredRow = within(bank.getByText(injured.name).closest('tr')!);
    expect(injuredRow.getByTitle('Lesionado · 14 dias')).toBeInTheDocument();
    await user.click(injuredRow.getByRole('button', { name: 'Retirar' }));
    expect(screen.getByRole('button', { name: 'Jogar partida' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Central do Clube' }));
    for (let i = 0; i < 8 && useGameStore.getState().currentRound < 6; i++) {
      await playDashboardRound(user);
      expect(useGameStore.getState().screen).toBe('dashboard');
    }
    expect(useGameStore.getState().currentRound).toBe(6);
    expect(screen.getByRole('heading', { name: 'Resumo · Rodada 5' })).toBeInTheDocument();
  }, 15000);

  it('troca jogadores por arraste entre o campo, o banco e os não relacionados', () => {
    const store = useGameStore.getState();
    store.startNewGame(42);
    store.selectTeam(useGameStore.getState().league!.teams[0].id);
    store.autoLineup();
    store.navigate('lineup');
    const career = careerOf(useGameStore.getState());
    const team = ownTeam(career);
    const lineup = career.lineup!;
    const starter = team.squad.find((player) => player.id === lineup.starterIds[0])!;
    const reserve = team.squad.find((player) => lineup.substituteIds.includes(player.id) && player.primaryPosition === 'GK')!;
    const getLineup = () => useGameStore.getState().lineup!;
    const row = (group: string, name: string) => within(screen.getByRole('table', { name: group })).getByText(name).closest('tr')!;
    render(<App />);
    const outside = team.squad.find((player) => !lineup.starterIds.includes(player.id) && !lineup.substituteIds.includes(player.id) && !player.injury && !player.discipline.suspendedMatches)!;
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    dragPlayer(row('Não relacionados', outside.name), screen.getByRole('heading', { name: 'Reservas (10/10)' }));
    expect(getLineup().substituteIds).toEqual(lineup.substituteIds);
    dragPlayer(row('Reservas', reserve.name), screen.getByTitle(starter.name));
    expect(getLineup().starterIds[0]).toBe(reserve.id);
    expect(getLineup().substituteIds).toContain(starter.id);

    dragPlayer(row('Reservas', starter.name), screen.getByRole('heading', { name: /Não relacionados/ }));
    expect(getLineup().substituteIds).not.toContain(starter.id);
    dragPlayer(row('Não relacionados', starter.name), screen.getByTitle(reserve.name));
    expect(getLineup().starterIds[0]).toBe(starter.id);
    expect(getLineup().substituteIds).not.toContain(reserve.id);

    const otherReserve = team.squad.find((player) => getLineup().substituteIds.includes(player.id))!;
    dragPlayer(row('Não relacionados', reserve.name), row('Reservas', otherReserve.name));
    expect(getLineup().substituteIds).toContain(reserve.id);
    expect(getLineup().substituteIds).not.toContain(otherReserve.id);
    dragPlayer(row('Não relacionados', otherReserve.name), screen.getByRole('heading', { name: 'Reservas (9/10)' }));
    expect(getLineup().substituteIds).toHaveLength(10);
    const stillOutside = team.squad.find((player) => !getLineup().starterIds.includes(player.id) && !getLineup().substituteIds.includes(player.id) && !player.injury && !player.discipline.suspendedMatches)!;
    act(() => store.toggleReserve(stillOutside.id));
    expect(getLineup().substituteIds).toHaveLength(10);
    expect(getLineup().substituteIds).not.toContain(stillOutside.id);
  });

  it('aplica as alterações do editor à seleção e ao elenco de uma nova carreira', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Editor de clubes e elencos' }));
    const clubName = await screen.findByRole('textbox', { name: 'Nome do clube' });
    const playerName = screen.getByRole('textbox', { name: 'Jogador 1' });
    await user.clear(clubName);
    await user.type(clubName, 'Clube de Teste');
    await user.clear(playerName);
    await user.type(playerName, 'Goleiro de Teste');
    await user.click(screen.getByRole('button', { name: 'Jogar com esta base' }));
    await user.click(await screen.findByRole('button', { name: 'Assumir Clube de Teste' }));
    await user.click(screen.getByRole('button', { name: 'Elenco' }));
    expect(screen.getByRole('table', { name: 'Elenco do clube' })).toHaveTextContent('Goleiro de Teste');
  });

  it('abre a cerimônia, avança a temporada e preserva as premiações no Calendário', async () => {
    useGameStore.getState().startCustomGame(createCareer(2026));
    const state = useGameStore.getState();
    const league = state.league!;
    // O resultado completo é produzido pelo motor real, sem alterar suas regras.
    const completed = simulateSeason(league, 2026).league;
    useGameStore.setState({ league: completed, selectedTeamId: league.teams[0].id, screen: 'dashboard', currentRound: 38 });
    useGameStore.setState({ otherLeague: simulateSeason(useGameStore.getState().otherLeague!, 2026).league });
    while (!useGameStore.getState().systems.cup.championId) useGameStore.setState({ ...playCupRound(careerOf(useGameStore.getState())) });
    render(<App />);
    const user = userEvent.setup();
    expect(screen.getByRole('status')).toHaveTextContent('Temporada encerrada');
    expect(screen.getByRole('status')).toHaveTextContent(completed.teams.find((team) => team.id === completed.standings[0].teamId)!.name);
    await user.click(screen.getByRole('button', { name: 'Avançar' }));
    expect(screen.getByRole('heading', { name: 'Premiações da Temporada' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Competição' })).toHaveValue('all');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Competição' }), completed.id);
    const selection = within(screen.getByRole('table', { name: 'Seleção do Campeonato' }));
    expect(selection.getAllByRole('row')).toHaveLength(12);
    await user.click(selection.getAllByRole('button')[0]);
    const profile = within(screen.getByRole('dialog'));
    expect(profile.getByRole('heading', { name: 'Conquistas e Premiações' })).toBeInTheDocument();
    await user.click(profile.getByRole('button', { name: 'Fechar ficha' }));
    await user.click(screen.getByRole('button', { name: 'Começar próxima temporada' }));
    expect(useGameStore.getState().season).toBe(2);
    await user.click(screen.getByRole('button', { name: 'Calendário' }));
    await user.click(screen.getByRole('button', { name: 'Premiações' }));
    expect(screen.getByRole('combobox', { name: 'Temporada' })).toHaveValue('1');
    expect(screen.getByRole('table', { name: 'Seleção da Temporada' })).toBeInTheDocument();
  }, 25000);
});
