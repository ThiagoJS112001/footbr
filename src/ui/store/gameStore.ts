import { create } from 'zustand';
import { autoPickLineup, LineupUnavailableError } from '../../engine/league';
import { formationSlots, validateLineup } from '../../engine/league/lineup';
import { startRound, stepRound } from '../../engine/league/season';
import type { RoundSession } from '../../engine/league/season';
import { changeMatchStyle, finishMatch, substitutePlayer } from '../../engine/simulation/simulateMatch';
import type { League, Tactic } from '../../engine/models';
import type { PlayingStyle } from '../../engine/models/Tactic';
import { buyPlayer, createCareer, nextSeason, renewContract, seasonSeed, sellPlayer } from '../../engine/career/career';
import type { Career } from '../../engine/career/career';
import { decodeSave, encodeSave } from '../../engine/save/save';
import type { MatchCommand, SaveData } from '../../engine/save/save';
import { createSystems, emptySystems } from '../../engine/career/bootstrap';
import { cupLeague, resolveBackgroundCup } from '../../engine/career/cup';
import { finishCareerEvent, repairLineup, seasonComplete, simulateCareerEvent, startCareerEvent } from '../../engine/career/progression';
import type { Competition } from '../../engine/career/progression';
import { refreshOffers, respondToOffer } from '../../engine/career/market';
import { assessProspect, promoteProspect, releaseProspect } from '../../engine/career/academy';
import { takeJob } from '../../engine/career/board';
import { resetUiPreferences } from './uiStore';
import { decodeStoredSave, encodeStoredSave } from './saveStorage';

export type GameScreen = 'dashboard' | 'squad' | 'lineup' | 'match' | 'standings' | 'calendar' | 'market' | 'finances' | 'history' | 'cup' | 'academy' | 'board' | 'compare';
export type Screen = 'menu' | 'club-selection' | 'data-import' | GameScreen;
export const saveKey = (slot = 0) => `footbr.save.v1.${slot}`;

interface GameData extends Omit<Career, 'league' | 'otherLeague' | 'seed'> {
  league: League | null;
  otherLeague: League | null;
  seed: number | null;
  currentRound: number;
  screen: Screen;
  isAdvancing: boolean;
  error: string | null;
  message: string | null;
  saveStatus: string;
  live: RoundSession | null;
  commands: MatchCommand[];
  lastRound: number | null;
  paused: boolean;
  speed: number;
  liveCompetition: Competition;
  lastCompetition: Competition;
  lastCupRound: number | null;
}

interface GameActions {
  startNewGame: (seed?: number) => void;
  startImportedGame: (career: Career) => void;
  selectTeam: (teamId: string) => void;
  navigate: (screen: GameScreen | 'menu' | 'data-import') => void;
  updateTactic: (patch: Partial<Tactic>) => void;
  pickPlayer: (slot: number, playerId: string) => void;
  toggleReserve: (playerId: string) => void;
  autoLineup: () => void;
  advanceRound: () => Promise<void>;
  kickOff: () => void;
  tickMatch: () => void;
  finishMatchNow: () => void;
  togglePause: () => void;
  setSpeed: (speed: number) => void;
  changeStyle: (style: PlayingStyle) => void;
  substitute: (outId: string, inId: string) => void;
  buy: (id: string, offer: number, salary: number, years: number) => void;
  sell: (id: string) => void;
  renew: (id: string) => void;
  respondOffer: (id: string, accept: boolean) => void;
  assessYouth: (id: string) => void;
  promoteYouth: (id: string) => void;
  releaseYouth: (id: string) => void;
  acceptJob: (id: string) => void;
  beginNextSeason: () => void;
  saveGame: (slot?: number) => void;
  loadGame: (slot?: number) => void;
  exportGame: () => string | null;
  importGame: (raw: string) => void;
}

export const initialGameData: GameData = {
  source: undefined,
  league: null, otherLeague: null, selectedTeamId: null, currentRound: 1, seed: null, season: 1,
  screen: 'menu', isAdvancing: false, error: null, message: null, saveStatus: '',
  lineup: null, finances: [], history: [], freeAgents: [], news: [], live: null, commands: [], lastRound: null, paused: true, speed: 1,
  systems: emptySystems, liveCompetition: 'league', lastCompetition: 'league', lastCupRound: null,
};

