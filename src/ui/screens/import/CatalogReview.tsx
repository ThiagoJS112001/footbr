import { useState } from 'react';
import type { CatalogClub, CatalogPlayer, CatalogSeason, ImageRef } from '../../../data/catalog';
import { dataRequest } from '../../dataClient';
import { Panel } from '../../components/Panel';
import { DataTable } from '../../components/DataTable';
import { ClubBadge } from '../../components/ClubBadge';
import { LicensedImage } from '../../components/LicensedImage';
import styles from '../../App.module.css';
import css from './Import.module.css';

const known = (value: string | number | null) => value ?? 'Não informado';
export function CatalogReview({ seasons, onUpdated }: { seasons: CatalogSeason[]; onUpdated: () => Promise<void> }) {
  const [seasonId, setSeasonId] = useState('');
  const [clubId, setClubId] = useState('');
  const [playerId, setPlayerId] = useState('');
  const season = seasons.find((s) => s.id === seasonId) ?? seasons[0];
  const club = season.clubs.find((c) => c.id === clubId) ?? season.clubs[0];
  const player = club?.players.find((p) => p.id === playerId);
  return <Panel title="4. Catálogo importado · identidades e imagens" icon="shield"><div className={css.body}>
    <div className={css.formGrid}>
      <label>Base para consultar<select value={season.id} onChange={(e) => { setSeasonId(e.target.value); setClubId(''); setPlayerId(''); }}>{seasons.map((s) => <option key={s.id} value={s.id}>{s.competition.name} · {s.year} · {s.clubs.length} clubes</option>)}</select></label>
      <label>Clube importado<select value={club?.id ?? ''} onChange={(e) => { setClubId(e.target.value); setPlayerId(''); }}>{season.clubs.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.players.length} jogadores</option>)}</select></label>
    </div>
    {club && <>
      <div className={css.facts}><ClubBadge name={club.name} image={club.image} size="large" /><dl>
        <dt>Clube / abreviação</dt><dd>{club.name} / {known(club.shortName)}</dd><dt>País / cidade</dt><dd>{known(club.country)} / {known(club.city)}</dd>
        <dt>Estádio / capacidade</dt><dd>{known(club.stadium)} / {club.capacity?.toLocaleString('pt-BR') ?? 'Não informada'}</dd><dt>Referência externa</dt><dd>{club.provider} · {club.externalId}</dd><dt>ID interno</dt><dd>{club.id}</dd>
      </dl></div>
      <p className={css.help}>{club.rosterKind === 'season-participants' ? 'Vínculos de participação na temporada histórica. Não representam necessariamente o elenco final nem o clube atual do atleta.' : club.rosterKind === 'demo' ? 'Todos os dados desta base são fictícios de demonstração.' : 'Elenco atual consultado no provedor.'} Atualizado em {new Date(club.updatedAt).toLocaleString('pt-BR')}. Contratos e salários reais não são fornecidos por esta integração.</p>
      <DataTable caption={`Jogadores importados de ${club.name}`} rows={club.players} pageSize={10} getRowId={(p) => p.id} columns={[
        { id: 'name', label: 'Jogador', sortValue: (p) => p.name, render: (p) => <button className={`${styles.textButton} ${css.tableName}`} onClick={() => setPlayerId(p.id)}><LicensedImage image={p.image} fallback={null} />{p.name}</button> },
        { id: 'age', label: 'Idade no perfil', render: (p) => known(p.age) },
        { id: 'birth', label: 'Nascimento', render: (p) => known(p.birthDate) },
        { id: 'nationality', label: 'Nacionalidade', render: (p) => known(p.nationality) },
        { id: 'position', label: 'Posição na fonte', render: (p) => known(p.position) },
        { id: 'number', label: 'Camisa', render: (p) => known(p.number) },
        { id: 'external', label: 'ID externo', render: (p) => p.externalId },
      ]} />
      <div className={css.actions}><button className={player ? styles.secondaryButton : styles.primaryButton} onClick={() => setPlayerId('')}>Imagem do clube</button>{player && <strong>Foto de {player.name}</strong>}</div>
      <ImageEditor key={player?.id ?? club.id} entity={player ?? club} onUpdated={onUpdated} />
    </>}
  </div></Panel>;
}
function ImageEditor({ entity, onUpdated }: { entity: CatalogClub | CatalogPlayer; onUpdated: () => Promise<void> }) {
  const [license, setLicense] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const permitted = confirmed && license.trim().length >= 5;
  async function update(action: 'upload' | 'authorize' | 'reset') {
    setBusy(true); setError(''); setMessage('');
    try {
      let data: string | undefined;
      if (action === 'upload') {
        if (!file || file.size > 2_000_000 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Escolha uma imagem PNG, JPEG ou WebP de até 2 MB.');
        data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error('Não foi possível ler a imagem.')); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.readAsDataURL(file); });
      }
      await dataRequest(`/images/${entity.id}`, { action, license, confirmed, data, mime: file?.type });
      await onUpdated(); setMessage('Imagem atualizada no catálogo. Carreiras já criadas preservam a imagem anterior.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível salvar a imagem.'); }
    finally { setBusy(false); }
  }
  return <div className={css.imageEditor}>
    <div className={css.actions}><LicensedImage image={entity.image} className={css.imagePreview} fallback={<span className={css.help}>Imagem alternativa em uso</span>} /><strong>{entity.name}</strong></div>
    <p className={css.help}>Referência da fonte: {entity.image.sourceUrl ? <a href={entity.image.sourceUrl} target="_blank" rel="noreferrer">Ver imagem de origem</a> : 'Não disponível'}. {entity.image.license ? `Licença informada: ${entity.image.license}` : 'Direitos de uso não verificados; a imagem externa não é carregada automaticamente.'} A oferta pela API não garante autorização de uso comercial. <a href="https://www.api-football.com/terms" target="_blank" rel="noreferrer">Condições do provedor</a>.</p>
    <label className={css.field}>Licença ou autorização (referência)<input value={license} maxLength={1000} onChange={(e) => setLicense(e.target.value)} placeholder="Ex.: arquivo próprio, autorização do titular ou URL da licença" /></label>
    <label className={css.check}><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />Tenho autorização para utilizar esta imagem no contexto do projeto.</label>
    <label className={css.field}>Arquivo personalizado licenciado<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
    <div className={css.actions}><button className={styles.primaryButton} disabled={busy || !permitted || !file} onClick={() => update('upload')}>Salvar arquivo próprio</button><button className={styles.secondaryButton} disabled={busy || !permitted || !entity.image.sourceUrl} onClick={() => update('authorize')}>Habilitar imagem da fonte</button><button className={styles.textButton} disabled={busy || !entity.image.displayUrl} onClick={() => update('reset')}>Usar imagem alternativa</button></div>
    {message && <p role="status" className={css.help}>{message}</p>}{error && <p role="alert" className={styles.error}>{error}</p>}
  </div>;
}
// Reexportação de tipo facilita integrações futuras sem acoplar o motor ao editor.
export type CatalogImage = ImageRef;
