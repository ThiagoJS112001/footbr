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
import { createCareer, seasonSeed } from '../../src/engine/career/career';
import type { Career } from '../../src/engine/career/career';
import type { Lineup } from '../../src/engine/models';
import { saveKey } from '../../src/ui/store/gameStore';
import { prospectReport } from '../../src/engine/career/academy';
import { repairLineup } from '../../src/engine/career/progression';

if (!HTMLDialogElement.prototype.showModal) {
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value(this: HTMLDialogElement) { this.setAttribute('open', ''); } },
    close: { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute('open'); } },
  });
}

beforeEach(() => { localStorage.clear(); useGameStore.setState({ ...initialGameData }); });
afterEach(cleanup);
function start(cupParticipant = false, signSponsorship = true) {
  useGameStore.getState().startCustomGame(createCareer(42));
  const state = useGameStore.getState();
  state.selectTeam(cupParticipant ? state.systems.cup.rounds[0].matches[0].homeTeamId : state.league!.teams[19].id);
  if (signSponsorship) state.sponsor('raiz');
}

async function advancePreparedRounds(rounds: number) {
  for (let index = 0; index <= rounds; index++) {
    const state = useGameStore.getState();
    useGameStore.setState(repairLineup(careerOf(state), state.lineup));
    if (index < rounds) await state.advanceRound();
  }
}

describe('decisões rápidas de carreira na interface', () => {
  it('abre patrocínios, busca de jovens e perfil do treinador pelos pontos de entrada do jogo', async () => {
    start(false, false);
    render(<App />);
    const user = userEvent.setup();
    expect(screen.getByRole('button', { name: 'Jogar rodada' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Comparar patrocinadores' }));
    expect(screen.getByRole('heading', { name: 'Patrocínios do clube' })).toBeInTheDocument();
    const offers = screen.getAllByRole('button', { name: 'Assinar contrato' });
    expect(offers).toHaveLength(3);
    await user.click(offers[0]);
    expect(screen.getByText('Rede Raiz')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Central do Clube' }));
    expect(screen.getByRole('button', { name: 'Jogar rodada' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Mercado' }));
    await user.click(screen.getByRole('button', { name: 'Jovens Promessas' }));
    expect(screen.getByRole('table', { name: 'Jovens de outros clubes' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Minha Carreira' }));
    expect(screen.getByRole('heading', { name: 'Minha Carreira' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Patrimônio e apostas' }));
    expect(screen.getByRole('heading', { name: 'Patrimônio pessoal' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Denunciar abordagem' }));
    expect(useGameStore.getState().systems.coach?.incidents.at(-1)?.kind).toBe('report');
  });

  it('carrega um slot v1 em andamento sem sortear novamente o passado da partida', async () => {
    start();
    await advancePreparedRounds(2);
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
      try {
        const lineup = team.id === c.selectedTeamId && c.lineup ? c.lineup : autoPickLineup(team);
        lineup.substituteIds = team.squad.filter((p) => !lineup.starterIds.includes(p.id) && !p.injury && !p.discipline.suspendedMatches).map((p) => p.id).sort();
        lineups[team.id] = lineup;
      }
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
    expect(useGameStore.getState().lineup?.substituteIds.length).toBeLessThanOrEqual(10);
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
    await user.click(screen.getByRole('button', { name: 'Propostas recebidas' }));
    expect(screen.queryByRole('table', { name: 'Jogadores no mercado' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: `Analisar proposta por ${offer.playerName}` }));
    const proposal = within(screen.getByRole('dialog', { name: offer.playerName }));
    await user.click(proposal.getByRole('button', { name: `Aceitar proposta por ${offer.playerName}` }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(useGameStore.getState().error).toBeNull();
    expect(ownTeam(careerOf(useGameStore.getState())).squad.some((p) => p.id === offer.playerId)).toBe(false);
    const navigation = screen.getByRole('navigation', { name: 'Navegação principal' });
    expect(navigation).not.toHaveTextContent('História');
    expect(navigation).not.toHaveTextContent('Partida');
    await user.click(screen.getByRole('button', { name: 'Minhas negociações' }));
    await user.click(screen.getByRole('button', { name: 'Ver movimentações do mercado' }));
    expect(await screen.findByRole('table', { name: 'Histórico de transferências' })).toHaveTextContent(offer.playerName);
  });

  it('avalia um jovem, revela potencial e o promove ao elenco profissional', async () => {
    start();
    const prospect = useGameStore.getState().systems.academy.prospects[1];
    render(<App />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Categorias de Base' }));
    const playerRow = screen.getByRole('button', { name: prospect.player.name }).closest('tr')!;
    await user.click(within(playerRow).getAllByRole('cell')[2]);
    await user.click(screen.getByRole('button', { name: `Avaliar ${prospect.player.name}` }));
    const report = prospectReport(prospect.player, ownTeam(careerOf(useGameStore.getState())));
    expect(screen.getByText(`${report.low}–${report.high} · faixa estimada`)).toBeInTheDocument();
    expect(screen.queryByText(`${prospect.player.potential} · teto estimado`)).not.toBeInTheDocument();
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
    await user.click(screen.getByRole('button', { name: 'Propostas para continuar sua carreira' }));
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
    expect(screen.getByRole('region', { name: 'Negociação' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Buscar jogadores' }));
    expect(screen.getByRole('combobox', { name: 'Posição' })).toHaveValue('GK');
    await user.click(screen.getByRole('button', { name: 'Elenco' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filtrar por posição' }), 'CB');
    await user.click(screen.getByRole('button', { name: 'Finanças' }));
    expect(screen.getByText('Planejamento rápido')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Elenco' }));
    expect(screen.getByRole('combobox', { name: 'Filtrar por posição' })).toHaveValue('CB');
  });

  it('prepara a copa pelo mesmo botão e exibe resumo sem avançar outra rodada da liga', async () => {
    start(true);
    await advancePreparedRounds(4);
    expect(useGameStore.getState().currentRound).toBe(5);
    render(<App />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Preparar partida' }));
    expect(screen.getAllByText(/Copa dos Horizontes ·/).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Central do Clube' }));
    await user.click(screen.getByRole('button', { name: 'Acompanhar ao vivo' }));
    expect(useGameStore.getState().liveCompetition).toBe('cup');
    await user.click(screen.getByRole('button', { name: 'Simular até o fim' }));
    expect(useGameStore.getState().error).toBeNull();
    expect(useGameStore.getState().currentRound).toBe(5);
    expect(screen.getByText('Entender a partida e os desfalques')).toBeInTheDocument();
    expect(useGameStore.getState().systems.lastSummary?.competition).toBe('cup');
  });

  it('salva e retoma uma partida de copa com as mesmas escalações, minuto e decisões', async () => {
    start(true);
    await advancePreparedRounds(4);
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