export function careerOf(state: GameData): Career {
  if (!state.league || !state.otherLeague || state.seed === null || !state.selectedTeamId) throw new Error('Escolha um clube primeiro.');
  const { league, otherLeague, seed, selectedTeamId, season, lineup, finances, history, freeAgents, news, systems, source } = state;
  return { league, otherLeague, seed, selectedTeamId, season, lineup, finances, history, freeAgents, news, systems, source };
}
function replay(data: SaveData): RoundSession | null {
  if (!data.progress) return null;
  const c = data.career;
  const cup = data.progress.competition === 'cup';
  let live = startRound(cup ? cupLeague(c) : c.league, cup ? (seasonSeed(c) ^ 0xc0ffee) >>> 0 : seasonSeed(c), { ...data.progress.lineups, ...(c.lineup ? { [c.selectedTeamId!]: c.lineup } : {}) });
  for (const command of data.progress.commands) {
    while ((live.games[0]?.minute ?? 90) < command.minute) live = stepRound(live);
    live = applyCommand(live, c.selectedTeamId!, command);
  }
  while ((live.games[0]?.minute ?? 90) < data.progress.minute) live = stepRound(live);
  return live;
}
function applyCommand(live: RoundSession, teamId: string, command: MatchCommand): RoundSession {
  let found = false;
  const games = live.games.map((game) => {
    if (game.home.team.id !== teamId && game.away.team.id !== teamId) return game;
    found = true;
    return command.type === 'style' ? changeMatchStyle(game, teamId, command.style) : substitutePlayer(game, teamId, command.outId, command.inId);
  });
  if (!found) throw new Error('Seu clube não está nesta partida.');
  return { ...live, games };
}

