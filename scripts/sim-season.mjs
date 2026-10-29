import { parseArgs } from 'node:util';
import { generateLeague } from '../src/engine/generators/league.ts';
import { simulateSeason } from '../src/engine/league/season.ts';

const { values } = parseArgs({ options: { seasons: { type: 'string', default: '1' }, seed: { type: 'string', default: '2026' } } });
const count = Number(values.seasons);
const seed = Number(values.seed);
if (!Number.isInteger(count) || count < 1 || count > 1000) throw new Error('--seasons deve ser um inteiro entre 1 e 1000.');
if (!Number.isInteger(seed) || seed < 0 || seed > 0xffff_ffff) throw new Error('--seed deve ser um inteiro de 32 bits sem sinal.');
const league = generateLeague(seed, 20);
const bands = new Map(league.teams.map((team) => [team.id, { Clube: team.name, Campeão: 0, G4: 0, Rebaixado: 0 }]));
let result;
for (let index = 0; index < count; index++) {
  result = simulateSeason(league, (seed + index) >>> 0);
  for (const standing of result.standings) {
    const band = bands.get(standing.teamId);
    if (standing.position === 1) band.Campeão++;
    if (standing.qualified) band.G4++;
    if (standing.relegated) band.Rebaixado++;
  }
}
const teams = new Map(league.teams.map((team) => [team.id, team]));
console.log(`${league.name} — temporada ${count}/${count}, seed ${(seed + count - 1) >>> 0}`);
console.table(result.standings.map((row) => ({
  Pos: row.position, Clube: teams.get(row.teamId).name,
  P: row.points, J: row.played, V: row.wins, E: row.draws, D: row.losses,
  GP: row.goalsFor, GC: row.goalsAgainst, SG: row.goalDifference,
  Situação: row.relegated ? 'Rebaixado' : row.qualified ? 'Classificado' : '',
})));
console.log('5 artilheiros');
console.table(result.topScorers.slice(0, 5).map((scorer) => ({ Jogador: scorer.playerName, Clube: scorer.teamName, Gols: scorer.goals })));
if (count > 1) {
  console.log(`Faixas em ${count} temporadas independentes com os mesmos elencos (G4 inclui o campeão)`);
  console.table([...bands.values()].sort((a, b) => b.Campeão - a.Campeão || b.G4 - a.G4));
}
