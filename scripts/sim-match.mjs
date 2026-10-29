import { generateTeam } from '../src/engine/generators/team.ts';
import { simulateMatch } from '../src/engine/simulation/simulateMatch.ts';

// Escalação de demonstração 4-4-2; a escolha automática por força fica para a IA.
function prepare(seed, reputation) {
  const team = generateTeam(seed, reputation);
  const positions = ['GK', 'CB', 'CB', 'LB', 'RB', 'DM', 'CM', 'CM', 'AM', 'ST', 'ST'];
  const starters = [];
  for (const position of positions) {
    starters.push(team.squad.find((player) => player.primaryPosition === position && !starters.includes(player)));
  }
  return {
    ...team,
    lineup: {
      starterIds: starters.map((player) => player.id),
      substituteIds: team.squad.filter((player) => !starters.includes(player)).map((player) => player.id),
      tactic: { ...team.defaultTactic },
    },
  };
}

const seed = Number(process.argv[2] ?? 2026);
const home = prepare(101, 70);
const away = prepare(202, 50);
const result = simulateMatch(home, away, seed);
const players = new Map([...home.squad, ...away.squad].map((player) => [player.id, player.name]));
const name = (id) => players.get(id) ?? id;
console.log(`${home.name} x ${away.name} — seed ${seed}`);
for (let minute = 1; minute <= 90; minute++) {
  const descriptions = result.events.filter((event) => event.minute === minute).map((event) => {
    const team = event.teamId === home.id ? home.name : away.name;
    switch (event.type) {
      case 'goal': return `GOL: ${name(event.playerId)} (${team})`;
      case 'card': return `Cartão ${event.card === 'red' ? 'vermelho' : 'amarelo'}: ${name(event.playerId)} (${team})`;
      case 'injury': return `Lesão: ${name(event.playerId)} (${team})`;
      case 'substitution': return `Substituição: sai ${name(event.playerOutId)}, entra ${name(event.playerInId)} (${team})`;
    }
  });
  console.log(`${String(minute).padStart(2, '0')}' ${descriptions.join(' | ') || 'Sem eventos.'}`);
}
console.log(`Placar final: ${result.score.home} x ${result.score.away}`);
console.table([
  { Time: home.name, ...result.statistics.home },
  { Time: away.name, ...result.statistics.away },
]);
