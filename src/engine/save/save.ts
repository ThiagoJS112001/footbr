import type { Career } from '../career/career';
import type { PlayingStyle } from '../models/Tactic';
import { calculateStandings, generateSchedule } from '../league';
import { autoPickLineup, LineupUnavailableError, validateLineup } from '../league/lineup';
import type { Lineup } from '../models';
import type { Competition } from '../career/progression';
import { createSystems } from '../career/bootstrap';
import { careerConfig } from '../career/config';

export type MatchCommand = { minute: number } & (
  { type: 'style'; style: PlayingStyle } | { type: 'substitution'; outId: string; inId: string }
);
export interface SaveData {
  career: Career;
  progress: { minute: number; commands: MatchCommand[]; competition?: Competition; lineups?: Record<string, Lineup> } | null;
  lastRound: number | null;
  lastCompetition?: Competition;
  lastCupRound?: number | null;
}

type Check = (value: unknown) => boolean;
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text: Check = (v) => typeof v === 'string' && v.length <= 1000;
const number: Check = (v) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 1e15;
const integer: Check = (v) => number(v) && Number.isInteger(v);
const range = (min: number, max: number): Check => (v) => integer(v) && (v as number) >= min && (v as number) <= max;
const bounded = (min: number, max: number): Check => (v) => number(v) && (v as number) >= min && (v as number) <= max;
const bool: Check = (v) => typeof v === 'boolean';
const nullable = (check: Check): Check => (v) => v === null || check(v);
const optional = (check: Check): Check => (v) => v === undefined || check(v);
const list = (check: Check, max = 5000): Check => (v) => Array.isArray(v) && v.length <= max && v.every(check);
const oneOf = (...values: unknown[]): Check => (v) => values.includes(v);
const shape = (fields: Record<string, Check>): Check => (v) => object(v) && Object.entries(fields).every(([key, check]) => check(v[key]));
const position = oneOf('GK', 'CB', 'LB', 'RB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST');
const tactic = shape({ formation: oneOf('4-4-2', '4-3-3', '4-2-3-1', '3-5-2', '5-3-2'), style: oneOf('defensive', 'balanced', 'attacking'), markingIntensity: oneOf('low', 'medium', 'high') });
const lineup = shape({ starterIds: list(text, 11), substituteIds: list(text, 35), tactic,
  positions: (v) => v === undefined || object(v) && Object.entries(v).every(([id, p]) => text(id) && position(p)) });
const attributes = shape(Object.fromEntries(['attack', 'midfield', 'defense', 'goalkeeping', 'speed', 'passing', 'finishing', 'stamina'].map((key) => [key, range(1, 99)])));
const player = shape({ id: text, name: text, age: range(16, 60), nationality: text, primaryPosition: position, secondaryPosition: nullable(position), attributes,
  overall: range(1, 99), fitness: bounded(0, 100), morale: range(0, 100), injury: nullable(shape({ description: text, remainingDays: range(1, 10000) })),
  discipline: shape({ yellowCards: range(0, 100), suspendedMatches: range(0, 100) }), contract: nullable(shape({ salary: range(0, 1e10), yearsRemaining: range(1, 5) })),
  marketValue: range(0, 1e12), currentTeamId: nullable(text), potential: optional(range(1, 99)) });
const team = shape({ id: text, name: text, city: text, division: oneOf(1, 2), squad: list(player, 60), budget: number, payroll: number, reputation: range(0, 100),
  stadium: shape({ capacity: range(1, 1000000), ticketPrice: range(0, 100000) }), defaultTactic: tactic });
const event: Check = (v) => object(v) && range(0, 90)(v.minute) && text(v.teamId) && (
  v.type === 'goal' && text(v.playerId) && nullable(text)(v.assistPlayerId) && (v.playerName === undefined || text(v.playerName))
  || v.type === 'card' && text(v.playerId) && oneOf('yellow', 'red')(v.card)
  || v.type === 'injury' && text(v.playerId) && text(v.description)
  || v.type === 'substitution' && text(v.playerOutId) && text(v.playerInId));
const stats = shape({ possession: number, shots: range(0, 1000), shotsOnTarget: range(0, 1000), corners: range(0, 1000), xG: number });
const match = shape({ id: text, homeTeamId: text, awayTeamId: text, status: oneOf('scheduled', 'finished'), homeLineup: nullable(lineup), awayLineup: nullable(lineup),
  score: nullable(shape({ home: range(0, 1000), away: range(0, 1000) })), events: list(event, 1000), statistics: nullable(shape({ home: stats, away: stats })),
  penalties: optional(shape({ home: range(0, 1000), away: range(0, 1000) })), winnerTeamId: optional(text), forfeitTeamIds: optional(list(text, 2)),
  styleChanges: optional(list(shape({ minute: range(0, 89), teamId: text, style: oneOf('defensive', 'balanced', 'attacking') }), 1000)) });
