import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { once } from 'node:events';
import { CatalogDatabase } from '../server/database';
import { ApiFootballProvider, DemoProvider, ProviderError } from '../server/provider';
import { ImportService } from '../server/importService';
import { createAppServer } from '../server/http';
import { defaultSimulation } from '../src/data/catalog';
import { askingPrice, buyPlayer } from '../src/engine/career/career';
import { createSystems } from '../src/engine/career/bootstrap';
import { simulateCareerEvent } from '../src/engine/career/progression';
import { decodeSave, encodeSave } from '../src/engine/save/save';

const databases: CatalogDatabase[] = [];
const db = (path = ':memory:') => { const database = new CatalogDatabase(path); databases.push(database); return database; };
afterEach(() => { for (const database of databases.splice(0)) { try { database.close(); } catch { /* Já fechado no teste de reinício. */ } } });
async function imported(database = db(), division = 1) {
  const provider = new DemoProvider(), service = new ImportService(database, provider);
  const competition = (await provider.competitions())[division - 1];
  const teams = await provider.teams(division);
  const selection = { competition, year: 2026, division: division as 1 | 2, clubIds: teams.map((t) => t.externalId) };
  const job = await service.start(selection); await service.idle();
  return { database, provider, service, selection, job: database.job(job.id) };
}

