// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataTable } from '../../src/ui/components/DataTable';
import type { Column } from '../../src/ui/components/DataTable';
import { ClubSelection } from '../../src/ui/screens/ClubSelection';
import { Squad } from '../../src/ui/screens/Squad';
import { App } from '../../src/ui/App';
import { initialGameData, useGameStore } from '../../src/ui/store/gameStore';
import { generateLeague } from '../../src/engine/generators/league';
import { simulateSeason } from '../../src/engine/league';
import { playCupRound } from '../../src/engine/career/cup';
import { careerOf } from '../../src/ui/store/gameStore';

afterEach(cleanup);
beforeEach(() => useGameStore.setState({ ...initialGameData }));

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
    useGameStore.getState().startNewGame(2026);
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
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filtrar por posição' }), 'GK');
    expect(screen.getAllByRole('row')).toHaveLength(4);
    for (const row of screen.getAllByRole('row').slice(1)) expect(row).toHaveTextContent('GOL');
    expect(screen.getByRole('columnheader', { name: 'Força' })).toHaveAttribute('aria-sort', 'descending');
    await user.selectOptions(screen.getByRole('combobox'), 'all');
    expect(screen.getAllByRole('row')).toHaveLength(26);
  });

  it('permite novo jogo, escolha, navegação e avanço de rodada pelo painel', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Novo jogo' }));
    expect(screen.getAllByRole('button', { name: /^Assumir / })).toHaveLength(20);
    await user.click(screen.getAllByRole('button', { name: /^Assumir / })[0]);
    const teamId = useGameStore.getState().selectedTeamId!;
    const teamName = useGameStore.getState().league!.teams.find((team) => team.id === teamId)!.name;
    expect(screen.getByRole('heading', { level: 1, name: 'Central do Clube' })).toBeInTheDocument();
    expect(screen.getAllByText(teamName).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Preparar partida' }));
    expect(screen.getByRole('heading', { name: 'Escalação e tática' })).toBeInTheDocument();
    expect(screen.getAllByRole('combobox', { name: /^Titular / })).toHaveLength(11);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Postura' }), 'attacking');
    await user.click(screen.getByRole('button', { name: 'Jogar partida' }));
    expect(screen.getByRole('heading', { name: 'Bola rolando' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Simular até o fim' }));
    await waitFor(() => expect(useGameStore.getState().currentRound).toBe(2));
    expect(screen.getByRole('heading', { name: 'Apito final' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Próxima rodada' }));
    expect(useGameStore.getState().league!.standings.find((row) => row.teamId === teamId)!.played).toBe(1);
    expect(screen.getByText('FORMA RECENTE')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Classificação' }));
    expect(screen.getByRole('table', { name: 'Classificação completa' })).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(21);
    await user.click(screen.getByRole('button', { name: 'Calendário' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Calendário' })).toBeInTheDocument();
    expect(screen.getByText('Rodada 38')).toBeInTheDocument();
    expect(screen.getAllByLabelText(/^Placar /)).toHaveLength(10);
    await user.click(screen.getByRole('button', { name: 'Elenco' }));
    expect(screen.getByRole('table', { name: 'Elenco do clube' })).toBeInTheDocument();
  });

  it('exibe campeão e desabilita o avanço após a última rodada', () => {
    useGameStore.getState().startNewGame(2026);
    const state = useGameStore.getState();
    const league = state.league!;
    // O resultado completo é produzido pelo motor real, sem alterar suas regras.
    const completed = simulateSeason(league, 2026).league;
    useGameStore.setState({ league: completed, selectedTeamId: league.teams[0].id, screen: 'dashboard', currentRound: 38 });
    useGameStore.setState({ otherLeague: simulateSeason(useGameStore.getState().otherLeague!, 2026).league });
    while (!useGameStore.getState().systems.cup.championId) useGameStore.setState({ ...playCupRound(careerOf(useGameStore.getState())) });
    render(<App />);
    expect(screen.getByRole('status')).toHaveTextContent('Temporada encerrada');
    expect(screen.getByRole('status')).toHaveTextContent(completed.teams.find((team) => team.id === completed.standings[0].teamId)!.name);
    expect(screen.getByRole('button', { name: 'Temporada concluída' })).toBeDisabled();
  });
});
