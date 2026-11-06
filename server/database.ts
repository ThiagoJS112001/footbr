import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { CatalogClub, CatalogPlayer, CatalogSeason, CatalogSnapshot, ClubFacts, CompetitionOption, ImageRef, ImportEvent, ImportJob, ImportSelection, PlayerFacts, Provider } from '../src/data/catalog.ts';

const parse = <T>(row: unknown): T => JSON.parse((row as { data: string }).data) as T;
export class CatalogDatabase {
  readonly db: DatabaseSync;
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS competitions(id TEXT PRIMARY KEY, provider TEXT NOT NULL, external_id INTEGER NOT NULL, data TEXT NOT NULL, UNIQUE(provider, external_id));
      CREATE TABLE IF NOT EXISTS seasons(id TEXT PRIMARY KEY, competition_id TEXT NOT NULL REFERENCES competitions(id), year INTEGER NOT NULL, division INTEGER NOT NULL, UNIQUE(competition_id, year));
      CREATE TABLE IF NOT EXISTS clubs(id TEXT PRIMARY KEY, provider TEXT NOT NULL, external_id INTEGER NOT NULL, data TEXT NOT NULL, UNIQUE(provider, external_id));
      CREATE TABLE IF NOT EXISTS players(id TEXT PRIMARY KEY, provider TEXT NOT NULL, external_id INTEGER NOT NULL, data TEXT NOT NULL, UNIQUE(provider, external_id));
      CREATE TABLE IF NOT EXISTS season_clubs(season_id TEXT REFERENCES seasons(id), club_id TEXT REFERENCES clubs(id), kind TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(season_id, club_id));
      CREATE TABLE IF NOT EXISTS rosters(season_id TEXT NOT NULL, club_id TEXT NOT NULL, player_id TEXT REFERENCES players(id), number INTEGER, position TEXT, PRIMARY KEY(season_id, club_id, player_id), FOREIGN KEY(season_id, club_id) REFERENCES season_clubs(season_id, club_id));
      -- O provedor não informa contratos: desconhecidos, nunca inferidos como fatos.
      CREATE TABLE IF NOT EXISTS roster_contracts(season_id TEXT, club_id TEXT, player_id TEXT, salary INTEGER, starts_at TEXT, ends_at TEXT, PRIMARY KEY(season_id, club_id, player_id), FOREIGN KEY(season_id, club_id, player_id) REFERENCES rosters(season_id, club_id, player_id) ON DELETE CASCADE);
      CREATE TABLE IF NOT EXISTS imports(id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS import_events(id INTEGER PRIMARY KEY AUTOINCREMENT, job_id TEXT NOT NULL REFERENCES imports(id), club_external_id INTEGER, level TEXT NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS api_cache(key TEXT PRIMARY KEY, expires_at INTEGER NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS api_state(key TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS media(id TEXT PRIMARY KEY, mime TEXT NOT NULL, bytes BLOB NOT NULL, license TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS image_overrides(entity_id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS career_snapshots(id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS careers(id TEXT PRIMARY KEY, snapshot_id TEXT NOT NULL REFERENCES career_snapshots(id), data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS career_players(career_id TEXT REFERENCES careers(id), player_id TEXT, club_id TEXT, data TEXT NOT NULL, PRIMARY KEY(career_id, player_id));`);
    for (const job of this.jobs()) if (job.status === 'running' || job.status === 'pending') {
      job.status = 'interrupted';
      job.items = job.items.map((item) => item.status === 'running' ? { ...item, status: 'pending' } : item);
      this.saveJob(job);
      this.log(job.id, null, 'info', 'Servidor reiniciado; importação disponível para retomada.');
    }
  }
  close() { this.db.close(); }
  transaction<T>(operation: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = operation(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  private upsert(table: 'clubs' | 'players' | 'competitions', provider: Provider, externalId: number, data: unknown): string {
    const existing = this.db.prepare(`SELECT id FROM ${table} WHERE provider=? AND external_id=?`).get(provider, externalId) as { id: string } | undefined;
    const id = existing?.id ?? randomUUID();
    this.db.prepare(`INSERT INTO ${table}(id,provider,external_id,data) VALUES(?,?,?,?) ON CONFLICT(provider,external_id) DO UPDATE SET data=excluded.data`).run(id, provider, externalId, JSON.stringify(data));
    return id;
  }
  importClub(provider: Provider, selection: ImportSelection, club: ClubFacts, players: PlayerFacts[], kind: CatalogClub['rosterKind']) {
    if (!club.name || !Number.isSafeInteger(club.externalId) || !players.length || players.length > 100 || players.some((p) => !p.name || !Number.isSafeInteger(p.externalId)) || new Set(players.map((p) => p.externalId)).size !== players.length) throw new Error('Resposta incompleta: clube ou elenco inválido. A base anterior foi preservada.');
    return this.transaction(() => {
      const competitionId = this.upsert('competitions', provider, selection.competition.externalId, selection.competition);
      const prior = this.db.prepare('SELECT id FROM seasons WHERE competition_id=? AND year=?').get(competitionId, selection.year) as { id: string } | undefined;
      const seasonId = prior?.id ?? randomUUID();
      this.db.prepare('INSERT INTO seasons VALUES(?,?,?,?) ON CONFLICT(competition_id,year) DO UPDATE SET division=excluded.division').run(seasonId, competitionId, selection.year, selection.division);
      const clubId = this.upsert('clubs', provider, club.externalId, club);
      this.db.prepare('INSERT INTO season_clubs VALUES(?,?,?,?) ON CONFLICT(season_id,club_id) DO UPDATE SET kind=excluded.kind,updated_at=excluded.updated_at').run(seasonId, clubId, kind, new Date().toISOString());
      this.db.prepare('DELETE FROM rosters WHERE season_id=? AND club_id=?').run(seasonId, clubId);
      for (const player of players) {
        const playerId = this.upsert('players', provider, player.externalId, player);
        this.db.prepare('INSERT INTO rosters VALUES(?,?,?,?,?)').run(seasonId, clubId, playerId, player.number, player.position);
        this.db.prepare('INSERT INTO roster_contracts VALUES(?,?,?,NULL,NULL,NULL)').run(seasonId, clubId, playerId);
      }
      return clubId;
    });
  }
  image(id: string, original: ImageRef): ImageRef {
    const row = this.db.prepare('SELECT data FROM image_overrides WHERE entity_id=?').get(id);
    return row ? parse<ImageRef>(row) : original;
  }
  seasons(): CatalogSeason[] {
    const seasons = this.db.prepare('SELECT s.*, c.provider, c.data FROM seasons s JOIN competitions c ON c.id=s.competition_id ORDER BY year DESC, division').all() as unknown as { id: string; provider: Provider; data: string; year: number; division: 1 | 2 }[];
    return seasons.map((season) => ({ id: season.id, provider: season.provider, competition: parse<CompetitionOption>(season), year: season.year, division: season.division,
      clubs: (this.db.prepare('SELECT c.id,c.data,sc.kind,sc.updated_at FROM clubs c JOIN season_clubs sc ON sc.club_id=c.id WHERE sc.season_id=? ORDER BY c.external_id').all(season.id) as unknown as { id: string; data: string; kind: CatalogClub['rosterKind']; updated_at: string }[]).map((row) => {
        const facts = parse<ClubFacts>(row);
        const players = (this.db.prepare('SELECT p.id,p.data,r.number,r.position FROM players p JOIN rosters r ON r.player_id=p.id WHERE r.season_id=? AND r.club_id=? ORDER BY p.external_id').all(season.id, row.id) as unknown as { id: string; data: string; number: number | null; position: string | null }[]).map((p): CatalogPlayer => {
          const facts = parse<PlayerFacts>(p); return { ...facts, id: p.id, number: p.number, position: p.position, image: this.image(p.id, facts.image) };
        });
        return { ...facts, id: row.id, provider: season.provider, rosterKind: row.kind, updatedAt: row.updated_at, image: this.image(row.id, facts.image), players };
      }) }));
  }
  saveJob(job: ImportJob) {
    job.updatedAt = new Date().toISOString();
    this.db.prepare('INSERT INTO imports VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(job.id, JSON.stringify(job));
  }
  jobs(): ImportJob[] { return this.db.prepare('SELECT data FROM imports ORDER BY rowid DESC LIMIT 100').all().map((row) => parse<ImportJob>(row)); }
  log(jobId: string, clubExternalId: number | null, level: 'info' | 'error', message: string) { this.db.prepare('INSERT INTO import_events(job_id,club_external_id,level,message,created_at) VALUES(?,?,?,?,?)').run(jobId, clubExternalId, level, message, new Date().toISOString()); }
  events(jobId: string): ImportEvent[] { return this.db.prepare('SELECT id,club_external_id AS clubExternalId,level,message,created_at AS createdAt FROM import_events WHERE job_id=? ORDER BY id DESC LIMIT 500').all(jobId) as unknown as ImportEvent[]; }
  job(id: string): ImportJob {
    const row = this.db.prepare('SELECT data FROM imports WHERE id=?').get(id);
    if (!row) throw new Error('Importação não encontrada.');
    return parse<ImportJob>(row);
  }
  cache(key: string): unknown | undefined {
    const row = this.db.prepare('SELECT data FROM api_cache WHERE key=? AND expires_at>?').get(key, Date.now());
    return row ? parse<unknown>(row) : undefined;
  }
  cachePut(key: string, data: unknown, ttl: number) { this.db.prepare('INSERT OR REPLACE INTO api_cache VALUES(?,?,?)').run(key, Date.now() + ttl, JSON.stringify(data)); }
  clearCache() { this.db.exec('DELETE FROM api_cache'); }
  state<T>(key: string): T | undefined { const row = this.db.prepare('SELECT data FROM api_state WHERE key=?').get(key); return row ? parse<T>(row) : undefined; }
  setState(key: string, data: unknown) { this.db.prepare('INSERT OR REPLACE INTO api_state VALUES(?,?)').run(key, JSON.stringify(data)); }
  setImage(entityId: string, image: ImageRef) {
    if (!this.db.prepare('SELECT id FROM clubs WHERE id=? UNION SELECT id FROM players WHERE id=?').get(entityId, entityId)) throw new Error('Clube ou jogador não encontrado.');
    this.db.prepare('INSERT OR REPLACE INTO image_overrides VALUES(?,?)').run(entityId, JSON.stringify(image));
  }
  addMedia(mime: string, bytes: Uint8Array, license: string): string {
    const id = randomUUID();
    this.db.prepare('INSERT INTO media VALUES(?,?,?,?)').run(id, mime, bytes, license);
    return `/api/media/${id}`;
  }
  media(id: string) { return this.db.prepare('SELECT mime,bytes FROM media WHERE id=?').get(id) as { mime: string; bytes: Uint8Array } | undefined; }
  saveCareer(snapshot: CatalogSnapshot, career: { league: { teams: { id: string; squad: { id: string }[] }[] }; otherLeague: { teams: { id: string; squad: { id: string }[] }[] }; freeAgents?: { id: string }[] }) {
    this.transaction(() => {
      this.db.prepare('INSERT INTO career_snapshots VALUES(?,?)').run(snapshot.id, JSON.stringify(snapshot));
      this.db.prepare('INSERT INTO careers VALUES(?,?,?)').run(snapshot.id, snapshot.id, JSON.stringify(career));
      for (const team of [...career.league.teams, ...career.otherLeague.teams]) for (const player of team.squad) this.db.prepare('INSERT INTO career_players VALUES(?,?,?,?)').run(snapshot.id, player.id, team.id, JSON.stringify(player));
      for (const player of career.freeAgents ?? []) this.db.prepare('INSERT INTO career_players VALUES(?,?,?,?)').run(snapshot.id, player.id, null, JSON.stringify(player));
    });
  }
}
