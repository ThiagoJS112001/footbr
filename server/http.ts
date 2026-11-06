import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve, sep, extname } from 'node:path';
import type { ImportSelection, SimulationConfig } from '../src/data/catalog.ts';
import type { ImportService } from './importService.ts';

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  if (!(req.headers['content-type'] ?? '').startsWith('application/json')) throw new Error('Envie dados no formato JSON.');
  let length = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) { length += chunk.length; if (length > 3_000_000) throw new Error('Arquivo muito grande. Limite de imagem: 2 MB.'); chunks.push(Buffer.from(chunk)); }
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Dados inválidos.');
  return parsed as Record<string, unknown>;
}
const mimes: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon' };
export function createAppServer(service: ImportService, dist = resolve('dist')) {
  return createServer(async (req, res) => {
    const json = (data: unknown, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const path = url.pathname;
      if (req.method !== 'GET' && req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) { json({ error: 'Origem não autorizada.' }, 403); return; }
      if (req.method === 'GET' && path === '/api/status') return json(service.status());
      if (req.method === 'GET' && path === '/api/countries') return json(await service.provider.countries());
      if (req.method === 'GET' && path === '/api/competitions') return json(await service.provider.competitions((url.searchParams.get('country') ?? 'Brazil').slice(0, 100)));
      if (req.method === 'GET' && path === '/api/teams') {
        const league = Number(url.searchParams.get('league')), year = Number(url.searchParams.get('year'));
        if (!Number.isSafeInteger(league) || league < 1 || !Number.isInteger(year) || year < 1900 || year > 2200) throw new Error('Campeonato e temporada inválidos.');
        return json(await service.provider.teams(league, year));
      }
      if (req.method === 'GET' && path === '/api/catalog') return json(service.database.seasons());
      if (req.method === 'GET' && path === '/api/imports') return json(service.database.jobs());
      const events = /^\/api\/imports\/([\w-]+)\/events$/.exec(path);
      if (req.method === 'GET' && events) { service.database.job(events[1]); return json(service.database.events(events[1])); }
      if (req.method === 'POST' && path === '/api/imports') {
        const body = await readBody(req); return json(await service.start(body.selection as ImportSelection, body.refresh === true), 202);
      }
      const resume = /^\/api\/imports\/([\w-]+)\/resume$/.exec(path);
      if (req.method === 'POST' && resume) { await readBody(req); return json(service.resume(resume[1]), 202); }
      if (req.method === 'POST' && path === '/api/careers') {
        const body = await readBody(req); return json(service.createCareer(body.seasonIds as string[], body.seed as number, body.simulation as SimulationConfig, body.assignments as Record<string, string>), 201);
      }
      const media = /^\/api\/media\/([\w-]+)$/.exec(path);
      if (req.method === 'GET' && media) {
        const file = service.database.media(media[1]);
        if (!file) return json({ error: 'Imagem indisponível.' }, 404);
        res.writeHead(200, { 'Content-Type': file.mime, 'Content-Length': file.bytes.length, 'Cache-Control': 'public, max-age=31536000, immutable' }); res.end(file.bytes); return;
      }
      const image = /^\/api\/images\/([\w-]+)$/.exec(path);
      if (req.method === 'POST' && image) {
        const body = await readBody(req);
        const entity = service.database.seasons().flatMap((s) => s.clubs.flatMap((c) => [c, ...c.players])).find((e) => e.id === image[1]);
        if (!entity) throw new Error('Clube ou jogador não encontrado.');
        if (body.action === 'reset') {
          service.database.db.prepare('DELETE FROM image_overrides WHERE entity_id=?').run(image[1]); return json({ ok: true });
        }
        if (body.confirmed !== true || typeof body.license !== 'string' || body.license.trim().length < 5 || body.license.length > 1000) throw new Error('Informe a autorização/licença e confirme o direito de utilizar a imagem.');
        let displayUrl: string;
        if (body.action === 'authorize') {
          const source = entity.image.sourceUrl;
          if (!source || new URL(source).protocol !== 'https:' || new URL(source).hostname !== 'media.api-sports.io') throw new Error('Referência de imagem do provedor indisponível.');
          // Cópia licenciada imutável: mudanças futuras do link não alteram a carreira.
          let response: Response;
          try { response = await fetch(source, { redirect: 'error', signal: AbortSignal.timeout(20000) }); }
          catch { throw new Error('Não foi possível obter a imagem. Use um arquivo próprio licenciado.'); }
          if (!response.ok || !response.body) throw new Error('Imagem da fonte indisponível.');
          const chunks: Uint8Array[] = []; let length = 0;
          const reader = response.body.getReader();
          try { while (true) { const { done, value } = await reader.read(); if (done) break; length += value.length; if (length > 2_000_000) throw new Error('A imagem da fonte excede 2 MB.'); chunks.push(value); } }
          finally { await reader.cancel(); }
          const bytes = Buffer.concat(chunks), mime = (response.headers.get('content-type') ?? '').split(';')[0].trim();
          validateImage(bytes, mime);
          displayUrl = service.database.addMedia(mime, bytes, body.license.trim());
        } else if (body.action === 'upload') {
          if (typeof body.data !== 'string' || typeof body.mime !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(body.data)) throw new Error('Arquivo inválido.');
          const bytes = Buffer.from(body.data, 'base64');
          validateImage(bytes, body.mime);
          displayUrl = service.database.addMedia(body.mime, bytes, body.license.trim());
        } else throw new Error('Ação de imagem inválida.');
        service.database.setImage(image[1], { sourceUrl: entity.image.sourceUrl, displayUrl, license: body.license.trim() });
        return json({ ok: true });
      }
      if (path.startsWith('/api/')) return json({ error: 'Rota não encontrada.' }, 404);
      if (req.method === 'GET') return serveStatic(dist, path, res);
      json({ error: 'Método não permitido.' }, 405);
    } catch (error) { json({ error: error instanceof Error && !(error instanceof SyntaxError) ? error.message : 'Dados JSON inválidos.' }, 400); }
  });
}
function validateImage(bytes: Buffer, mime: string) {
  const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp = bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
  if (!bytes.length || bytes.length > 2_000_000 || !(mime === 'image/png' && png || mime === 'image/jpeg' && jpeg || mime === 'image/webp' && webp)) throw new Error('Use PNG, JPEG ou WebP válido de até 2 MB.');
}
function serveStatic(dist: string, path: string, res: ServerResponse) {
  const root = resolve(dist);
  const target = resolve(root, `.${decodeURIComponent(path)}`);
  if (target !== root && !target.startsWith(root + sep)) { res.writeHead(403); res.end(); return; }
  const file = existsSync(target) && statSync(target).isFile() ? target : extname(path) ? '' : resolve(root, 'index.html');
  if (!file || !existsSync(file)) { res.writeHead(404); res.end('Execute npm run build para gerar a interface.'); return; }
  res.writeHead(200, { 'Content-Type': mimes[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' }); res.end(readFileSync(file));
}
