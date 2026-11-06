import type { ClubFacts, CompetitionOption, ImportStatus, PlayerFacts, Provider } from '../src/data/catalog.ts';
import { CatalogDatabase } from './database.ts';
import { generateTeam } from '../src/engine/generators/team.ts';
import { createHash } from 'node:crypto';

export interface FootballProvider {
  name: Provider;
  countries(): Promise<string[]>;
  competitions(country: string): Promise<CompetitionOption[]>;
  teams(league: number, season: number): Promise<ClubFacts[]>;
  players(team: number, league: number, season: number, current: boolean): Promise<{ players: PlayerFacts[]; kind: 'current' | 'season-participants' | 'demo' }>;
  status(): Omit<ImportStatus, 'running'>;
}
const missingImage = { sourceUrl: null, displayUrl: null, license: null };
type Row = Record<string, unknown>;
const obj = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const str = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value.trim().slice(0, 500) : null;
const num = (value: unknown): number | null => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
const rows = (value: unknown): Row[] => Array.isArray(value) ? value.map(obj) : [];
const mediaUrl = (value: unknown) => {
  try { const url = new URL(String(value)); return url.protocol === 'https:' && url.hostname === 'media.api-sports.io' && !url.username && !url.password && (!url.port || url.port === '443') ? url.href : null; } catch { return null; }
};
const image = (value: unknown) => ({ ...missingImage, sourceUrl: mediaUrl(value) });
export class ProviderError extends Error {
  retryAt: number;
  constructor(message: string, retryAt = 0) { super(message); this.retryAt = retryAt; }
}
interface RateState { dailyRemaining: number | null; minuteRemaining: number | null; blockedUntil: number; nextAt: number; day: string }
interface ApiResponse { response: Row[]; paging: { current: number; total: number } }
export class ApiFootballProvider implements FootballProvider {
  readonly name = 'api-football' as const;
  private queue: Promise<unknown> = Promise.resolve();
  private rate: RateState;
  private rateKey: string;
  constructor(private db: CatalogDatabase, private key: string, private request: typeof fetch = fetch, private interval = 6500) {
    this.rateKey = `rate:${createHash('sha256').update(key).digest('hex').slice(0, 16)}`;
    this.rate = db.state<RateState>(this.rateKey) ?? { dailyRemaining: null, minuteRemaining: null, blockedUntil: 0, nextAt: 0, day: '' };
  }
  status() { return { provider: this.name, ...this.rate }; }
  private async get(path: string, params: Record<string, string | number> = {}): Promise<ApiResponse> {
    const query = new URLSearchParams(Object.entries(params).sort().map(([key, value]) => [key, String(value)]));
    const cacheKey = `${path}?${query}`;
    const cached = this.db.cache(cacheKey);
    if (cached) return cached as ApiResponse;
    const operation = this.queue.catch(() => undefined).then(async () => {
      const recheck = this.db.cache(cacheKey);
      if (recheck) return recheck as ApiResponse;
      const day = new Date().toISOString().slice(0, 10);
      if (day !== this.rate.day) { this.rate.dailyRemaining = null; this.rate.day = day; }
      if (this.rate.blockedUntil > Date.now()) throw new ProviderError('Limite da API atingido. Aguarde o horário indicado e retome a importação.', this.rate.blockedUntil);
      if (this.rate.dailyRemaining === 0) throw new ProviderError('Cota diária da API esgotada. Retome após a renovação da cota.');
      const wait = Math.max(0, this.rate.nextAt - Date.now());
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      this.rate.nextAt = Date.now() + Math.max(this.interval, 0);
      this.db.setState(this.rateKey, this.rate);
      let response: Response;
      try { response = await this.request(`https://v3.football.api-sports.io/${cacheKey}`, { headers: { 'x-apisports-key': this.key }, signal: AbortSignal.timeout(25000) }); }
      catch { throw new ProviderError('Falha de conexão com a API. O progresso foi preservado; tente retomar.'); }
      const daily = response.headers.get('x-ratelimit-requests-remaining');
      const minute = response.headers.get('x-ratelimit-remaining');
      const minuteLimit = response.headers.get('x-ratelimit-limit');
      if (minuteLimit && /^\d+$/.test(minuteLimit) && Number(minuteLimit) > 0) this.rate.nextAt = Math.max(this.rate.nextAt, Date.now() + Math.ceil(60000 / Number(minuteLimit)) + 200);
      this.rate.dailyRemaining = daily !== null && /^\d+$/.test(daily) ? Number(daily) : this.rate.dailyRemaining;
      this.rate.minuteRemaining = minute !== null && /^\d+$/.test(minute) ? Number(minute) : null;
      if (response.status === 429 || this.rate.minuteRemaining === 0 || this.rate.dailyRemaining === 0) {
        const retry = response.headers.get('retry-after');
        const retryTime = retry && /^\d+$/.test(retry) ? Date.now() + Number(retry) * 1000 : retry ? Date.parse(retry) : NaN;
        const tomorrow = new Date(); tomorrow.setUTCHours(24, 0, 0, 0);
        this.rate.blockedUntil = this.rate.dailyRemaining === 0 ? tomorrow.getTime() : Math.max(Date.now() + 61000, Number.isFinite(retryTime) ? retryTime : 0);
      }
      this.db.setState(this.rateKey, this.rate);
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) throw new ProviderError('A API recusou o acesso. Confira a chave e a cobertura do plano no servidor.');
        if (response.status === 429) throw new ProviderError('Limite de requisições atingido. Retome após a pausa indicada.', this.rate.blockedUntil);
        throw new ProviderError(`API indisponível (HTTP ${response.status}). Retome a importação mais tarde.`);
      }
      let body: Row;
      try { body = obj(await response.json()); } catch { throw new ProviderError('Resposta inválida da API. Nenhum elenco foi substituído.'); }
      if (Object.keys(obj(body.errors)).length || Array.isArray(body.errors) && body.errors.length) {
        // Não repassa mensagens externas que possam conter credenciais ou conteúdo arbitrário.
        const hasRateError = /rateLimit|requests|quota/i.test(JSON.stringify(body.errors));
        if (hasRateError) { this.rate.blockedUntil = Date.now() + 61000; this.db.setState(this.rateKey, this.rate); }
        throw new ProviderError(hasRateError ? 'A API informou limite de cota. Aguarde e retome.' : 'A API não disponibilizou estes dados. Confira a temporada e a cobertura do seu plano.', this.rate.blockedUntil);
      }
      if (!Array.isArray(body.response) || typeof body.results !== 'number' || body.results !== body.response.length) throw new ProviderError('Resposta incompleta da API. Nenhum elenco foi substituído.');
      const paging = obj(body.paging);
      const current = num(paging.current) ?? 1, total = num(paging.total) ?? 1;
      if (current < 1 || total < 1 || total > 1000 || current > total) throw new ProviderError('Paginação inválida da API.');
      const data = { response: rows(body.response), paging: { current, total } };
      this.db.cachePut(cacheKey, data, path === 'players/profiles' ? 7 * 86400000 : 86400000);
      return data;
    });
    this.queue = operation;
    return operation;
  }
  async countries() { return (await this.get('countries')).response.flatMap((r) => str(r.name) ? [str(r.name)!] : []).sort(); }
  async competitions(country: string): Promise<CompetitionOption[]> {
    return (await this.get('leagues', { country })).response.filter((r) => obj(r.league).type === 'League').map((r) => ({ externalId: num(obj(r.league).id)!, name: str(obj(r.league).name) ?? '', country: str(obj(r.country).name) ?? country, seasons: rows(r.seasons).flatMap((s) => num(s.year) ? [{ year: num(s.year)!, current: s.current === true }] : []) })).filter((r) => r.externalId !== null && r.name && r.seasons.length).sort((a, b) => (a.externalId === 71 ? -1 : a.externalId === 72 ? 0 : 1) - (b.externalId === 71 ? -1 : b.externalId === 72 ? 0 : 1) || a.name.localeCompare(b.name));
  }
  async teams(league: number, season: number): Promise<ClubFacts[]> {
    return (await this.get('teams', { league, season })).response.map((r) => {
      const t = obj(r.team), v = obj(r.venue);
      if (num(t.id) === null || !str(t.name)) throw new ProviderError('A API retornou um clube sem identificador ou nome.');
      return { externalId: num(t.id)!, name: str(t.name)!, shortName: str(t.code), country: str(t.country), city: str(v.city), stadium: str(v.name), capacity: num(v.capacity), image: image(t.logo) };
    });
  }
  private profile(p: Row, position: unknown, number: unknown): PlayerFacts {
    if (num(p.id) === null || !str(p.name)) throw new ProviderError('A API retornou um jogador sem identificador ou nome.');
    const full = [str(p.firstname), str(p.lastname)].filter(Boolean).join(' ');
    const date = str(obj(p.birth).date);
    return { externalId: num(p.id)!, name: full || str(p.name)!, age: num(p.age), birthDate: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null, nationality: str(p.nationality), position: str(position), number: num(number), image: image(p.photo) };
  }
  async players(team: number, league: number, season: number, current: boolean) {
    const profiles = new Map<number, PlayerFacts>();
    for (let page = 1, total = 1; page <= total; page++) {
      const result = await this.get('players', { team, league, season, page });
      if (result.paging.current !== page) throw new ProviderError('Página de jogadores divergente.');
      total = result.paging.total;
      for (const row of result.response) {
        const stats = rows(row.statistics).find((s) => num(obj(s.team).id) === team);
        if (!stats) throw new ProviderError('Resposta incompleta: jogador sem vínculo com o clube consultado.');
        const facts = this.profile(obj(row.player), obj(stats.games).position, obj(stats.games).number);
        profiles.set(facts.externalId, facts);
      }
    }
    if (!current) {
      if (!profiles.size) throw new ProviderError('Sem jogadores nesta temporada. Verifique a cobertura do plano.');
      return { players: [...profiles.values()], kind: 'season-participants' as const };
    }
    const squads = await this.get('players/squads', { team });
    const squad = squads.response.find((s) => num(obj(s.team).id) === team);
    if (!squad || !Array.isArray(squad.players) || !squad.players.length) throw new ProviderError('Elenco atual indisponível. A base anterior foi preservada.');
    const players: PlayerFacts[] = [];
    for (const raw of rows(squad.players)) {
      let facts = profiles.get(num(raw.id)!);
      if (!facts) {
        const extra = await this.get('players/profiles', { player: num(raw.id) ?? -1 });
        const full = extra.response.map((r) => obj(r.player)).find((p) => num(p.id) === num(raw.id));
        facts = this.profile(full ?? raw, raw.position, raw.number);
      }
      players.push({ ...facts, number: num(raw.number), position: str(raw.position) ?? facts.position, image: facts.image.sourceUrl ? facts.image : image(raw.photo) });
    }
    return { players, kind: 'current' as const };
  }
}

