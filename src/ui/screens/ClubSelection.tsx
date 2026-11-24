import type { League } from '../../engine/models';
import { useState } from 'react';
import { ArrowDownUp, Search } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { averageOverall } from '../utils';
import { ClubBadge } from '../components/ClubBadge';
import { Icon } from '../components/Icon';
import { Brand } from '../components/Brand';
import styles from '../App.module.css';
import { clubProfile, profileInfo } from '../../engine/models/personality';

const sortLabels = { strength: 'Força do elenco', reputation: 'Reputação', name: 'Nome do clube' };
const normalize = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const series = ['A', 'B', 'C'];

export function ClubSelection({ league: primary }: { league: League }) {
  const [divisionId, setDivisionId] = useState(primary.id);
  const [sort, setSort] = useState<keyof typeof sortLabels>('strength');
  const [query, setQuery] = useState('');
  const extra = useGameStore((s) => s.extraLeague);
  const otherLeague = useGameStore((state) => state.otherLeague);
  const divisions = [primary, otherLeague, extra].filter((item): item is League => !!item).sort((a, b) => a.teams[0].division - b.teams[0].division);
  const league = divisions.find((item) => item.id === divisionId) ?? primary;
  const selectTeam = useGameStore((state) => state.selectTeam);
  const navigate = useGameStore((state) => state.navigate);
  const source = useGameStore((state) => state.source);
  const error = useGameStore((state) => state.error);
  const term = normalize(query.trim());
  const clubs = league.teams
    .filter((team) => normalize(`${team.name} ${team.city}`).includes(term))
    .map((team) => ({ team, overall: averageOverall(team), profile: profileInfo[clubProfile(team)] }))
    .sort((a, b) => {
      if (sort === 'strength') return b.overall - a.overall;
      if (sort === 'reputation') return b.team.reputation - a.team.reputation;
      return a.team.name.localeCompare(b.team.name, 'pt-BR');
    });
  return <main className={styles.selection}>
    <header className={styles.selectionTop}><Brand /><button className={styles.textButton} onClick={() => navigate('menu')}>← Voltar ao início</button></header>
    <div className={styles.selectionIntro}>
      <span className={styles.eyebrow}>NOVO JOGO · ESCOLHA DO CLUBE</span>
      <h1>Onde começa a sua história?</h1>
      <p>Escolha uma liga, filtre os clubes e assuma o comando do seu time.</p>
    </div>
    <div className={styles.selectionFilters}>
      <div><Icon name="cup" /><label>Liga / Competição
        <select value={league.id} onChange={(event) => setDivisionId(event.target.value)}>
          {divisions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label></div>
      <div><span aria-hidden="true">🇧🇷</span><span className={styles.selectionCountry}>País<strong>Brasil</strong></span></div>
      <div><ArrowDownUp aria-hidden="true" /><label>Ordenar por
        <select value={sort} onChange={(event) => setSort(event.target.value as keyof typeof sortLabels)}>
          <option value="strength">{sortLabels.strength}</option>
          <option value="reputation">{sortLabels.reputation}</option>
          <option value="name">{sortLabels.name}</option>
        </select>
      </label></div>
      <label className={styles.selectionSearch}><Search size={18} aria-hidden="true" />
        <input type="search" aria-label="Buscar clube" placeholder="Buscar clube..." value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      <output>{clubs.length} {clubs.length === 1 ? 'clube' : 'clubes'} · 1 competição</output>
    </div>
    <nav className={styles.selectionDivisions} aria-label="Divisões">
      {divisions.map((item) => <button key={item.id} aria-pressed={league.id === item.id} onClick={() => setDivisionId(item.id)}>
        Série {series[item.teams[0].division - 1]}
      </button>)}
    </nav>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.selectionLegend}><h2>{league.name}</h2><span>Ordem por {sortLabels[sort].toLocaleLowerCase('pt-BR')}</span></div>
    {!clubs.length && <p className={styles.selectionEmpty}>Nenhum clube encontrado.</p>}
    <div className={styles.clubGrid}>
      {clubs.map(({ team, overall, profile }) => <button className={styles.clubCard} key={team.id} onClick={() => selectTeam(team.id)} aria-label={`Assumir ${team.name}`}>
        <div className={styles.clubCardTop}>
          <ClubBadge name={team.name} image={team.identity?.facts.image} size="large" />
          <div>
            <h3>{team.name}</h3>
            <p className={styles.muted}>{team.city} · Série {series[team.division - 1]}</p>
            <span className={styles.traitBadge} title={profile.description}>{profile.label}</span>
          </div>
          <span className={styles.overallNumber}>{overall.toFixed(1)}<small>FORÇA MÉDIA</small></span>
        </div>
        <div className={styles.clubCardBottom}><span>Reputação <strong>{team.reputation}<small> / 100</small></strong></span><span className={styles.chooseClub}>Assumir clube <Icon name="arrow" /></span></div>
      </button>)}
    </div>
    <p className={styles.selectionFootnote}>{source ? `${source.importedClubs} clubes importados · ${source.fictionalClubs} clubes fictícios complementares. Atributos, finanças e contratos são simulação. Base independente: atualizações da API não alteram esta carreira.` : 'Todos os clubes e jogadores são fictícios. Uma temporada, infinitas possibilidades.'}</p>
  </main>;
}