const standing = shape({ teamId: text, played: integer, wins: integer, draws: integer, losses: integer, goalsFor: integer, goalsAgainst: integer, goalDifference: integer,
  points: integer, position: integer, qualified: bool, relegated: bool });
const league = shape({ id: text, name: text, teams: list(team, 40), schedule: list(shape({ round: range(1, 100), matches: list(match, 20) }), 100), standings: list(standing, 40),
  rules: shape({ promotionSpots: range(0, 4), qualificationSpots: range(0, 4), relegationSpots: range(0, 4) }) });
const command: Check = (v) => object(v) && range(0, 89)(v.minute) && (v.type === 'style' && oneOf('defensive', 'balanced', 'attacking')(v.style)
  || v.type === 'substitution' && text(v.outId) && text(v.inId));
const career = shape({ league, otherLeague: league, selectedTeamId: text, seed: range(0, 0xffff_ffff), season: range(1, 1000), lineup: nullable(lineup),
  finances: list(shape({ teamId: optional(text), season: integer, round: integer, description: text, amount: number, balance: number }), 300000),
  history: list(shape({ teamId: optional(text), teamName: optional(text), cupChampion: optional(text), season: integer, division: oneOf(1, 2), position: integer, points: integer, champion: text, topScorer: text, promoted: list(text, 4), relegated: list(text, 4) }), 1000),
  freeAgents: list(player, 1000), news: list(text, 20) });
const competition = oneOf('league', 'cup');
const dataCheck = shape({ career, progress: nullable(shape({ minute: range(0, 89), commands: list(command, 1000), competition: optional(competition),
  lineups: optional((v) => object(v) && Object.entries(v).length <= 40 && Object.values(v).every(lineup)) })), lastRound: nullable(range(1, 38)), lastCompetition: optional(competition), lastCupRound: optional(nullable(range(1, 6))) });
const systemsCheck = shape({
  marketRound: range(0, 38),
  offers: list(shape({ id: text, playerId: text, playerName: text, buyerId: text, amount: range(0, 1e12), season: range(1, 1000), round: range(1, 38), expiresRound: range(1, 38), status: oneOf('pending', 'accepted', 'rejected', 'expired') }), 50000),
  transfers: list(shape({ id: text, playerId: text, playerName: text, fromId: nullable(text), fromName: text, toId: text, toName: text, fee: range(0, 1e12), season: range(1, 1000), round: range(0, 38) }), 200000),
  academy: shape({ teamId: nullable(text), season: range(1, 1000), promoted: range(0, 3), prospects: list(shape({ player, assessed: bool, status: oneOf('available', 'promoted', 'released') }), 5) }),
  board: shape({ teamId: nullable(text), targetPosition: range(1, 20), confidence: range(0, 100), status: oneOf('active', 'dismissed'), lastReviewRound: range(0, 38), appointedRound: range(0, 38), startingPoints: optional(range(0, 114)), reviews: list(shape({ round: range(1, 38), confidence: range(0, 100), note: text }), 10) }),
  cup: shape({ id: text, name: text, status: oneOf('active', 'deferred'), byeTeamIds: list(text, 24), championId: nullable(text), rounds: list(shape({ round: range(1, 6), name: text, afterRound: range(1, 38), matches: list(match, 16) }), 6) }),
  playerHistory: list(shape({ playerId: text, playerName: text, teamId: text, teamName: text, season: range(1, 1000), division: oneOf(1, 2), appearances: range(0, 60), minutes: range(0, 5400), goals: range(0, 1000), titles: list(text, 3) }), 2000000),
  clubHistory: list(shape({ teamId: text, teamName: text, season: range(1, 1000), division: oneOf(1, 2), position: range(1, 20), points: range(0, 114), goalsFor: range(0, 1000), goalsAgainst: range(0, 1000), leagueTitle: bool, cupTitle: bool, biggestWin: text, biggestWinMargin: range(0, 1000) }), 40000),
  lastSummary: nullable(shape({ competition, round: range(1, 38), title: text, result: text, teamId: text, position: range(1, 20), positionChange: range(-19, 19), points: range(0, 114), moneyChange: number, absences: list(text, 60), notes: list(text, 10) })),
  jobs: list(shape({ season: range(1, 1000), round: range(0, 38), fromId: text, toId: text }), 10000),
});