/** Fluxo completo de importação com identidades fictícias; nunca se apresenta como API real. */
export class DemoProvider implements FootballProvider {
  readonly name = 'demo' as const;
  status() { return { provider: this.name, dailyRemaining: null, minuteRemaining: null, blockedUntil: 0 }; }
  async countries() { return ['Brazil']; }
  async competitions(): Promise<CompetitionOption[]> { return [1, 2].map((division) => ({ externalId: division, name: `Brasil · Série ${division === 1 ? 'A' : 'B'} · DEMONSTRAÇÃO FICTÍCIA`, country: 'Brazil', seasons: [{ year: 2026, current: true }] })); }
  async teams(league: number): Promise<ClubFacts[]> { return [1, 2].map((i) => ({ externalId: league * 100 + i, name: `${league === 1 ? 'Horizonte' : 'Vale'} ${i === 1 ? 'Azul' : 'Verde'} (Demo)`, shortName: `D${league}${i}`, country: 'Brasil', city: 'Cidade fictícia', stadium: 'Arena de demonstração', capacity: 20000, image: { ...missingImage } })); }
  async players(team: number) {
    const generated = generateTeam(team, 65);
    return { kind: 'demo' as const, players: generated.squad.map((p, i) => ({ externalId: team * 1000 + i, name: `${p.name} (Demo)`, age: p.age, birthDate: null, nationality: p.nationality, position: p.primaryPosition, number: i + 1, image: { ...missingImage } })) };
  }
}