describe('catálogo persistente e carreiras independentes', () => {
  it('importa dois clubes fictícios com 50 jogadores, atualiza os mesmos IDs e não fabrica fatos ausentes', async () => {
    const { service, database, selection, job } = await imported();
    expect(job.status).toBe('done'); expect(job.items.map((i) => i.players)).toEqual([25, 25]);
    const before = database.seasons();
    await service.start(selection); await service.idle();
    expect(database.seasons()).toEqual(before.map((s) => ({ ...s, clubs: s.clubs.map((c, i) => ({ ...c, updatedAt: database.seasons()[0].clubs[i].updatedAt })) })));
    expect(database.db.prepare('SELECT COUNT(*) AS count FROM clubs').get()).toEqual({ count: 2 });
    expect(database.db.prepare('SELECT COUNT(*) AS count FROM players').get()).toEqual({ count: 50 });
    expect(database.seasons()[0].clubs[0].players[0]).toMatchObject({ birthDate: null, image: { sourceUrl: null, displayUrl: null, license: null } });
    expect(database.db.prepare('SELECT salary, starts_at, ends_at FROM roster_contracts LIMIT 1').get()).toEqual({ salary: null, starts_at: null, ends_at: null });
    expect(database.seasons()[0].clubs[0].players[0]).not.toHaveProperty('attributes');
    expect(database.seasons()[0].clubs[0].players[0]).not.toHaveProperty('contract');
  });
  it('preserva catálogo, snapshot e outra carreira ao negociar; atualizações só entram em novas cópias', async () => {
    const { service, database, selection } = await imported();
    const seasons = database.seasons();
    const initial = service.createCareer([seasons[0].id], 42, defaultSimulation);
    const another = service.createCareer([seasons[0].id], 42, defaultSimulation);
    expect(initial.source!.id).not.toBe(another.source!.id);
    expect(initial.league.teams.map((t) => t.squad.map((p) => p.attributes))).toEqual(another.league.teams.map((t) => t.squad.map((p) => p.attributes)));
    initial.selectedTeamId = initial.league.teams[0].id;
    initial.league.teams[0].budget = 1e9;
    initial.systems = createSystems(initial);
    const seller = initial.league.teams[1], player = seller.squad.find((p) => p.primaryPosition === 'GK')!;
    const moved = buyPlayer(initial, player.id, askingPrice(player), Math.ceil(player.contract!.salary * 1.2), 3, 1);
    expect(moved.league.teams[0].squad.some((p) => p.id === player.id && p.currentTeamId === initial.selectedTeamId)).toBe(true);
    expect(moved.league.teams[1].squad).toHaveLength(24);
    expect(another.league.teams[1].squad).toHaveLength(25);
    expect(database.seasons()).toEqual(seasons);
    const originalClub = seasons[0].clubs[0];
    database.importClub('demo', selection, { ...originalClub, name: 'Nome atualizado (Demo)' }, originalClub.players, 'demo');
    const updated = service.createCareer([seasons[0].id], 42, defaultSimulation);
    expect(updated.league.teams[0].name).toBe('Nome atualizado (Demo)');
    expect(initial.league.teams[0].name).toBe(originalClub.name);
    expect(another.league.teams[0].name).toBe(originalClub.name);
    const persisted = database.db.prepare('SELECT data FROM careers WHERE id=?').get(initial.source!.id) as { data: string };
    expect(JSON.parse(persisted.data).league.teams[1].squad).toHaveLength(25);
    expect(JSON.parse(persisted.data).league.teams[0].name).toBe(originalClub.name);
    expect(database.db.prepare('SELECT COUNT(*) AS count FROM career_players WHERE career_id=?').get(initial.source!.id)).toEqual({ count: 1025 });
  });
  it('mantém identidade e origem no save, joga uma rodada e rejeita metadados e imagens inválidos', async () => {
    const { service, database } = await imported();
    const career = service.createCareer([database.seasons()[0].id], 123, { ...defaultSimulation, minOverall: 65, maxOverall: 65, fitness: 91, morale: 80 });
    career.selectedTeamId = career.league.teams[0].id; career.systems = createSystems(career);
    expect(career.league.teams[0].squad.every((p) => p.fitness === 91 && p.morale === 80 && Math.abs(p.overall - 65) <= 1)).toBe(true);
    const played = simulateCareerEvent(career, null).career;
    const data = { career: played, progress: null, lastRound: 1 };
    expect(decodeSave(encodeSave(data)).career.source).toEqual(career.source);
    expect(decodeSave(encodeSave(data)).career.league.teams[0].identity).toEqual(career.league.teams[0].identity);
    const invalid = structuredClone(data); invalid.career.league.teams[0].identity!.facts.image.displayUrl = 'javascript:alert(1)';
    expect(() => decodeSave(encodeSave(invalid))).toThrow('Save inválido');
    invalid.career.league.teams[0].identity!.facts.image.displayUrl = null;
    invalid.career.source!.simulation.fitness = 1000;
    expect(() => decodeSave(encodeSave(invalid))).toThrow('Save inválido');
  });
  it('preserva o último elenco completo em resposta inválida e bloqueia iniciar com elenco insuficiente', async () => {
    const { service, database, selection } = await imported();
    const season = database.seasons()[0], club = season.clubs[0];
    expect(() => database.importClub('demo', selection, { ...club, name: 'Não deve gravar' }, [], 'demo')).toThrow('incompleta');
    expect(database.seasons()[0].clubs[0]).toEqual(club);
    database.importClub('demo', selection, club, club.players.slice(0, 11), 'demo');
    expect(() => service.createCareer([season.id], 1, defaultSimulation)).toThrow('18 a 60');
    expect(database.db.prepare('SELECT COUNT(*) AS count FROM careers').get()).toEqual({ count: 0 });
  });
  it('exige resolver participações históricas duplicadas somente na cópia da carreira', async () => {
    const { service, database, selection } = await imported();
    const season = database.seasons()[0], [first, second] = season.clubs;
    database.importClub('demo', selection, second, [first.players[0], ...second.players.slice(1)], 'season-participants');
    expect(() => service.createCareer([season.id], 1, defaultSimulation)).toThrow('Resolva o clube inicial');
    const career = service.createCareer([season.id], 1, defaultSimulation, { [first.players[0].id]: first.id });
    expect(career.league.teams[1].squad).toHaveLength(24);
    expect(database.seasons()[0].clubs[1].players).toHaveLength(25);
    expect(new Set(career.league.teams.flatMap((t) => t.squad.map((p) => p.id))).size).toBe(499);
  });
  it('retoma após reiniciar o banco, preservando clubes concluídos, cache e registros de erro', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'footbr-import-'));
    const file = join(dir, 'test.sqlite');
    try {
      const database = db(file), provider = new DemoProvider();
      const original = provider.players.bind(provider);
      vi.spyOn(provider, 'players').mockImplementation(async (team) => { if (team === 102) throw new ProviderError('Conexão interrompida'); return original(team); });
      const service = new ImportService(database, provider), competition = (await provider.competitions())[0];
      const job = await service.start({ competition, year: 2026, division: 1, clubIds: [101, 102] }); await service.idle();
      expect(database.job(job.id).status).toBe('partial');
      expect(database.job(job.id).items[1].error).toBe('Conexão interrompida');
      const doneClubId = database.seasons()[0].clubs[0].id;
      database.cachePut('persistent-test', { value: 1 }, 10000);
      const interrupted = database.job(job.id); interrupted.status = 'running'; interrupted.items[1].status = 'running'; database.saveJob(interrupted);
      database.close();
      const restored = db(file), resumedProvider = new DemoProvider(), spy = vi.spyOn(resumedProvider, 'players');
      expect(restored.job(job.id).status).toBe('interrupted');
      expect(restored.job(job.id).items[1].status).toBe('pending');
      expect(restored.cache('persistent-test')).toEqual({ value: 1 });
      const resumedService = new ImportService(restored, resumedProvider); resumedService.resume(job.id); await resumedService.idle();
      expect(spy).toHaveBeenCalledTimes(1); expect(spy).toHaveBeenCalledWith(102, 1, 2026, true);
      expect(restored.job(job.id).status).toBe('done');
      expect(restored.seasons()[0].clubs[0].id).toBe(doneClubId);
      expect(restored.events(job.id).some((e) => e.level === 'error' && e.message.includes('Conexão interrompida'))).toBe(true);
      expect(restored.events(job.id).some((e) => e.message.includes('Retomada solicitada'))).toBe(true);
    } finally { for (const database of databases.splice(0)) { try { database.close(); } catch { /* Já fechado. */ } } if (dirname(resolve(dir)) !== resolve(tmpdir()) || !basename(dir).startsWith('footbr-import-')) throw new Error('Diretório temporário inválido.'); rmSync(dir, { recursive: true, force: true }); }
  });
});