export function encodeSave(data: SaveData): string {
  return JSON.stringify({ version: 2, data });
}

/** O arquivo é dado externo: rejeita versões e referências inválidas antes de tocar na carreira. */
export function decodeSave(raw: string): SaveData {
  if (raw.length > 30_000_000) throw new Error('Arquivo de save muito grande.');
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error('O arquivo não contém um save JSON válido.'); }
  if (!object(parsed) || ![1, 2].includes(parsed.version as number) || !dataCheck(parsed.data)) throw new Error('Save inválido ou versão incompatível.');
  const data = parsed.data as unknown as SaveData;
  const c = data.career;
  const allTeams = [...c.league.teams, ...c.otherLeague.teams];
  const ids = allTeams.map((t) => t.id);
  const players = [...allTeams.flatMap((t) => t.squad), ...c.freeAgents];
  if (new Set(ids).size !== 40 || new Set(players.map((p) => p.id)).size !== players.length
    || !c.league.teams.some((t) => t.id === c.selectedTeamId) || c.league.teams[0].division === c.otherLeague.teams[0].division
    || allTeams.some((t) => t.squad.length < 11 || t.squad.some((p) => p.currentTeamId !== t.id))
    || c.freeAgents.some((p) => p.currentTeamId !== null)) throw new Error('Save contém clubes ou jogadores inconsistentes.');
  for (const l of [c.league, c.otherLeague]) {
    if (l.teams.length !== 20 || l.teams.some((t) => t.division !== l.teams[0].division)) throw new Error('Divisão inválida no save.');
    const expected = generateSchedule(l.teams.map((t) => t.id));
    if (l.schedule.length !== expected.length) throw new Error('Calendário inválido no save.');
    let pending = false;
    l.schedule.forEach((r, index) => {
      if (r.round !== index + 1 || r.matches.length !== 10 || r.matches.some((m, i) => m.id !== expected[index].matches[i].id
        || m.homeTeamId !== expected[index].matches[i].homeTeamId || m.awayTeamId !== expected[index].matches[i].awayTeamId
        || (m.status === 'finished') !== (m.score !== null))) throw new Error('Partida inválida no save.');
      const finished = r.matches.every((m) => m.status === 'finished');
      if (pending && finished || !finished && r.matches.some((m) => m.status === 'finished')) throw new Error('Rodadas fora de ordem no save.');
      if (!finished) pending = true;
    });
    l.standings = calculateStandings(l, (c.seed ^ Math.imul(c.season - 1, 0x9e3779b9)) >>> 0);
  }
  const completed = (l: Career['league']) => l.schedule.filter((r) => r.matches.every((m) => m.status === 'finished')).length;
  if (completed(c.league) !== completed(c.otherLeague) || data.lastRound !== null && data.lastRound > completed(c.league)) throw new Error('Divisões fora de sincronia no save.');
  if (data.progress && ((data.progress.competition ?? 'league') === 'league' && completed(c.league) >= 38 || data.progress.commands.some((cmd, i, commands) => cmd.minute > data.progress!.minute || i > 0 && cmd.minute < commands[i - 1].minute))) throw new Error('Partida em andamento inválida.');
  if (parsed.version === 1) {
    c.systems = createSystems(c);
    c.finances = c.finances.map((entry) => ({ ...entry, teamId: entry.teamId ?? c.selectedTeamId! }));
    if (data.progress) {
      const lineups: Record<string, Lineup> = {};
      for (const team of c.league.teams) {
        try { lineups[team.id] = team.id === c.selectedTeamId && c.lineup ? c.lineup : autoPickLineup(team); }
        catch (error) { if (!(error instanceof LineupUnavailableError)) throw error; }
      }
      data.progress = { ...data.progress, competition: 'league', lineups };
    }
  } else if (!systemsCheck(c.systems)) throw new Error('Sistemas de carreira inválidos no save.');
  validateSystems(c, ids, players.map((p) => p.id));
  if (data.lastCupRound && !c.systems.cup.rounds.some((r) => r.round === data.lastCupRound && r.matches.every((m) => m.status === 'finished'))) throw new Error('Última partida de copa inválida.');
  if (data.lastCompetition === 'cup' && !data.lastCupRound) throw new Error('Resultado de copa ausente.');
  if (data.progress?.lineups) for (const [id, savedLineup] of Object.entries(data.progress.lineups)) {
    const team = allTeams.find((t) => t.id === id);
    if (!team) throw new Error('Escalação de clube inexistente no save.');
    validateLineup(team, savedLineup);
  }
  return data;
}

