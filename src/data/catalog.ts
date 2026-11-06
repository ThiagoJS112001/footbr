/** Identidade obtida do provedor. Nunca contém atributos ou contratos simulados. */
export type Provider = 'api-football' | 'demo';
export interface ImageRef {
  sourceUrl: string | null;
  displayUrl: string | null;
  license: string | null;
}
export interface ClubFacts {
  externalId: number;
  name: string;
  shortName: string | null;
  country: string | null;
  city: string | null;
  stadium: string | null;
  capacity: number | null;
  image: ImageRef;
}
export interface PlayerFacts {
  externalId: number;
  name: string;
  age: number | null;
  birthDate: string | null;
  nationality: string | null;
  position: string | null;
  number: number | null;
  image: ImageRef;
}
export interface CatalogPlayer extends PlayerFacts { id: string }
export interface CatalogClub extends ClubFacts {
  id: string;
  provider: Provider;
  players: CatalogPlayer[];
  rosterKind: 'current' | 'season-participants' | 'demo';
  updatedAt: string;
}
export interface CompetitionOption {
  externalId: number;
  name: string;
  country: string;
  seasons: { year: number; current: boolean }[];
}
export interface ImportSelection {
  competition: CompetitionOption;
  year: number;
  division: 1 | 2;
  clubIds: number[];
}
export interface CatalogSeason {
  id: string;
  provider: Provider;
  competition: CompetitionOption;
  year: number;
  division: 1 | 2;
  clubs: CatalogClub[];
}
export interface SimulationConfig {
  minOverall: number;
  maxOverall: number;
  potentialBonus: number;
  fitness: number;
  morale: number;
  unknownAge: number;
}
export const defaultSimulation: SimulationConfig = { minOverall: 55, maxOverall: 82, potentialBonus: 10, fitness: 100, morale: 75, unknownAge: 24 };
export function validateSimulation(value: SimulationConfig) {
  if (!value || !Object.keys(defaultSimulation).every((key) => Number.isInteger(value[key as keyof SimulationConfig]))) throw new Error('Configuração de simulação inválida.');
  if (value.minOverall < 1 || value.maxOverall > 95 || value.maxOverall < value.minOverall || value.potentialBonus < 0 || value.potentialBonus > 30 || value.fitness < 1 || value.fitness > 100 || value.morale < 0 || value.morale > 100 || value.unknownAge < 16 || value.unknownAge > 50) throw new Error('Revise os limites dos atributos de simulação.');
}
export interface CatalogSnapshot {
  id: string;
  createdAt: string;
  seasons: CatalogSeason[];
  simulation: SimulationConfig;
  /** Participações históricas podem colocar um atleta em mais de um clube. Escolha apenas na cópia. */
  assignments: Record<string, string>;
}
export interface CareerSource {
  id: string;
  snapshotId: string;
  createdAt: string;
  providers: Provider[];
  seasons: { name: string; year: number; division: number }[];
  simulation: SimulationConfig;
  importedClubs: number;
  fictionalClubs: number;
}
export interface ImportedIdentity<T> {
  catalogId: string;
  provider: Provider;
  facts: T;
  observedAt: string;
  /** Posições específicas, idade ausente, finanças e contratos são parâmetros do jogo. */
  simulatedFields: string[];
}
export interface ImportItem {
  externalId: number;
  name: string;
  status: 'pending' | 'running' | 'done' | 'error';
  players: number;
  error: string | null;
  warnings: string[];
}
export interface ImportJob {
  id: string;
  provider: Provider;
  selection: ImportSelection;
  status: 'pending' | 'running' | 'done' | 'partial' | 'interrupted';
  createdAt: string;
  updatedAt: string;
  items: ImportItem[];
}
export interface ImportStatus {
  provider: Provider;
  dailyRemaining: number | null;
  minuteRemaining: number | null;
  blockedUntil: number;
  running: boolean;
}
export interface ImportEvent {
  id: number;
  clubExternalId: number | null;
  level: 'info' | 'error';
  message: string;
  createdAt: string;
}
