// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CatalogSeason, ClubFacts, CompetitionOption, ImportJob, ImportSelection, SimulationConfig } from '../../src/data/catalog';
import { generateTeam } from '../../src/engine/generators/team';
import { createImportedCareer } from '../../src/engine/career/imported';
import { App } from '../../src/ui/App';
import { DataImport } from '../../src/ui/screens/DataImport';
import { LicensedImage } from '../../src/ui/components/LicensedImage';
import { initialGameData, useGameStore } from '../../src/ui/store/gameStore';
import { dataRequest } from '../../src/ui/dataClient';

vi.mock('../../src/ui/dataClient', () => ({ dataRequest: vi.fn() }));
let catalog: CatalogSeason[], jobs: ImportJob[];
let nextCareer = 1;
const competitions: CompetitionOption[] = [1, 2].map((n) => ({ externalId: n, country: 'Brazil', name: `Brasil · Série ${n === 1 ? 'A' : 'B'} · DEMONSTRAÇÃO FICTÍCIA`, seasons: [{ year: 2026, current: true }] }));
const teams = (division: number): ClubFacts[] => [1, 2].map((n) => ({ externalId: division * 100 + n, name: `${division === 1 ? 'Horizonte' : 'Vale'} ${n === 1 ? 'Azul' : 'Verde'} (Demo)`, shortName: null, country: 'Brasil', city: 'Cidade fictícia', stadium: null, capacity: null, image: { sourceUrl: null, displayUrl: null, license: null } }));
beforeEach(() => {
  catalog = []; jobs = []; nextCareer = 1;
  localStorage.clear(); useGameStore.setState({ ...initialGameData });
  vi.mocked(dataRequest).mockImplementation(async (path, body) => {
    const url = new URL(path, 'http://localhost');
    if (path === '/status') return { provider: 'demo', dailyRemaining: null, minuteRemaining: null, blockedUntil: 0, running: false } as never;
    if (path === '/countries') return ['Brazil'] as never;
    if (url.pathname === '/competitions') return competitions as never;
    if (url.pathname === '/teams') return teams(Number(url.searchParams.get('league'))) as never;
    if (path === '/catalog') return catalog as never;
    if (path === '/imports' && body === undefined) return jobs as never;
    if (path === '/imports') {
      const { selection } = body as { selection: ImportSelection };
      const season: CatalogSeason = { id: `season-${selection.division}`, provider: 'demo', competition: selection.competition, year: selection.year, division: selection.division,
        clubs: teams(selection.division).filter((t) => selection.clubIds.includes(t.externalId)).map((t) => ({ ...t, id: `club-${t.externalId}`, provider: 'demo', rosterKind: 'demo', updatedAt: '2026-01-01T00:00:00Z',
          players: generateTeam(t.externalId, 65).squad.map((p, i) => ({ id: `player-${t.externalId}-${i}`, externalId: t.externalId * 100 + i, name: p.name + ' (Demo)', age: p.age, birthDate: null, nationality: p.nationality, position: p.primaryPosition, number: i + 1, image: { sourceUrl: null, displayUrl: null, license: null } })) })) };
      catalog = [...catalog.filter((s) => s.id !== season.id), season];
      const job: ImportJob = { id: `job-${jobs.length}`, provider: 'demo', selection, status: 'done', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', items: season.clubs.map((c) => ({ externalId: c.externalId, name: c.name, status: 'done', players: c.players.length, error: null, warnings: [] })) };
      jobs = [job, ...jobs]; return job as never;
    }
    if (path === '/careers') { const args = body as { seasonIds: string[]; seed: number; simulation: SimulationConfig; assignments: Record<string, string> }; return createImportedCareer({ id: `career-${nextCareer++}`, createdAt: '2026-01-01T00:00:00Z', seasons: catalog.filter((s) => args.seasonIds.includes(s.id)), simulation: args.simulation, assignments: args.assignments }, args.seed) as never; }
    throw new Error(`Rota inesperada: ${path}`);
  });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('fluxo administrativo de importação', () => {
  it('consulta, seleciona, importa dois clubes, cria carreira, mostra elenco e preserva a origem ao salvar', async () => {
    const user = userEvent.setup(); render(<App />);
    await user.click(screen.getByRole('button', { name: /Importação de Dados/ }));
    expect(await screen.findByRole('heading', { name: 'Importação de Dados' })).toBeInTheDocument();
    expect(await screen.findByText('DEMONSTRAÇÃO FICTÍCIA · sem chave configurada')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Consultar clubes' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Consultar clubes' }));
    expect(await screen.findByRole('checkbox', { name: /Horizonte Azul/ })).toBeChecked();
    await user.click(screen.getByRole('checkbox', { name: /Horizonte Verde/ }));
    expect(screen.getByRole('button', { name: 'Importar 1 clube(s) e jogadores' })).toBeEnabled();
    await user.click(screen.getByRole('checkbox', { name: /Horizonte Verde/ }));
    await user.click(screen.getByRole('button', { name: 'Importar 2 clube(s) e jogadores' }));
    expect(await screen.findByRole('heading', { name: '4. Catálogo importado · identidades e imagens' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '2');
    expect(screen.getByRole('table', { name: /Jogadores importados de Horizonte Azul/ })).toBeInTheDocument();
    expect(screen.getByText(/Direitos de uso não verificados/)).toBeInTheDocument();
    const season = catalog[0];
    await user.selectOptions(screen.getByRole('combobox', { name: 'Base da Divisão 1' }), season.id);
    expect(screen.getByText('2 clubes importados + 38 clubes fictícios complementares')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Criar carreira e escolher clube' }));
    expect(await screen.findByRole('heading', { name: 'Onde começa a sua história?' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Assumir / })).toHaveLength(20);
    await user.click(screen.getByRole('button', { name: 'Assumir Horizonte Azul (Demo)' }));
    await user.click(screen.getByRole('button', { name: 'Elenco' }));
    expect(screen.getByText(/Força, potencial, atributos, condição, moral/)).toBeInTheDocument();
    const importedPlayer = useGameStore.getState().league!.teams[0].squad[0];
    await user.click(screen.getByRole('button', { name: new RegExp(importedPlayer.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }));
    expect(screen.getByRole('region', { name: 'Identidade importada do jogador' })).toHaveTextContent('Nascimento: Não informado');
    const source = useGameStore.getState().source;
    await act(async () => { await useGameStore.getState().advanceRound(); });
    const raw = useGameStore.getState().exportGame()!;
    act(() => { useGameStore.getState().startNewGame(9); useGameStore.getState().importGame(raw); });
    expect(useGameStore.getState().source).toEqual(source);
    expect(useGameStore.getState().lastRound).toBe(1);
    expect(catalog[0].clubs[0].players[0].age).toBe(season.clubs[0].players[0].age);
  }, 15000);
  it('informa falha de conexão e permite tentar novamente sem digitar chave na interface', async () => {
    vi.mocked(dataRequest).mockRejectedValueOnce(new Error('Backend indisponível. Inicie com npm run dev.'));
    render(<DataImport />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Backend indisponível');
    expect(screen.queryByLabelText(/chave da API/i)).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByText('DEMONSTRAÇÃO FICTÍCIA · sem chave configurada')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Consultar clubes' })).toBeEnabled());
  });
  it('troca para Série B, permite definir a divisão e mantém o resultado importado nessa base', async () => {
    const user = userEvent.setup(); render(<DataImport />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Consultar clubes' })).toBeEnabled());
    await user.selectOptions(screen.getByRole('combobox', { name: 'Campeonato' }), '2');
    expect(screen.getByRole('combobox', { name: 'Divisão no FootBR' })).toHaveValue('2');
    await user.click(screen.getByRole('button', { name: 'Consultar clubes' }));
    await user.click(await screen.findByRole('button', { name: 'Importar 2 clube(s) e jogadores' }));
    await waitFor(() => expect(catalog).toHaveLength(1));
    expect(catalog[0].division).toBe(2);
    expect(screen.getByRole('combobox', { name: 'Base da Divisão 2' })).toHaveTextContent('Série B');
  });
  it('usa fallback para imagem sem licença, URL inválida ou falha de carregamento', () => {
    const base = { sourceUrl: 'https://media.api-sports.io/football/teams/1.png', displayUrl: 'https://media.api-sports.io/football/teams/1.png', license: null };
    const { rerender } = render(<LicensedImage image={base} fallback={<span>Escudo alternativo</span>} alt="Escudo de teste" />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    rerender(<LicensedImage image={{ ...base, license: 'Licença de teste' }} fallback={<span>Escudo alternativo</span>} alt="Escudo de teste" />);
    fireEvent.error(screen.getByRole('img', { name: 'Escudo de teste' }));
    expect(screen.getByText('Escudo alternativo')).toBeInTheDocument();
    rerender(<LicensedImage image={{ ...base, license: 'Licença de teste', displayUrl: 'javascript:alert(1)' }} fallback={<span>Escudo alternativo</span>} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
