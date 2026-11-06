import { useState } from 'react';
import type { ImportEvent } from '../../../data/catalog';
import { dataRequest } from '../../dataClient';
import styles from '../../App.module.css';
import css from './Import.module.css';

export function ImportAudit({ jobId }: { jobId: string }) {
  const [events, setEvents] = useState<ImportEvent[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function load() {
    setBusy(true); setError('');
    try { setEvents(await dataRequest<ImportEvent[]>(`/imports/${jobId}/events`)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Histórico indisponível.'); }
    finally { setBusy(false); }
  }
  return <div><button className={styles.textButton} disabled={busy} onClick={load}>{events ? 'Atualizar histórico de tentativas' : 'Ver histórico de tentativas'}</button>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {events && <ul className={css.log}>{events.map((event) => <li key={event.id}><span>{new Date(event.createdAt).toLocaleString('pt-BR')} · {event.level === 'error' ? 'Erro' : 'Registro'}</span><p>{event.message}</p></li>)}</ul>}
  </div>;
}
