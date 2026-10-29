import { pick, randomInt } from './random.ts';
import type { Rng } from './random.ts';

// Combinações fictícias; não representam atletas ou clubes existentes.
const firstNames = [
  'Adélio', 'Breno', 'Caíque', 'Dário', 'Elian', 'Fábio', 'Gaspar', 'Hélio',
  'Ítalo', 'Jairo', 'Luan', 'Mauro', 'Nélio', 'Otávio', 'Ruan', 'Tadeu',
  'Ulisses', 'Vítor', 'Yago', 'Abel', 'Camilo', 'Damián', 'Esteban', 'Facundo',
  'Germán', 'Ignacio', 'Julián', 'Lautaro', 'Nicanor', 'Ramiro', 'Tobias', 'Valentín',
] as const;
const surnames = [
  'Alvarim', 'Belmonte', 'Castanhal', 'Doural', 'Esteval', 'Figueiral',
  'Guaral', 'Lameiral', 'Monteluz', 'Norval', 'Olival', 'Pedral', 'Quintalvo',
  'Ribeiral', 'Serralvo', 'Torreal', 'Valedouro', 'Ventoral', 'Zambral',
  'Arandelo', 'Brumales', 'Candeiral', 'Delvado', 'Escornal', 'Fuentelar',
  'Lomavéu', 'Miraluz', 'Pontalvo', 'Rocavento', 'Solteiro', 'Vilarim', 'Zorvalho',
] as const;

const cityStarts = ['Vale', 'Campo', 'Porto', 'Monte', 'Lago', 'Rio', 'Bosque', 'Pontal'] as const;
const cityEnds = ['Sereno', 'Dourado', 'Celeste', 'do Horizonte', 'das Brumas', 'dos Ventos', 'do Sol Nascente', 'das Araucárias'] as const;
const clubSuffixes = ['Atlético', 'Esporte Clube', 'União', 'Futebol Clube', 'Sportivo', 'Clube Esportivo', 'Associação', 'Grêmio Esportivo'] as const;

export const CLUB_NAME_CAPACITY = cityStarts.length * cityEnds.length * clubSuffixes.length;

export function generatePlayerName(rng: Rng): string {
  return `${pick(rng, firstNames)} ${pick(rng, surnames)}`;
}

export interface ClubIdentity {
  name: string;
  city: string;
}

/** Um índice permite percorrer o catálogo sem colisões nem tentativas ilimitadas. */
export function generateClubName(rng: Rng, index = randomInt(rng, 0, CLUB_NAME_CAPACITY - 1)): ClubIdentity {
  if (!Number.isInteger(index) || index < 0 || index >= CLUB_NAME_CAPACITY) {
    throw new RangeError('Índice de clube fora do catálogo.');
  }
  const cityIndex = Math.floor(index / clubSuffixes.length);
  const city = `${cityStarts[Math.floor(cityIndex / cityEnds.length)]} ${cityEnds[cityIndex % cityEnds.length]}`;
  return { city, name: `${city} ${clubSuffixes[index % clubSuffixes.length]}` };
}
