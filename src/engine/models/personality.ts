import type { Player, PlayerPosition } from './Player.ts';
import type { Team } from './Team.ts';
import type { PlayingStyle } from './Tactic.ts';

export type PlayerTrait = 'speedster' | 'playmaker' | 'finisher' | 'versatile' | 'leader';
export type ClubProfile = 'academy' | 'traditional' | 'community';
export const traitInfo: Record<PlayerTrait, { label: string; description: string }> = {
  speedster: { label: 'Velocista', description: 'Mais força no ataque, sobretudo em postura defensiva para explorar transições; participa menos da construção.' },
  playmaker: { label: 'Armador', description: 'Reforça o meio e a criação; oferece menos proteção defensiva.' },
  finisher: { label: 'Finalizador', description: 'Ganha 4 pontos de finalização nos chutes; contribui menos no meio-campo.' },
  versatile: { label: 'Polivalente', description: 'Mantém 98% da força na posição secundária, em vez de 90%; perde 2% na posição principal.' },
  leader: { label: 'Líder', description: 'Reduz pela metade o efeito da moral abaixo de 70 nos companheiros; contribui 2% menos no ataque. O efeito não acumula.' },
};
export const profileInfo: Record<ClubProfile, { label: string; description: string }> = {
  academy: { label: 'Clube formador', description: 'Base com maior margem de evolução, preferência da IA por jovens e reconhecimento da diretoria por dar minutos a atletas sub-21.' },
  traditional: { label: 'Tradição em reconstrução', description: 'Meta esportiva mais exigente e preferência da IA por reforços prontos para jogar.' },
  community: { label: 'Clube de torcida', description: 'Torcida mais presente nos clássicos e diretoria que cobra uma posição acima da expectativa habitual.' },
};
export function identityHash(id: string): number {
  let hash = 2166136261;
  for (const char of id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return hash;
}
export function generatedTrait(id: string, position: PlayerPosition): PlayerTrait {
  const choices: PlayerTrait[] = position === 'GK' ? ['leader', 'versatile']
    : ['ST', 'LW', 'RW'].includes(position) ? ['speedster', 'finisher', 'versatile', 'leader']
      : ['CM', 'AM', 'DM'].includes(position) ? ['playmaker', 'versatile', 'leader'] : ['speedster', 'versatile', 'leader'];
  return choices[identityHash(id) % choices.length];
}
export const playerTrait = (player: Player): PlayerTrait => player.trait ?? generatedTrait(player.id, player.primaryPosition);
export const clubProfile = (team: Team): ClubProfile => team.profile ?? (['academy', 'traditional', 'community'] as const)[identityHash(team.id) % 3];

/** Modificadores pequenos, sempre acompanhados de uma contrapartida. */
export function traitStrength(player: Player, unit: 'defense' | 'midfield' | 'attack', style: PlayingStyle): number {
  const trait = playerTrait(player);
  if (trait === 'speedster') return unit === 'attack' ? style === 'defensive' ? 1.08 : 1.04 : unit === 'midfield' ? .96 : 1;
  if (trait === 'playmaker') return unit === 'midfield' ? 1.06 : unit === 'attack' ? 1.02 : .96;
  if (trait === 'finisher') return unit === 'midfield' ? .94 : 1;
  if (trait === 'leader') return unit === 'attack' ? .98 : 1;
  return 1;
}

export const matchFatigue = (player: Player, minutes: number, fullMatchFatigue = 22) =>
  fullMatchFatigue * minutes / 90 * (1.15 - player.attributes.stamina / 300);
