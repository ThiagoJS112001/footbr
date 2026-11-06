import { useEffect, useState } from 'react';
import type { CatalogSeason, ClubFacts, CompetitionOption, ImportJob, ImportStatus } from '../../data/catalog';
import { useGameStore } from '../store/gameStore';
import { dataRequest } from '../dataClient';
import { Brand } from '../components/Brand';
import { ClubBadge } from '../components/ClubBadge';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { CatalogReview } from './import/CatalogReview';
import { ImportedCareerForm } from './import/ImportedCareerForm';
import { ImportAudit } from './import/ImportAudit';
import styles from '../App.module.css';
import css from './import/Import.module.css';

const statusLabels = { pending: 'Na fila', running: 'Importando', done: 'Concluída', partial: 'Concluída com erros', interrupted: 'Interrompida' };
export function DataImport() {
  const navigate = useGameStore((s) => s.navigate);
  const [status, setStatus] = useState<ImportStatus | null>(null);
  const [countries, setCountries] = useState<string[]>([]);
  const [country, setCountry] = useState('Brazil');
  const [competitions, setCompetitions] = useState<CompetitionOption[]>([]);
  const [competitionId, setCompetitionId] = useState('');
  const [year, setYear] = useState('');
  const [division, setDivision] = useState<1 | 2>(1);
  const [teams, setTeams] = useState<ClubFacts[]>([]);
  const [chosen, setChosen] = useState<number[]>([]);
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [catalog, setCatalog] = useState<CatalogSeason[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(false);
  const competition = competitions.find((c) => String(c.externalId) === competitionId);
  const running = status?.running || jobs.some((j) => ['pending', 'running'].includes(j.status));
  const fail = (e: unknown) => setError(e instanceof Error ? e.message : 'Não foi possível concluir a ação.');
  async function reload(includeCountries = false) {
    const calls = [dataRequest<ImportStatus>('/status').then(setStatus), dataRequest<ImportJob[]>('/imports').then(setJobs), dataRequest<CatalogSeason[]>('/catalog').then(setCatalog)];
    if (includeCountries) calls.push(dataRequest<string[]>('/countries').then(setCountries));
    const results = await Promise.allSettled(calls);
    const failure = results.find((r) => r.status === 'rejected');
    if (failure?.status === 'rejected') throw failure.reason;
  }
  useEffect(() => { let active = true; reload(true).catch((e) => { if (active) fail(e); }); return () => { active = false; }; }, []);
  useEffect(() => {
    if (!status) return;
    const abort = new AbortController();
    setCompetitions([]); setCompetitionId(''); setYear(''); setTeams([]); setChosen([]);
    dataRequest<CompetitionOption[]>(`/competitions?country=${encodeURIComponent(country)}`, undefined, abort.signal).then((data) => {
      setCompetitions(data); const first = data[0]; setCompetitionId(first ? String(first.externalId) : ''); setYear(first ? String(first.seasons.find((s) => s.current)?.year ?? first.seasons.at(-1)?.year ?? '') : '');
    }).catch((e) => { if (!abort.signal.aborted) fail(e); });
    return () => abort.abort();
  }, [country, status?.provider]);
  useEffect(() => {
    if (!running) return;
    let active = true, pending = false;
    const timer = setInterval(() => { if (!pending) { pending = true; reload().catch((e) => { if (active) fail(e); }).finally(() => { pending = false; }); } }, 1500);
    return () => { active = false; clearInterval(timer); };
  }, [running]);
  const action = async (fn: () => Promise<void>) => { setBusy(true); setError(null); try { await fn(); } catch (e) { fail(e); } finally { setBusy(false); } };
  async function consultTeams() {
    if (!competition) return;
    const teams = await dataRequest<ClubFacts[]>(`/teams?league=${competition.externalId}&year=${year}`);
    setTeams(teams); setChosen(teams.map((t) => t.externalId));
    if (!teams.length) setError('Nenhum clube disponível nesta temporada ou no seu plano.');
  }
  async function startImport() {
    if (!competition) return;
    await dataRequest('/imports', { selection: { competition, year: Number(year), division, clubIds: chosen }, refresh }); await reload();
  }
  const existing = catalog.filter((s) => s.provider === status?.provider && s.competition.externalId === competition?.externalId && s.year === Number(year)).flatMap((s) => s.clubs.map((c) => c.externalId));
  return <main className={`${styles.selection} ${css.page}`}>
    <div className={styles.selectionTop}><Brand /><button className={styles.textButton} onClick={() => navigate('menu')}>← Voltar ao início</button></div>
    <PageHeader eyebrow="ADMINISTRAÇÃO · BASE INICIAL" title="Importação de Dados" description="Escolha a competição, importe os elencos e crie uma carreira independente." />
    <div className={css.notice}><strong>{status ? status.provider === 'demo' ? 'DEMONSTRAÇÃO FICTÍCIA · sem chave configurada' : 'API-Football · conexão pelo servidor' : 'Conectando ao backend…'}</strong><p>{status?.provider === 'demo' ? 'Os nomes e elencos abaixo são fictícios. Configure API_FOOTBALL_KEY no .env do servidor para consultar dados reais.' : 'A chave permanece no servidor. A disponibilidade de países, temporadas e perfis depende da cobertura do plano.'}</p>
      {status?.provider === 'api-football' && <p>Cota diária restante: {status.dailyRemaining ?? 'a consultar'} · Cota por minuto restante: {status.minuteRemaining ?? 'a consultar'}{status.blockedUntil > Date.now() && ` · Retomar após ${new Date(status.blockedUntil).toLocaleString('pt-BR')}`}</p>}
    </div>
    {error && <div className={styles.error} role="alert">{error} <button className={styles.textButton} disabled={busy} onClick={() => action(() => reload(true))}>Tentar novamente</button></div>}
    <Panel title="1. Consultar campeonato" icon="standings"><div className={css.body}>
      <div className={css.formGrid}>
        <label>País<select value={country} disabled={busy || !!running || !countries.length} onChange={(e) => setCountry(e.target.value)}>{countries.map((c) => <option key={c} value={c}>{c === 'Brazil' ? 'Brasil' : c}</option>)}</select></label>
        <label>Campeonato<select value={competitionId} disabled={busy || !!running || !competitions.length} onChange={(e) => { const c = competitions.find((c) => String(c.externalId) === e.target.value)!; setCompetitionId(e.target.value); setYear(String(c.seasons.find((s) => s.current)?.year ?? c.seasons.at(-1)?.year)); setDivision(c.externalId === 72 || status?.provider === 'demo' && c.externalId === 2 ? 2 : 1); setTeams([]); setChosen([]); }}>{competitions.map((c) => <option key={c.externalId} value={c.externalId}>{c.name}</option>)}</select></label>
        <label>Temporada<select value={year} disabled={busy || !!running || !competition} onChange={(e) => { setYear(e.target.value); setTeams([]); setChosen([]); }}>{[...(competition?.seasons ?? [])].sort((a, b) => b.year - a.year).map((s) => <option key={s.year} value={s.year}>{s.year}{s.current ? ' · atual' : ' · histórica'}</option>)}</select></label>
        <label>Divisão no FootBR<select value={division} disabled={busy || !!running} onChange={(e) => setDivision(Number(e.target.value) as 1 | 2)}><option value={1}>Divisão 1</option><option value={2}>Divisão 2</option></select></label>
      </div>
      <p className={css.help}>A divisão no jogo é uma configuração sua. Temporadas atuais usam o elenco atual; temporadas históricas usam participantes registrados na competição. As datas e idades dos perfis podem refletir a consulta atual.</p>
      <button className={styles.secondaryButton} disabled={busy || !!running || !competition || !year} onClick={() => action(consultTeams)}>Consultar clubes</button>
    </div></Panel>
    {teams.length > 0 && <Panel title={`2. Selecionar clubes · ${chosen.length} de ${teams.length}`} icon="squad"><div className={css.body}>
      <div className={css.actions}><button className={styles.textButton} disabled={busy || !!running} onClick={() => setChosen(teams.map((t) => t.externalId))}>Selecionar todos</button><button className={styles.textButton} disabled={busy || !!running} onClick={() => setChosen([])}>Limpar seleção</button></div>
      <div className={css.teamGrid}>{teams.map((t) => <label key={t.externalId} className={css.teamOption}><input type="checkbox" checked={chosen.includes(t.externalId)} disabled={busy || !!running} onChange={() => setChosen((ids) => ids.includes(t.externalId) ? ids.filter((id) => id !== t.externalId) : [...ids, t.externalId])} /><ClubBadge name={t.name} image={t.image} /><span><strong>{t.name}</strong><small>{t.city ?? 'Cidade não informada'} · {existing.includes(t.externalId) ? 'Atualizar registro existente' : 'Novo registro'}</small></span></label>)}</div>
      <label className={css.check}><input type="checkbox" checked={refresh} disabled={busy || !!running} onChange={(e) => setRefresh(e.target.checked)} />Consultar novamente a API, ignorando o cache (consome novas requisições)</label>
      <p className={css.help}>Cache padrão: 24 horas; perfis adicionais: 7 dias. A importação atualiza os mesmos IDs internos. Falhas preservam o último elenco completo de cada clube. Perfis ausentes podem exigir chamadas adicionais.</p>
      <button className={styles.primaryButton} disabled={busy || !!running || !chosen.length} onClick={() => action(startImport)}>{busy ? 'Preparando…' : `Importar ${chosen.length} clube(s) e jogadores`}</button>
    </div></Panel>}
    {jobs.length > 0 && <Panel title="3. Progresso e registros de importação" icon="history"><div className={css.body}>
      {jobs.slice(0, 10).map((job, index) => { const complete = job.items.filter((i) => i.status === 'done').length; const processed = job.items.filter((i) => i.status === 'done' || i.status === 'error').length;
        return <details key={job.id} className={css.job} open={index === 0 ? true : undefined}><summary><strong>{job.selection.competition.name} · {job.selection.year}</strong><span>{statusLabels[job.status]} · {complete}/{job.items.length} clubes</span></summary><p className={css.help}>{job.provider === 'demo' ? 'Demonstração fictícia' : 'API-Football'} · {new Date(job.updatedAt).toLocaleString('pt-BR')} · Registro {job.id}</p><progress max={job.items.length} value={processed} aria-label={`Progresso da importação ${job.selection.year}`} />
          <ul className={css.log}>{job.items.map((i) => <li key={i.externalId}><strong>{i.name}</strong><span>{i.status === 'done' ? `${i.players} jogadores importados` : i.status === 'error' ? 'Erro' : i.status === 'running' ? 'Consultando jogadores…' : 'Aguardando'}</span>{i.error && <p className={styles.error}>{i.error}</p>}{i.warnings.map((w) => <p className={css.help} key={w}>{w}</p>)}</li>)}</ul>
          {['partial', 'interrupted'].includes(job.status) && <button className={styles.secondaryButton} disabled={busy || !!running || job.provider !== status?.provider} onClick={() => action(async () => { await dataRequest(`/imports/${job.id}/resume`, {}); await reload(); })}>Retomar pendências e erros</button>}
          <ImportAudit jobId={job.id} />
        </details>; })}
    </div></Panel>}
    {catalog.length > 0 && <><CatalogReview seasons={catalog} onUpdated={reload} /><ImportedCareerForm seasons={catalog} disabled={busy || !!running} /></>}
  </main>;
}