const apiJson = (response: unknown[], page = 1, total = 1, headers?: HeadersInit) => new Response(JSON.stringify({ errors: [], results: response.length, response, paging: { current: page, total } }), { headers });
describe('integração API-Football com respostas controladas', () => {
  it('pagina perfis, consulta elenco atual, completa perfil ausente e reutiliza cache sem expor a chave', async () => {
    const database = db(), demo = new DemoProvider();
    const demoPlayers = (await demo.players(7)).players;
    const profile = (i: number) => ({ id: demoPlayers[i].externalId, name: `Teste ${i}`, firstname: 'Atleta', lastname: `de Teste ${i}`, age: null, nationality: null, birth: { date: i === 0 ? '2000-01-01' : null }, photo: `https://media.api-sports.io/football/players/${i}.png` });
    const request = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(String(input));
      if (url.pathname === '/players') {
        const page = Number(url.searchParams.get('page')); const indexes = Array.from({ length: 24 }, (_, i) => i).slice((page - 1) * 20, page * 20);
        return apiJson(indexes.map((i) => ({ player: profile(i), statistics: [{ team: { id: 7 }, games: { position: demoPlayers[i].position, number: null } }] })), page, 2);
      }
      if (url.pathname === '/players/squads') return apiJson([{ team: { id: 7 }, players: demoPlayers.map((p, i) => ({ ...profile(i), position: p.position, number: p.number })) }]);
      if (url.pathname === '/players/profiles') return apiJson([{ player: profile(24) }]);
      throw new Error('Endpoint inesperado');
    });
    const provider = new ApiFootballProvider(database, 'CHAVE_PRIVADA_APENAS_TESTE', request, 0);
    const current = await provider.players(7, 71, 2026, true);
    expect(current.kind).toBe('current'); expect(current.players).toHaveLength(25);
    expect(current.players[0]).toMatchObject({ name: 'Atleta de Teste 0', age: null, nationality: null, birthDate: '2000-01-01', number: 1, image: { displayUrl: null, license: null } });
    expect(request).toHaveBeenCalledTimes(4);
    expect(request.mock.calls[0][1]?.headers).toEqual({ 'x-apisports-key': 'CHAVE_PRIVADA_APENAS_TESTE' });
    expect(await provider.players(7, 71, 2026, true)).toEqual(current); expect(request).toHaveBeenCalledTimes(4);
    const historical = await provider.players(7, 71, 2026, false);
    expect(historical.kind).toBe('season-participants'); expect(historical.players).toHaveLength(24); expect(request).toHaveBeenCalledTimes(4);
    expect(JSON.stringify(current)).not.toContain('CHAVE_PRIVADA');
  });
  it('preserva páginas em cache após falha, rejeita respostas incompletas e retoma a consulta', async () => {
    const database = db(); let fail = true;
    const request = vi.fn<typeof fetch>(async (input) => {
      const page = Number(new URL(String(input)).searchParams.get('page'));
      if (page === 2 && fail) throw new Error('conexão encerrada');
      return apiJson([{ player: { id: page, name: `Atleta Teste ${page}` }, statistics: [{ team: { id: 7 }, games: { position: 'Midfielder' } }] }], page, 2);
    });
    const provider = new ApiFootballProvider(database, 'segredo', request, 0);
    await expect(provider.players(7, 71, 2026, false)).rejects.toThrow('Falha de conexão');
    fail = false;
    expect((await provider.players(7, 71, 2026, false)).players).toHaveLength(2);
    expect(request).toHaveBeenCalledTimes(3);
    const incomplete = new ApiFootballProvider(db(), 'segredo', vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ results: 2, response: [], errors: [] }))), 0);
    await expect(incomplete.countries()).rejects.toThrow('incompleta');
  });
  it('persiste pausa de rate limit e evita novas chamadas até a liberação', async () => {
    const database = db(), request = vi.fn<typeof fetch>(async () => new Response('{}', { status: 429, headers: { 'Retry-After': '120', 'x-ratelimit-remaining': '0', 'x-ratelimit-requests-remaining': '50' } }));
    const provider = new ApiFootballProvider(database, 'segredo', request, 0);
    await expect(provider.countries()).rejects.toThrow('Limite de requisições');
    expect(provider.status().blockedUntil).toBeGreaterThan(Date.now() + 110000);
    const restored = new ApiFootballProvider(database, 'segredo', request, 0);
    await expect(restored.countries()).rejects.toThrow('Limite da API'); expect(request).toHaveBeenCalledTimes(1);
  });
  it('serve dados em cache com a cota diária esgotada e oculta erros externos', async () => {
    const request = vi.fn<typeof fetch>(async () => apiJson([{ name: 'Brazil' }], 1, 1, { 'x-ratelimit-requests-remaining': '0' }));
    const provider = new ApiFootballProvider(db(), 'CHAVE_ULTRASSECRETA', request, 0);
    expect(await provider.countries()).toEqual(['Brazil']); expect(await provider.countries()).toEqual(['Brazil']);
    await expect(provider.competitions('Brazil')).rejects.toThrow('Limite da API'); expect(request).toHaveBeenCalledTimes(1);
    const bad = new ApiFootballProvider(db(), 'CHAVE_ULTRASSECRETA', vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ errors: { key: 'CHAVE_ULTRASSECRETA' }, response: [], results: 0 }))), 0);
    await expect(bad.countries()).rejects.toThrow('A API não disponibilizou estes dados');
  });
});

