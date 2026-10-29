import { generateLeague } from '../src/engine/generators/league.ts';

const seed = Number(process.argv[2] ?? 2026);
const numTeams = Number(process.argv[3] ?? 20);
const league = generateLeague(seed, numTeams);
console.log(`${league.name} — seed ${seed}`);
console.table(league.teams.map((team) => ({
  Clube: team.name,
  Reputação: team.reputation,
  'Overall médio': (team.squad.reduce((sum, player) => sum + player.overall, 0) / team.squad.length).toFixed(1),
})));
