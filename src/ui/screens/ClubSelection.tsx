import type { League } from '../../engine/models';
import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { averageOverall } from '../utils';
import { ClubBadge } from '../components/ClubBadge';
import { PageHeader } from '../components/PageHeader';
import { Icon } from '../components/Icon';
import { Brand } from '../components/Brand';
import styles from '../App.module.css';
import { clubProfile, profileInfo } from '../../engine/models/personality';

export function ClubSelection({ league: primary }: { league: League }) {
  const [divisionId, setDivisionId] = useState(primary.id);
  const extra = useGameStore((s) => s.extraLeague);
  const otherLeague = useGameStore((state) => state.otherLeague);
  const divisions = [primary, otherLeague, extra].filter((item): item is League => !!item).sort((a, b) => a.teams[0].division - b.teams[0].division);
  const league = divisions.find((item) => item.id === divisionId) ?? primary;
  const selectTeam = useGameStore((state) => state.selectTeam);
  const navigate = useGameStore((state) => state.navigate);
  const source = useGameStore((state) => state.source);
  const error = useGameStore((state) => state.error);
  return <main className={styles.selection}>
    <div className={styles.selectionTop}><Brand /><button className={styles.textButton} onClick={() => navigate('menu')}>← Voltar ao início</button></div>
    <PageHeader eyebrow="NOVO JOGO · ESCOLHA DO CLUBE" title="Onde começa a sua história?" description="Um favorito ao título ou um desafio para surpreender. Escolha o clube que você vai comandar."><span className={styles.pill}>{league.teams.length} CLUBES · 1 CAMPEONATO</span></PageHeader>
    <div className={styles.controls}>{divisions.map((item) => <button key={item.id} className={league.id === item.id ? styles.primaryButton : styles.secondaryButton} onClick={() => setDivisionId(item.id)}>Divisão {item.teams[0].division}</button>)}</div>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.selectionLegend}><span>{league.name}</span><span>Ordenados por força do elenco</span></div>
    <div className={styles.clubGrid}>
      {[...league.teams].sort((a, b) => averageOverall(b) - averageOverall(a)).map((team) => <button className={styles.clubCard} key={team.id} onClick={() => selectTeam(team.id)} aria-label={`Assumir ${team.name}`}>
        <div className={styles.clubCardTop}><ClubBadge name={team.name} image={team.identity?.facts.image} size="large" /><span className={styles.overallNumber}>{averageOverall(team).toFixed(1)}<small>FORÇA MÉDIA</small></span></div>
        <h2>{team.name}</h2><p className={styles.muted}>{team.city} · {team.identity ? team.identity.provider === 'demo' ? 'Demonstração fictícia' : 'Identidade importada' : 'Clube fictício'}</p>
        <span className={styles.traitBadge} title={profileInfo[clubProfile(team)].description}>{profileInfo[clubProfile(team)].label}</span>
        <div className={styles.clubCardBottom}><span>Reputação <strong>{team.reputation}<small> / 100</small></strong></span><span className={styles.chooseClub}>Assumir clube <Icon name="arrow" /></span></div>
      </button>)}
    </div>
    <p className={styles.selectionFootnote}>{source ? `${source.importedClubs} clubes importados · ${source.fictionalClubs} clubes fictícios complementares. Atributos, finanças e contratos são simulação. Base independente: atualizações da API não alteram esta carreira.` : 'Todos os clubes e jogadores são fictícios. Uma temporada, infinitas possibilidades.'}</p>
  </main>;
}
