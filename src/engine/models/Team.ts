import type { Player } from './Player';
import type { Tactic } from './Tactic';

export interface Stadium {
  capacity: number;
  ticketPrice: number;
}

export interface Team {
  id: string;
  name: string;
  city: string;
  division: number;
  squad: Player[];
  budget: number;
  payroll: number;
  /** Escala de 0 a 100. */
  reputation: number;
  stadium: Stadium;
  defaultTactic: Tactic;
}