describe('backend HTTP funcional', () => {
  it('executa consulta → importação → imagem licenciada → carreira, preserva imagem antiga e protege mutações entre origens', async () => {
    const database = db(), service = new ImportService(database, new DemoProvider()), server = createAppServer(service);
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const address = server.address() as { port: number }, root = `http://127.0.0.1:${address.port}`;
    const get = async (path: string) => (await fetch(root + path)).json();
    const post = (path: string, body: unknown) => fetch(root + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    try {
      expect(await get('/api/status')).toMatchObject({ provider: 'demo', running: false });
      const competitions = await get('/api/competitions?country=Brazil');
      const teams = await get('/api/teams?league=1&year=2026');
      const response = await post('/api/imports', { selection: { competition: competitions[0], year: 2026, division: 1, clubIds: teams.map((t: { externalId: number }) => t.externalId) } });
      expect(response.status).toBe(202); await service.idle();
      const seasons = await get('/api/catalog'), clubId = seasons[0].clubs[0].id;
      const oldCareer = await (await post('/api/careers', { seasonIds: [seasons[0].id], seed: 5, simulation: defaultSimulation })).json();
      const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jOioAAAAASUVORK5CYII=';
      expect((await post(`/api/images/${clubId}`, { action: 'upload', mime: 'image/png', data: png, license: 'Arte própria de teste' })).status).toBe(400);
      expect((await post(`/api/images/${clubId}`, { action: 'upload', mime: 'image/png', data: png, license: 'Arte própria de teste', confirmed: true })).status).toBe(200);
      const updated = await get('/api/catalog'), mediaUrl = updated[0].clubs[0].image.displayUrl;
      const image = await fetch(root + mediaUrl); expect(image.headers.get('content-type')).toBe('image/png'); expect((await image.arrayBuffer()).byteLength).toBeGreaterThan(8);
      expect(oldCareer.league.teams[0].identity.facts.image.displayUrl).toBeNull();
      const newCareer = await (await post('/api/careers', { seasonIds: [seasons[0].id], seed: 5, simulation: defaultSimulation })).json();
      expect(newCareer.league.teams[0].identity.facts.image.displayUrl).toBe(mediaUrl);
      await post(`/api/images/${clubId}`, { action: 'reset' });
      expect((await get('/api/catalog'))[0].clubs[0].image.displayUrl).toBeNull();
      expect((await fetch(root + mediaUrl)).status).toBe(200); // A imagem congelada da carreira continua disponível.
      expect((await fetch(root + '/api/imports', { method: 'POST', headers: { Origin: 'https://outro-site.test', 'Content-Type': 'application/json' }, body: '{}' })).status).toBe(403);
      expect((await post(`/api/images/${clubId}`, { action: 'upload', mime: 'image/svg+xml', data: Buffer.from('<svg/>').toString('base64'), confirmed: true, license: 'Arquivo de teste' })).status).toBe(400);
    } finally { await service.idle(); server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
  });
});
