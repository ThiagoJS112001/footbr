/** Notação de formação sem o goleiro, por exemplo 4-4-2 ou 4-2-3-1. */
export type Formation = `${number}-${number}-${number}` | `${number}-${number}-${number}-${number}`;
export type PlayingStyle = 'defensive' | 'balanced' | 'attacking';
export type MarkingIntensity = 'low' | 'medium' | 'high';

export interface Tactic {
  formation: Formation;
  style: PlayingStyle;
  markingIntensity: MarkingIntensity;
}
