import { CatalogDatabase } from '../server/database';
import { ApiFootballProvider, DemoProvider } from '../server/provider';
import { ImportService } from '../server/importService';
import { createAppServer } from '../server/http';

export function openDesktopServer(database: string, dist: string, token: string) {
  const db = new CatalogDatabase(database);
  const key = process.env.API_FOOTBALL_KEY?.trim() || process.env.APISPORTS_KEY?.trim();
  const provider = key ? new ApiFootballProvider(db, key, fetch, 6500) : new DemoProvider();
  return createAppServer(new ImportService(db, provider), dist, token);
}
