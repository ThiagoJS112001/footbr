import { useMemo, useState } from 'react';
import type { CatalogSeason, SimulationConfig } from '../../../data/catalog';
import { defaultSimulation } from '../../../data/catalog';
import type { Career } from '../../../engine/career/career';
import { useGameStore } from '../../store/gameStore';
import { dataRequest } from '../../dataClient';
import { Panel } from '../../components/Panel';
import styles from '../../App.module.css';
import css from './Import.module.css';

const labels: Record<keyof SimulationConfig, string> = { minOverall: 'Força-alvo mínima (1–95)', maxOverall: 'Força-alvo máxima (1–95)', potentialBonus: 'Bônus de potencial (0–30)', fitness: 'Condição física inicial (1–100)', morale: 'Moral inicial (0–100)', unknownAge: 'Idade de simulação quando ausente (16–50)' };
export function ImportedCareerForm({ seasons, disabled }: { seasons: CatalogSeason[]; disabled?: boolean }) {
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  const [simulation, setSimulation] = useState({ ...defaultSimulation });
  const [seed, setSeed] = useState(2026);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const chosen = seasons.filter((s) => s.id === first || s.id === second);
  const clubs = chosen.flatMap((s) => s.clubs);
  const conflicts = useMemo(() => {
    const memberships = new Map<string, { name: string; clubs: { id: string; name: string }[] }>();
    for (const s of seasons.filter((s) => s.id === first || s.id === second)) for (const c of s.clubs) for (const p of c.players) {
      const prior = memberships.get(p.id); memberships.set(p.id, { name: p.name, clubs: [...(prior?.clubs ?? []), { id: c.id, name: c.name }] });
    }
    return [...memberships.entries()].filter(([, value]) => value.clubs.length > 1);
  }, [seasons, first, second]);
  const unresolved = conflicts.some(([id, value]) => !value.clubs.some((c) => c.id === assignments[id]));
  async function create() {
    setBusy(true); setError('');
    try {
      const career = await dataRequest<Career>('/careers', { seasonIds: chosen.map((s) => s.id), seed, simulation, assignments });
      useGameStore.getState().startImportedGame(career);
      if (useGameStore.getState().error) setError(useGameStore.getState().error!);
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível criar a carreira.'); }
    finally { setBusy(false); }
  }
  return <Panel title="5. Nova carreira com base importada" icon="match"><div className={css.body}>
    <p className={css.help}>A base original permanece no catálogo. Transferências, evolução, salários e resultados pertencem somente à nova carreira. Escolha o mesmo ano nas duas divisões. Calendários e regulamentos são os do FootBR, simulados. Saves anteriores continuam disponíveis nos slots e na exportação. Idades são calculadas para 12 de janeiro da temporada quando há nascimento; em bases históricas sem nascimento, usa-se a idade de simulação configurada.</p>
    <div className={css.formGrid}>{([1, 2] as const).map((division) => <label key={division}>Base da Divisão {division}<select value={division === 1 ? first : second} disabled={busy || disabled} onChange={(e) => { (division === 1 ? setFirst : setSecond)(e.target.value); setAssignments({}); }}><option value="">20 clubes fictícios</option>{seasons.filter((s) => s.division === division).map((s) => <option key={s.id} value={s.id}>{s.competition.name} · {s.year} · {s.clubs.length} importados</option>)}</select></label>)}</div>
    {clubs.length > 0 && <div className={css.notice}><strong>{clubs.length} clubes importados + {Math.max(0, 40 - clubs.length)} clubes fictícios complementares</strong><p>O formato atual do FootBR mantém 20 clubes por divisão e 38 rodadas. Clubes fictícios completam as vagas ainda não importadas. Para uma base completa, importe 20 clubes em cada divisão. Nenhum atleta real será inventado para completar elencos.</p></div>}
    {chosen.some((s) => s.provider === 'demo') && <p className={css.help}>Esta seleção contém dados de DEMONSTRAÇÃO FICTÍCIA.</p>}
    {conflicts.length > 0 && <div className={css.formGrid}>{conflicts.map(([id, p]) => <label key={id}>Clube inicial de {p.name}<select value={assignments[id] ?? ''} onChange={(e) => setAssignments((old) => ({ ...old, [id]: e.target.value }))}><option value="">Escolha o vínculo na nova carreira</option>{p.clubs.map((c) => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label>)}</div>}
    <details><summary>Atributos de simulação · configuração</summary><p className={css.help}>Força, potencial, habilidade técnica (meio-campo), finalização, passe, defesa, velocidade, resistência, moral e condição física são gerados pelo FootBR. Não são avaliações reais da API. As posições amplas são distribuídas em funções táticas. Finanças e contratos também são fictícios. O motor utiliza atributos de 1 a 99; condição e moral vão até 100.</p><div className={css.formGrid}>
      {(Object.keys(labels) as (keyof SimulationConfig)[]).map((key) => <label key={key}>{labels[key]}<input type="number" step={1} value={Number.isNaN(simulation[key]) ? '' : simulation[key]} onChange={(e) => setSimulation((old) => ({ ...old, [key]: e.target.value === '' ? NaN : Number(e.target.value) }))} /></label>)}
      <label>Semente da simulação<input type="number" min={0} max={4294967295} step={1} value={Number.isNaN(seed) ? '' : seed} onChange={(e) => setSeed(e.target.value === '' ? NaN : Number(e.target.value))} /></label>
    </div></details>
    <button className={styles.primaryButton} disabled={busy || disabled || !chosen.length || unresolved} onClick={create}>{busy ? 'Criando cópia independente…' : 'Criar carreira e escolher clube'}</button>
    {error && <p className={styles.error} role="alert">{error}</p>}
  </div></Panel>;
}