export const useGameStore = create<GameData & GameActions>((set, get) => {
  const fail = (error: unknown) => set({ error: error instanceof Error ? error.message : 'Não foi possível concluir a ação.' });
  const autoSave = () => get().saveGame(0);
  const ensureIdle = (requireClub = true) => {
    if (get().live || get().isAdvancing) throw new Error('Conclua a partida antes de alterar a carreira.');
    if (requireClub && get().systems.board.status === 'dismissed') throw new Error('Escolha um novo emprego antes de gerenciar um clube.');
  };
  const currentLineup = () => {
    const s = get();
    const team = s.league!.teams.find((t) => t.id === s.selectedTeamId)!;
    try { return s.lineup ?? autoPickLineup(team); }
    catch (error) { if (error instanceof LineupUnavailableError) return null; throw error; }
  };
  const commitCareer = (next: Career, competition: Competition, round: number) => {
    const pending = next.league.schedule.find((r) => r.matches.some((m) => m.status !== 'finished'));
    set({ ...next, live: null, commands: [], currentRound: pending?.round ?? next.league.schedule.length, lastRound: competition === 'league' ? round : get().lastRound,
      lastCompetition: competition, lastCupRound: competition === 'cup' ? round : get().lastCupRound, paused: true, isAdvancing: false, error: null });
    autoSave();
  };
  const trade = (operation: (c: Career) => Career, message: string) => {
    try {
      ensureIdle();
      const before = careerOf(get());
      let next = operation(before);
      const previousIds = new Set(before.league.teams.find((t) => t.id === before.selectedTeamId)!.squad.map((p) => p.id));
      next = repairLineup(next, next.lineup ?? before.lineup);
      if (next.lineup) {
        const newcomers = next.league.teams.find((t) => t.id === next.selectedTeamId)!.squad.filter((p) => !previousIds.has(p.id) && !p.injury && !p.discipline.suspendedMatches && !next.lineup!.starterIds.includes(p.id));
        next.lineup = { ...next.lineup, substituteIds: [...new Set([...next.lineup.substituteIds, ...newcomers.map((p) => p.id)])] };
      }
      set({ ...next, error: null, message }); autoSave();
    }
    catch (error) { fail(error); }
  };
  const restore = (raw: string) => {
    ensureIdle(false);
    const data = decodeSave(raw);
    const live = replay(data);
    resetUiPreferences();
    const pending = data.career.league.schedule.find((r) => r.matches.some((m) => m.status !== 'finished'));
    set({ ...initialGameData, ...data.career, currentRound: pending?.round ?? 38, live, commands: data.progress?.commands ?? [], lastRound: data.lastRound,
      liveCompetition: data.progress?.competition ?? 'league', lastCompetition: data.lastCompetition ?? 'league', lastCupRound: data.lastCupRound ?? null,
      screen: live ? 'match' : 'dashboard', paused: true, message: 'Carreira carregada.', saveStatus: 'Save carregado' });
  };
  return {
    ...initialGameData,
    startImportedGame: (career) => {
      try {
        if (get().live || get().isAdvancing) throw new Error('Conclua a partida antes de iniciar outra carreira.');
        if (!career.source || career.selectedTeamId !== null) throw new Error('Base inicial de carreira inválida.');
        resetUiPreferences();
        set({ ...initialGameData, ...structuredClone(career), screen: 'club-selection' });
      } catch (error) { fail(error); }
    },
    startNewGame: (providedSeed) => {
      try {
        if (get().live) throw new Error('Conclua a partida antes de iniciar outra carreira.');
        const seed = providedSeed ?? crypto.getRandomValues(new Uint32Array(1))[0];
        resetUiPreferences();
        set({ ...initialGameData, ...createCareer(seed), screen: 'club-selection' });
      } catch (error) { fail(error); }
    },
    selectTeam: (teamId) => {
      if (get().screen !== 'club-selection') return;
      const { league, otherLeague } = get();
      if (!league || !otherLeague) return;
      const own = [league, otherLeague].find((l) => l.teams.some((t) => t.id === teamId));
      if (!own) return;
      const team = own.teams.find((t) => t.id === teamId)!;
      set({ selectedTeamId: teamId, league: own, otherLeague: own === league ? otherLeague : league, screen: 'dashboard', error: null,
        finances: [{ teamId, season: 1, round: 0, description: 'Saldo inicial', amount: 0, balance: team.budget }], news: [`Você assumiu o comando de ${team.name}.`] });
      const c = careerOf(get());
      const systems = createSystems(c);
      set({ ...refreshOffers({ ...c, systems: { ...systems, cup: c.systems.cup } }, 1) });
      autoSave();
    },
    navigate: (screen) => {
      if (screen !== 'menu' && screen !== 'data-import' && (!get().league || !get().selectedTeamId)) return;
      set({ screen: get().live && screen !== 'menu' ? 'match' : screen, error: null, message: null });
    },
    autoLineup: () => {
      try { ensureIdle(); set({ lineup: autoPickLineup(get().league!.teams.find((t) => t.id === get().selectedTeamId)!, undefined, true), error: null }); autoSave(); }
      catch (error) { fail(error); }
    },
    updateTactic: (patch) => {
      try {
        ensureIdle();
        const c = careerOf(get());
        const team = c.league.teams.find((t) => t.id === c.selectedTeamId)!;
        const tactic = { ...team.defaultTactic, ...patch };
        formationSlots(tactic.formation);
        if (!['defensive', 'balanced', 'attacking'].includes(tactic.style) || !['low', 'medium', 'high'].includes(tactic.markingIntensity)) throw new Error('Tática inválida.');
        const updated = { ...team, defaultTactic: tactic };
        let lineup = get().lineup;
        if (patch.formation && patch.formation !== team.defaultTactic.formation) lineup = autoPickLineup(updated);
        else lineup = { ...(lineup ?? autoPickLineup(updated)), tactic };
        set({ league: { ...c.league, teams: c.league.teams.map((t) => t.id === team.id ? updated : t) }, lineup, error: null });
        autoSave();
      } catch (error) { fail(error); }
    },
    pickPlayer: (slot, playerId) => {
      try {
        ensureIdle();
        const lineup = structuredClone(currentLineup());
        if (!lineup) throw new Error('Não há jogadores suficientes para esta formação.');
        const previousEligible = new Set([...lineup.starterIds, ...lineup.substituteIds]);
        const team = get().league!.teams.find((t) => t.id === get().selectedTeamId)!;
        const slots = formationSlots(lineup.tactic.formation);
        const player = team.squad.find((p) => p.id === playerId);
        if (!player || !slots[slot] || player.injury || player.discipline.suspendedMatches || (player.primaryPosition !== slots[slot] && player.secondaryPosition !== slots[slot])) throw new Error('Jogador indisponível para essa posição.');
        const previous = lineup.starterIds.indexOf(playerId);
        if (previous !== -1 && previous !== slot) {
          const displaced = team.squad.find((p) => p.id === lineup.starterIds[slot])!;
          if (displaced.primaryPosition !== slots[previous] && displaced.secondaryPosition !== slots[previous]) throw new Error('Esse jogador já é titular em outra posição.');
          lineup.starterIds[previous] = displaced.id;
        }
        lineup.starterIds[slot] = playerId;
        lineup.positions = Object.fromEntries(lineup.starterIds.map((id, i) => [id, slots[i]]));
        lineup.substituteIds = team.squad.filter((p) => previousEligible.has(p.id) && !lineup.starterIds.includes(p.id) && !p.injury && !p.discipline.suspendedMatches).map((p) => p.id);
        validateLineup(team, lineup);
        set({ lineup, error: null }); autoSave();
      } catch (error) { fail(error); }
    },
    toggleReserve: (playerId) => {
      try {
        ensureIdle();
        const lineup = structuredClone(currentLineup());
        if (!lineup) throw new Error('Escale os titulares antes de escolher os reservas.');
        const team = get().league!.teams.find((t) => t.id === get().selectedTeamId)!;
        const player = team.squad.find((p) => p.id === playerId);
        if (!player || player.injury || player.discipline.suspendedMatches || lineup.starterIds.includes(playerId)) throw new Error('Jogador indisponível para o banco.');
        lineup.substituteIds = lineup.substituteIds.includes(playerId) ? lineup.substituteIds.filter((id) => id !== playerId) : [...lineup.substituteIds, playerId];
        validateLineup(team, lineup);
        set({ lineup, error: null }); autoSave();
      } catch (error) { fail(error); }
    },
    advanceRound: async () => {
      const { league, selectedTeamId, isAdvancing, live } = get();
      if (!league || !selectedTeamId || isAdvancing || live || seasonComplete(careerOf(get()))) return;
      set({ isAdvancing: true, error: null });
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      if (get().league !== league) return;
      try {
        const c = careerOf(get());
        const lineup = currentLineup();
        const result = simulateCareerEvent({ ...c, lineup }, lineup);
        commitCareer(result.career, result.competition, result.round);
      } catch (error) { set({ isAdvancing: false }); fail(error); }
    },
    kickOff: () => {
      try {
        ensureIdle();
        const c = careerOf(get());
        const lineup = currentLineup();
        const { session: live, competition } = startCareerEvent(c, lineup);
        set({ lineup, live, liveCompetition: competition, screen: 'match', paused: false, commands: [], error: null, message: null });
        autoSave();
      } catch (error) { fail(error); }
    },
    tickMatch: () => {
      const { live, league, paused } = get();
      if (!live || !league || paused) return;
      try {
        const next = stepRound(live);
        if (next.games.every((g) => g.minute >= g.config.minutes)) commitCareer(finishCareerEvent(careerOf(get()), get().liveCompetition, next), get().liveCompetition, next.round);
        else { set({ live: next }); autoSave(); }
      } catch (error) { set({ paused: true }); fail(error); }
    },
    finishMatchNow: () => {
      const { live, league } = get();
      if (!live || !league) return;
      try {
        const finished = { ...live, games: live.games.map(finishMatch) };
        commitCareer(finishCareerEvent(careerOf(get()), get().liveCompetition, finished), get().liveCompetition, finished.round);
      } catch (error) { fail(error); }
    },
    togglePause: () => set({ paused: !get().paused }),
    setSpeed: (speed) => { if ([1, 2, 5].includes(speed)) set({ speed }); },
    changeStyle: (style) => {
      try {
        const { live, selectedTeamId } = get();
        if (!live || !selectedTeamId) return;
        const command: MatchCommand = { minute: live.games[0]?.minute ?? 0, type: 'style', style };
        set({ live: applyCommand(live, selectedTeamId, command), commands: [...get().commands, command], error: null }); autoSave();
      } catch (error) { fail(error); }
    },
    substitute: (outId, inId) => {
      try {
        const { live, selectedTeamId } = get();
        if (!live || !selectedTeamId) return;
        const command: MatchCommand = { minute: live.games[0]?.minute ?? 0, type: 'substitution', outId, inId };
        set({ live: applyCommand(live, selectedTeamId, command), commands: [...get().commands, command], error: null }); autoSave();
      } catch (error) { fail(error); }
    },
    buy: (id, offer, salary, years) => trade((c) => buyPlayer(c, id, offer, salary, years, get().currentRound), 'Contratação concluída.'),
    sell: (id) => trade((c) => sellPlayer(c, id, get().currentRound), 'Venda concluída. Revise sua escalação.'),
    renew: (id) => trade((c) => renewContract(c, id, get().currentRound), 'Contrato renovado por três anos.'),
    respondOffer: (id, accept) => trade((c) => respondToOffer(c, id, accept, get().currentRound), accept ? 'Proposta aceita. Jogador transferido.' : 'Proposta recusada.'),
    assessYouth: (id) => trade((c) => assessProspect(c, id, get().currentRound), 'Avaliação concluída.'),
    promoteYouth: (id) => trade((c) => promoteProspect(c, id, get().currentRound), 'Jovem promovido ao elenco profissional.'),
    releaseYouth: (id) => trade((c) => releaseProspect(c, id), 'Jovem dispensado desta seleção da base.'),
    acceptJob: (id) => {
      try {
        ensureIdle(false);
        const next = resolveBackgroundCup(takeJob(careerOf(get()), id));
        set({ ...next, screen: 'dashboard', lastRound: null, lastCupRound: null, error: null, message: 'Novo trabalho iniciado. Confira o elenco e a meta da diretoria.' }); autoSave();
      } catch (error) { fail(error); }
    },
    beginNextSeason: () => {
      try {
        ensureIdle();
        const next = nextSeason(careerOf(get()));
        set({ ...refreshOffers(next, 1), currentRound: 1, lastRound: null, lastCupRound: null, lastCompetition: 'league', screen: 'dashboard', error: null, message: 'Nova temporada iniciada. Confira contratos, elenco, base e calendário.' });
        autoSave();
      } catch (error) { fail(error); }
    },
    saveGame: (slot = 0) => {
      try {
        if (![0, 1, 2, 3].includes(slot)) throw new Error('Slot inválido.');
        if (typeof localStorage === 'undefined') return;
        const raw = get().exportGame();
        if (!raw) return;
        localStorage.setItem(saveKey(slot), encodeStoredSave(raw));
        set({ saveStatus: slot ? `Salvo no slot ${slot}` : 'Salvo automaticamente' });
      } catch { set({ saveStatus: 'Falha ao salvar', error: 'Não foi possível gravar o save. Exporte uma cópia do progresso.' }); }
    },
    loadGame: (slot = 0) => {
      try {
        const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(saveKey(slot));
        if (!raw) throw new Error('Nenhum save neste slot.');
        restore(decodeStoredSave(raw));
      } catch (error) { fail(error); }
    },
    exportGame: () => {
      try {
        const s = get();
        const lineups = s.live ? Object.fromEntries([...s.live.games.flatMap((g) => [[g.home.team.id, g.initialHomeLineup], [g.away.team.id, g.initialAwayLineup]]), ...s.live.forfeits.flatMap((m) => [[m.homeTeamId, m.homeLineup], [m.awayTeamId, m.awayLineup]])].filter((entry) => entry[1] !== null)) : undefined;
        return encodeSave({ career: careerOf(s), lastRound: s.lastRound, lastCompetition: s.lastCompetition, lastCupRound: s.lastCupRound,
          progress: s.live ? { minute: s.live.games[0]?.minute ?? 0, commands: s.commands, competition: s.liveCompetition, lineups } : null });
      } catch (error) { fail(error); return null; }
    },
    importGame: (raw) => { try { restore(raw); autoSave(); } catch (error) { fail(error); } },
  };
});
