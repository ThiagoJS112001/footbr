import type { CatalogSnapshot, CatalogClub, SimulationConfig } from '../../data/catalog';
import { validateSimulation } from '../../data/catalog';
import type { PlayerPosition, Team } from '../models';
import { generatePlayer, calculateOverall } from '../generators/player';
import { createRng, randomInt } from '../generators/random';
import { autoPickLineup, calculateStandings, generateSchedule } from '../league';
import { createCareer, payroll, playerValue } from './career';
import type { Career } from './career';
import { createSystems } from './bootstrap';

const positions: PlayerPosition[] = ['GK', 'LB', 'CB', 'CB', 'RB', 'LW', 'CM', 'CM', 'RW', 'ST', 'ST'];
function mappedPosition(raw: string | null, counts: Map<string, number>): PlayerPosition {
  if (positions.includes(raw as PlayerPosition) || ['DM', 'AM'].includes(raw ?? '')) return raw as PlayerPosition;
  const options: PlayerPosition[] = raw === 'Goalkeeper' ? ['GK'] : raw === 'Defender' ? ['LB', 'CB', 'CB', 'RB'] : raw === 'Midfielder' ? ['LW', 'CM', 'CM', 'RW', 'DM', 'AM'] : raw === 'Attacker' ? ['ST', 'ST', 'LW', 'RW'] : positions;
  const category = raw ?? 'unknown';
  const i = counts.get(category) ?? 0; counts.set(category, i + 1);
  return options[i % options.length];
}
function hash(text: string, seed: number) { let value = seed; for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619) >>> 0; return value; }
function importedTeam(club: CatalogClub, base: Team, snapshot: CatalogSnapshot, seed: number, config: SimulationConfig, year: number): Team {
  const id = `import-${snapshot.id}-${club.id}`;
  const rng = createRng(hash(club.id, seed));
  const counts = new Map<string, number>();
  const squad = club.players.filter((p) => !snapshot.assignments[p.id] || snapshot.assignments[p.id] === club.id).map((facts) => {
    const primaryPosition = mappedPosition(facts.position, counts);
    const generated = generatePlayer(rng, primaryPosition, randomInt(rng, config.minOverall, config.maxOverall));
    const target = Math.max(config.minOverall, Math.min(config.maxOverall, generated.overall));
    const attributes = Object.fromEntries(Object.entries(generated.attributes).map(([key, value]) => [key, Math.max(1, Math.min(99, value + target - generated.overall))])) as unknown as typeof generated.attributes;
    const birth = facts.birthDate ? new Date(`${facts.birthDate}T00:00:00Z`) : null;
    const derivedAge = birth && Number.isFinite(birth.getTime()) ? year - birth.getUTCFullYear() - (birth.getUTCMonth() > 0 || birth.getUTCDate() > 12 ? 1 : 0) : null;
    const factAge = derivedAge ?? (club.rosterKind !== 'season-participants' ? facts.age : null);
    const age = factAge !== null && factAge >= 16 && factAge <= 60 ? factAge : config.unknownAge;
    const { id: catalogId, ...identity } = facts;
    const player = { ...generated, id: `${id}-${catalogId}`, currentTeamId: id, name: facts.name, age, nationality: facts.nationality ?? 'Não informada', attributes,
      overall: calculateOverall(attributes, primaryPosition), fitness: config.fitness, morale: config.morale,
      identity: { catalogId, provider: club.provider, facts: structuredClone(identity), observedAt: club.updatedAt, simulatedFields: ['attributes', 'overall', 'potential', 'fitness', 'morale', 'contract', 'marketValue', 'primaryPosition', 'secondaryPosition', ...(factAge === null || factAge < 16 || factAge > 60 || derivedAge !== null ? ['age'] : [])] } };
    player.marketValue = playerValue(player);
    return { ...player, potential: Math.min(99, player.overall + config.potentialBonus) };
  });
  if (squad.length < 18 || squad.length > 60) throw new Error(`${club.name}: são necessários de 18 a 60 jogadores únicos para iniciar uma carreira. Complete a importação ou revise os vínculos históricos.`);
  const { id: catalogId, players: _players, provider, rosterKind: _kind, updatedAt, ...facts } = club;
  const team: Team = { ...base, id, name: club.name, city: club.city ?? 'Cidade não informada', squad,
    stadium: { ...base.stadium, capacity: club.capacity && club.capacity > 0 ? club.capacity : base.stadium.capacity },
    identity: { catalogId, provider, facts: structuredClone(facts), observedAt: updatedAt, simulatedFields: ['budget', 'payroll', 'reputation', 'ticketPrice', 'defaultTactic', ...(!club.capacity ? ['capacity'] : [])] } };
  team.payroll = payroll(team);
  team.budget = team.payroll * 12;
  try { autoPickLineup(team); } catch { throw new Error(`${club.name}: o elenco não cobre o 4-4-2 inicial. Revise as posições disponíveis; jogadores reais não serão inventados.`); }
  return team;
}

/** Cópia profunda e única. O motor nunca recebe referências mutáveis do catálogo. */
export function createImportedCareer(snapshot: CatalogSnapshot, seed: number): Career {
  validateSimulation(snapshot.simulation);
  const base = createCareer(seed);
  const all = snapshot.seasons.flatMap((s) => s.clubs);
  if (new Set(snapshot.seasons.map((s) => s.year)).size !== 1) throw new Error('Escolha temporadas do mesmo ano para as duas divisões.');
  if (!all.length || new Set(all.map((c) => c.id)).size !== all.length) throw new Error('Selecione temporadas sem repetir clubes entre as divisões.');
  const memberships = new Map<string, string[]>();
  for (const club of all) for (const p of club.players) memberships.set(p.id, [...(memberships.get(p.id) ?? []), club.id]);
  for (const [id, clubs] of memberships) if (clubs.length > 1 && !clubs.includes(snapshot.assignments[id])) throw new Error(`Resolva o clube inicial de ${all.flatMap((c) => c.players).find((p) => p.id === id)!.name}. A API registra participações em mais de um elenco.`);
  for (const league of [base.league, base.otherLeague]) {
    const division = league.teams[0].division;
    const seasons = snapshot.seasons.filter((s) => s.division === division);
    const clubs = seasons.flatMap((s) => s.clubs);
    if (clubs.length > 20 || seasons.length > 1) throw new Error('Selecione uma temporada por divisão, com até 20 clubes.');
    league.teams = league.teams.map((team, i) => clubs[i] ? importedTeam(clubs[i], team, snapshot, seed, snapshot.simulation, seasons[0].year) : team);
    if (seasons[0]) league.name = `${seasons[0].competition.name} · Base ${seasons[0].year}${clubs.length < 20 ? ' + clubes fictícios' : ''}`;
    league.schedule = generateSchedule(league.teams.map((t) => t.id));
    league.standings = calculateStandings(league, seed);
  }
  base.systems = createSystems(base);
  base.source = { id: snapshot.id, snapshotId: snapshot.id, createdAt: snapshot.createdAt, providers: [...new Set(snapshot.seasons.map((s) => s.provider))],
    seasons: snapshot.seasons.map((s) => ({ name: s.competition.name, year: s.year, division: s.division })), simulation: structuredClone(snapshot.simulation), importedClubs: all.length, fictionalClubs: 40 - all.length };
  return base;
}
