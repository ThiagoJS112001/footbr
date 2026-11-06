import { resolve } from 'node:path';
import { CatalogDatabase } from './database.ts';
import { ApiFootballProvider, DemoProvider } from './provider.ts';
import { ImportService } from './importService.ts';
import { createAppServer } from './http.ts';

const db = new CatalogDatabase(resolve(process.env.FOOTBR_DATABASE ?? '.data/footbr.sqlite'));
const key = process.env.API_FOOTBALL_KEY?.trim() || process.env.APISPORTS_KEY?.trim();
const interval = Number(process.env.API_MIN_INTERVAL_MS ?? 6500);
const provider = key ? new ApiFootballProvider(db, key, fetch, Number.isFinite(interval) ? Math.max(1000, interval) : 6500) : new DemoProvider();
const service = new ImportService(db, provider);
const server = createAppServer(service);
const port = Number(process.env.FOOTBR_PORT ?? 3001);
server.listen(port, '127.0.0.1', () => console.log(`FootBR: http://127.0.0.1:${port} · ${key ? 'API-Football configurada' : 'DEMONSTRAÇÃO FICTÍCIA (sem chave)'}`));
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { server.close(); process.exit(0); });
