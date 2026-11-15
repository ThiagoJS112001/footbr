import type { Player } from './Player';
import type { Tactic } from './Tactic';
import type { ClubFacts, ImportedIdentity } from '../../data/catalog';
import type { ClubProfile } from './personality';

export interface Stadium {
  capacity: number;
  ticketPrice: number;
}

export interface Team {
  profile?: ClubProfile;
  identity?: ImportedIdentity<ClubFacts>;
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
