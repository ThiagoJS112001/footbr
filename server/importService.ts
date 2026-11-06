import { randomUUID } from 'node:crypto';
import type { CatalogSnapshot, ImportJob, ImportSelection, SimulationConfig } from '../src/data/catalog.ts';
import { validateSimulation } from '../src/data/catalog.ts';
import { createImportedCareer } from '../src/engine/career/imported.ts';
import { CatalogDatabase } from './database.ts';
import type { FootballProvider } from './provider.ts';
import { ProviderError } from './provider.ts';

export class ImportService {
  private running = false;
  private completion: Promise<void> = Promise.resolve();
  constructor(readonly database: CatalogDatabase, readonly provider: FootballProvider) {}
  status() { return { ...this.provider.status(), running: this.running }; }
  async start(input: ImportSelection, refresh = false) {
    if (this.running) throw new Error('Já existe uma importação em andamento. Aguarde sua conclusão.');
    if (!input || !input.competition || typeof input.competition.country !== 'string' || input.competition.country.length > 100 || !Number.isSafeInteger(input.year) || ![1, 2].includes(input.division) || !Array.isArray(input.clubIds) || !input.clubIds.length || input.clubIds.length > 100 || !input.clubIds.every((id) => Number.isSafeInteger(id) && id > 0) || new Set(input.clubIds).size !== input.clubIds.length) throw new Error('Seleção de importação inválida.');
    // Reserva o serviço antes das consultas para impedir duas importações concorrentes.
    this.running = true;
    try {
      if (refresh) this.database.clearCache();
      const competition = (await this.provider.competitions(input.competition.country)).find((c) => c.externalId === input.competition.externalId);
      if (!competition || !competition.seasons.some((s) => s.year === input.year)) throw new Error('Campeonato ou temporada indisponível no provedor.');
      const teams = await this.provider.teams(competition.externalId, input.year);
      if (input.clubIds.some((id) => !teams.some((t) => t.externalId === id))) throw new Error('A seleção contém clubes fora deste campeonato.');
      const timestamp = new Date().toISOString();
      const job: ImportJob = { id: randomUUID(), provider: this.provider.name, selection: { ...input, competition }, status: 'pending', createdAt: timestamp, updatedAt: timestamp,
        items: input.clubIds.map((externalId) => ({ externalId, name: teams.find((t) => t.externalId === externalId)!.name, status: 'pending', players: 0, error: null, warnings: [] })) };
      this.database.setState(`job-clubs-${job.id}`, teams);
      this.database.saveJob(job);
      this.database.log(job.id, null, 'info', `Importação criada: ${job.items.length} clube(s), ${yearLabel(job.selection)}.`);
      this.run(job);
      return this.database.job(job.id);
    } catch (error) { this.running = false; throw error; }
  }
  resume(id: string) {
    if (this.running) throw new Error('Aguarde a importação em andamento.');
    const job = this.database.job(id);
    if (job.provider !== this.provider.name) throw new Error('Esta importação pertence a outro provedor. Restaure a configuração anterior para retomá-la.');
    if (job.status === 'done') return job;
    job.items = job.items.map((i) => i.status === 'done' ? i : { ...i, status: 'pending', error: null });
    this.database.log(job.id, null, 'info', 'Retomada solicitada. Clubes já concluídos serão preservados.');
    this.running = true;
    this.run(job);
    return this.database.job(id);
  }
  private run(job: ImportJob) {
    job.status = 'running'; this.database.saveJob(job);
    this.completion = this.process(job).catch(() => {
      job.status = 'interrupted'; this.database.saveJob(job);
      this.database.log(job.id, null, 'error', 'Importação interrompida. Retome as pendências.');
    }).finally(() => { this.running = false; });
  }
  async idle() { await this.completion; }
  private async process(job: ImportJob) {
    const teams = this.database.state<Awaited<ReturnType<FootballProvider['teams']>>>(`job-clubs-${job.id}`)!;
    for (const item of job.items) {
      if (item.status === 'done') continue;
      item.status = 'running'; this.database.saveJob(job);
      try {
        const { competition, year, division: _division } = job.selection;
        const result = await this.provider.players(item.externalId, competition.externalId, year, competition.seasons.find((s) => s.year === year)!.current);
        const club = teams.find((t) => t.externalId === item.externalId)!;
        this.database.importClub(job.provider, job.selection, club, result.players, result.kind);
        const incomplete = result.players.filter((p) => !p.birthDate || !p.nationality || !p.position).length;
        item.warnings = [...(incomplete ? [`${incomplete} jogador(es) com nascimento, nacionalidade ou posição não informados.`] : []), ...(result.kind === 'season-participants' ? ['Base histórica de participantes; não representa necessariamente o elenco no encerramento da temporada. Idade do perfil pode ser atual.'] : []), ...(result.players.length < 18 ? ['Elenco importado com menos de 18 jogadores; insuficiente para iniciar uma carreira.'] : [])];
        item.players = result.players.length; item.status = 'done'; item.error = null;
        this.database.log(job.id, item.externalId, 'info', `${item.name}: ${item.players} jogadores importados. ${item.warnings.join(' ')}`);
      } catch (error) {
        item.status = 'error'; item.error = error instanceof Error ? error.message : 'Não foi possível importar este clube.';
        this.database.log(job.id, item.externalId, 'error', `${item.name}: ${item.error}`);
        if (error instanceof ProviderError && (error.retryAt > 0 || this.provider.status().dailyRemaining === 0)) { job.status = 'interrupted'; this.database.saveJob(job); return; }
      }
      this.database.saveJob(job);
    }
    job.status = job.items.every((i) => i.status === 'done') ? 'done' : 'partial'; this.database.saveJob(job);
    this.database.log(job.id, null, 'info', job.status === 'done' ? 'Importação concluída.' : 'Importação concluída com pendências.');
  }
  createCareer(seasonIds: string[], seed: number, simulation: SimulationConfig, assignments: Record<string, string> = {}) {
    validateSimulation(simulation);
    if (!Array.isArray(seasonIds) || seasonIds.length < 1 || seasonIds.length > 2 || new Set(seasonIds).size !== seasonIds.length || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff || !assignments || typeof assignments !== 'object' || Array.isArray(assignments) || Object.entries(assignments).some(([key, value]) => key.length > 100 || typeof value !== 'string' || value.length > 100)) throw new Error('Parâmetros da nova carreira inválidos.');
    const seasons = this.database.seasons().filter((s) => seasonIds.includes(s.id));
    if (seasons.length !== seasonIds.length) throw new Error('Temporada importada não encontrada.');
    const snapshot: CatalogSnapshot = { id: randomUUID(), createdAt: new Date().toISOString(), seasons: structuredClone(seasons), simulation: { ...simulation }, assignments: { ...assignments } };
    const career = createImportedCareer(snapshot, seed);
    this.database.saveCareer(snapshot, career);
    return career;
  }
}
function yearLabel(selection: ImportSelection) { return `${selection.competition.name}, temporada ${selection.year}`; }