function validateSystems(c: Career, ids: string[], playerIds: string[]): void {
  const s = c.systems;
  const club = (id: string | null) => id !== null && ids.includes(id);
  if (s.board.teamId !== c.selectedTeamId && s.board.teamId !== null || s.academy.teamId !== c.selectedTeamId && s.academy.teamId !== null
    || s.academy.season !== c.season || s.marketRound > Math.min(38, completed(c.league) + 1)) throw new Error('Gestão de clube inconsistente no save.');
  if (new Set(s.offers.map((o) => o.id)).size !== s.offers.length || s.offers.some((o) => !club(o.buyerId) || o.status === 'pending' && (!c.league.teams.find((t) => t.id === c.selectedTeamId)!.squad.some((p) => p.id === o.playerId) || o.buyerId === c.selectedTeamId || o.season !== c.season))) throw new Error('Proposta inválida no save.');
  if (s.transfers.some((t) => !club(t.toId) || t.fromId !== null && !club(t.fromId))) throw new Error('Histórico de transferências inválido.');
  if (new Set(s.transfers.map((t) => t.id)).size !== s.transfers.length || s.offers.some((o) => o.expiresRound < o.round || o.season > c.season)) throw new Error('Movimentações de mercado inconsistentes.');
  if (s.playerHistory.some((r) => !club(r.teamId) || r.season > c.season) || s.clubHistory.some((r) => !club(r.teamId) || r.season > c.season)
    || s.jobs.some((j) => !club(j.fromId) || !club(j.toId) || j.fromId === j.toId || j.season > c.season)
    || s.lastSummary && !club(s.lastSummary.teamId)) throw new Error('Histórico da carreira inconsistente.');
  const prospects = s.academy.prospects;
  if (new Set(prospects.map((p) => p.player.id)).size !== prospects.length || prospects.filter((p) => p.status === 'promoted').length !== s.academy.promoted
    || prospects.some((p) => p.player.currentTeamId !== null || p.player.contract !== null || p.status === 'available' && playerIds.includes(p.player.id))) throw new Error('Categorias de base inconsistentes.');
  const cup = s.cup;
  if (cup.status === 'deferred') { if (cup.rounds.length || cup.championId || cup.byeTeamIds.length) throw new Error('Copa adiada inválida.'); return; }
  if (!cup.rounds.length || cup.byeTeamIds.length !== 24) throw new Error('Sorteio da copa inválido.');
  let expectedIds: string[] | null = null;
  cup.rounds.forEach((r, index) => {
    const participants = r.matches.flatMap((m) => [m.homeTeamId, m.awayTeamId]);
    if (r.round !== index + 1 || r.afterRound !== careerConfig.cupWeeks[index] || r.matches.length !== [8, 16, 8, 4, 2, 1][index]
      || participants.some((id) => !club(id)) || new Set(participants).size !== participants.length
      || r.matches.some((m, i) => m.id !== `${cup.id}-${index}-${i}` || m.homeTeamId === m.awayTeamId || (m.status === 'finished') !== (m.score !== null))) throw new Error('Chave da copa inválida.');
    if (index === 0 && new Set([...participants, ...cup.byeTeamIds]).size !== 40) throw new Error('Participantes da copa inconsistentes.');
    if (expectedIds && participants.some((id, i) => id !== expectedIds![i])) throw new Error('Classificação da copa inconsistente.');
    const finished = r.matches.every((m) => m.status === 'finished');
    if (!finished && (index < cup.rounds.length - 1 || r.matches.some((m) => m.status === 'finished'))) throw new Error('Etapas da copa fora de ordem.');
    for (const m of r.matches) if (m.status === 'finished') {
      const score = m.score!;
      const winner = m.forfeitTeamIds?.length === 2 ? [m.homeTeamId, m.awayTeamId].includes(m.winnerTeamId!) ? m.winnerTeamId : null
        : score.home === score.away ? m.penalties && m.penalties.home !== m.penalties.away ? m.penalties.home > m.penalties.away ? m.homeTeamId : m.awayTeamId : null : score.home > score.away ? m.homeTeamId : m.awayTeamId;
      if (m.winnerTeamId !== winner || !winner) throw new Error('Vencedor da copa inválido.');
    }
    expectedIds = finished ? [...r.matches.map((m) => m.winnerTeamId!), ...(index === 0 ? cup.byeTeamIds : [])] : null;
  });
  const final = cup.rounds[5]?.matches[0];
  if (cup.championId !== (final?.status === 'finished' ? final.winnerTeamId : null)) throw new Error('Campeão da copa inconsistente.');
}

const completed = (league: Career['league']) => league.schedule.filter((r) => r.matches.every((m) => m.status === 'finished')).length;
