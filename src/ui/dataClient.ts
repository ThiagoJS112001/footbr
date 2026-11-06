export async function dataRequest<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try { response = await fetch(`/api${path}`, { signal, ...(body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) }); }
  catch (error) { if (signal?.aborted) throw error; throw new Error('Backend indisponível. Inicie o FootBR com npm run dev ou npm start.'); }
  const contentType = response.headers.get('content-type');
  if (!contentType?.includes('application/json')) throw new Error('Backend de importação indisponível. Inicie com npm run dev.');
  const data: unknown = await response.json();
  if (!response.ok) throw new Error(typeof data === 'object' && data && 'error' in data ? String(data.error) : 'Não foi possível concluir a consulta.');
  return data as T;
}
