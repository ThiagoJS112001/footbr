import type { Match } from '../models';

function shotsByMinute(match: Match, teamId: string): number[] | null {
  const total = (match.homeTeamId === teamId ? match.statistics?.home : match.statistics?.away)?.shots;
  if (total === undefined || !match.commentary) return null;
  const shots = [
    ...match.events.filter((event) => event.teamId === teamId && event.type === 'goal'),
    ...match.commentary.filter((event) => event.teamId === teamId && event.kind !== 'pressure'),
  ].map((event) => event.minute);
  return shots.length === total ? shots : null;
}

export function tacticalWindows(match: Match, teamId: string) {
  const own = shotsByMinute(match, teamId);
  const against = shotsByMinute(match, match.homeTeamId === teamId ? match.awayTeamId : match.homeTeamId);
  if (!own || !against) return [];
  const decisions = new Map<number, Set<string>>();
  const add = (minute: number, label: string) => {
    const labels = decisions.get(minute) ?? new Set<string>();
    labels.add(label);
    decisions.set(minute, labels);
  };
  for (const change of match.styleChanges ?? []) {
    if (change.teamId === teamId) add(change.minute, 'Mudança de postura');
  }
  for (const event of match.events) {
    if (event.teamId === teamId && event.type === 'substitution') add(event.minute, 'Substituição');
  }
  return [...decisions].sort(([a], [b]) => a - b).flatMap(([minute, labels]) => {
    // As ordens do jogador valem a partir do minuto seguinte.
    const length = Math.min(15, minute, 90 - minute);
    if (length < 1) return [];
    const count = (shots: number[], start: number) => shots.filter((shot) => shot > start && shot <= start + length).length;
    return [{ minute, length, label: [...labels].join(' e '), before: [count(own, minute - length), count(against, minute - length)], after: [count(own, minute), count(against, minute)] }];
  });
}

export function opponentReport(matches: Match[], teamId: string): string[] {
  if (!matches.length) return [];
  const lineups = matches.flatMap((match) => {
    const lineup = match.homeTeamId === teamId ? match.homeLineup : match.awayLineup;
    return lineup ? [lineup] : [];
  });
  const formations = new Map<string, number>();
  for (const { tactic } of lineups) formations.set(tactic.formation, (formations.get(tactic.formation) ?? 0) + 1);
  const common = [...formations].sort(([, a], [, b]) => b - a)[0];
  const notes = common ? [`Formação inicial ${common[0]} em ${common[1]} de ${lineups.length} jogo(s) com escalação registrada.`] : [];
  if (lineups.length) {
    const intense = lineups.filter(({ tactic }) => tactic.markingIntensity === 'high').length;
    notes.push(`Marcação intensa no início em ${intense} de ${lineups.length} jogo(s).`);
  }
  const shotLogs = matches.flatMap((match) => {
    const shots = shotsByMinute(match, teamId);
    return shots ? [shots] : [];
  });
  if (shotLogs.length) {
    const shots = shotLogs.flat();
    const first = shots.filter((minute) => minute <= 45).length;
    notes.push(`Em ${shotLogs.length} jogo(s) com lances registrados, finalizou ${first} vez(es) no primeiro tempo e ${shots.length - first} no segundo.`);
  }
  return notes;
}

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
  const priority = (note: string) => note.includes('perdeu um jogador') ? 0 : note.startsWith('Seu time finalizou') ? 1 : note.startsWith('Aos ') ? 2 : note.startsWith('O empate') ? 3 : 4;
  return notes.sort((a, b) => priority(a) - priority(b)).slice(0, 9);
}
