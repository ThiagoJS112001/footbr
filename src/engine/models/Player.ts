export type PlayerPosition =
  | 'GK'
  | 'CB'
  | 'LB'
  | 'RB'
  | 'DM'
  | 'CM'
  | 'AM'
  | 'LW'
  | 'RW'
  | 'ST';

/** Atributos inteiros de 1 a 99; validação será feita pelo motor. */
export interface PlayerAttributes {
  attack: number;
  midfield: number;
  defense: number;
  goalkeeping: number;
  speed: number;
  passing: number;
  finishing: number;
  stamina: number;
}

export interface Injury {
  description: string;
  remainingDays: number;
}

export interface PlayerContract {
  salary: number;
  yearsRemaining: number;
}

export interface PlayerDiscipline {
  yellowCards: number;
  suspendedMatches: number;
}

export interface Player {
  id: string;
  name: string;
  age: number;
  nationality: string;
  primaryPosition: PlayerPosition;
  secondaryPosition: PlayerPosition | null;
  attributes: PlayerAttributes;
  /** Valor calculado a partir dos atributos; cálculo em uma etapa futura. */
  overall: number;
  /** Teto de evolução; ausente nos saves anteriores à versão 2. */
  potential?: number;
  /** Escala de 0 a 100. */
  morale: number;
  /** Escala de 0 a 100. */
  fitness: number;
  injury: Injury | null;
  discipline: PlayerDiscipline;
  contract: PlayerContract | null;
  marketValue: number;
  /** null representa jogador sem clube. */
  currentTeamId: string | null;
}
