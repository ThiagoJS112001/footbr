import type { Match } from '../models';

export function matchInsights(match: Match, teamId: string): string[] {
  const home = match.homeTeamId === teamId;
  const own = home ? match.homeLineup : match.awayLineup;
  const notes: string[] = [];
  if (match.forfeitTeamIds?.length) return ['Resultado por W.O.: não houve atuação dos jogadores nem crédito de gols à artilharia.', ...(match.forfeitTeamIds.length === 2 ? ['Os dois clubes ficaram sem escalação elegível; a classificação foi decidida por sorteio administrativo.'] : [])];
  if (own) notes.push(`Formação inicial ${own.tactic.formation}. ${own.tactic.style === 'attacking' ? 'Postura ofensiva: mais criação e maior exposição defensiva.' : own.tactic.style === 'defensive' ? 'Postura defensiva: menor exposição e menor volume de ataque.' : 'Postura equilibrada: criação e proteção sem modificadores extremos.'}`);
  if (own?.tactic.markingIntensity === 'high') notes.push('Marcação intensa reforça a defesa e aumenta o risco de cartões.');
  if (match.statistics) {
    const a = home ? match.statistics.home : match.statistics.away;
    const b = home ? match.statistics.away : match.statistics.home;
    notes.push(`Seu time finalizou ${a.shots} vezes (${a.shotsOnTarget} no alvo) contra ${b.shots} do adversário. xG: ${a.xG.toFixed(2)} a ${b.xG.toFixed(2)}.`);
  }
  const reds = match.events.filter((e) => e.type === 'card' && e.card === 'red');
  for (const event of reds) notes.push(`${event.teamId === teamId ? 'Seu time' : 'O adversário'} perdeu um jogador por expulsão aos ${event.minute}′; ele deixou de contribuir nas jogadas seguintes.`);
  const changes = match.styleChanges?.filter((e) => e.teamId === teamId) ?? [];
  for (const change of changes.slice(-3)) notes.push(`Aos ${change.minute}′, você mudou para postura ${change.style === 'attacking' ? 'ofensiva' : change.style === 'defensive' ? 'defensiva' : 'equilibrada'}. O ajuste passou a valer no minuto seguinte.`);
  const substitutions = match.events.filter((e) => e.type === 'substitution' && e.teamId === teamId);
  if (substitutions.length) {
    const minute = substitutions[0].minute;
    const firstSubstitution = match.events.indexOf(substitutions[0]);
    const after = match.events.slice(firstSubstitution + 1).filter((e) => e.type === 'goal');
    notes.push(`Após a primeira substituição (${minute}′), houve ${after.filter((e) => e.teamId === teamId).length} gol(s) a favor e ${after.filter((e) => e.teamId !== teamId).length} contra. Esse é o recorte do placar, sem atribuir os gols à troca.`);
  }
  if (match.penalties) notes.push(`O empate foi decidido nos pênaltis: ${match.penalties.home}–${match.penalties.away}. Essas cobranças não entram na artilharia.`);
  return notes.slice(0, 9);
}
