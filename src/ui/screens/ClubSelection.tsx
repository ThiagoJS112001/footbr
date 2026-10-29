import type { League } from '../../engine/models';
import { useGameStore } from '../store/gameStore';
import { averageOverall } from '../utils';
import { ClubBadge } from '../components/ClubBadge';
import { PageHeader } from '../components/PageHeader';
import { Icon } from '../components/Icon';
import styles from '../App.module.css';

export function ClubSelection({ league }: { league: League }) {
  const selectTeam = useGameStore((state) => state.selectTeam);
  const navigate = useGameStore((state) => state.navigate);
  return <main className={styles.selection}>
    <div className={styles.selectionTop}><span className={styles.brand}>foot<span className={styles.brandAccent}>br.</span></span><button className={styles.textButton} onClick={() => navigate('menu')}>← Voltar ao início</button></div>
    <PageHeader eyebrow="NOVO JOGO · ESCOLHA DO CLUBE" title="Onde começa a sua história?" description="Um favorito ao título ou um desafio para surpreender. Escolha o clube que você vai comandar."><span className={styles.pill}>{league.teams.length} CLUBES · 1 CAMPEONATO</span></PageHeader>
    <div className={styles.selectionLegend}><span>{league.name}</span><span>Ordenados por força do elenco</span></div>
    <div className={styles.clubGrid}>
      {[...league.teams].sort((a, b) => averageOverall(b) - averageOverall(a)).map((team) => <button className={styles.clubCard} key={team.id} onClick={() => selectTeam(team.id)} aria-label={`Assumir ${team.name}`}>
        <div className={styles.clubCardTop}><ClubBadge name={team.name} size="large" /><span className={styles.overallNumber}>{averageOverall(team).toFixed(1)}<small>OVR MÉDIO</small></span></div>
        <h2>{team.name}</h2><p className={styles.muted}>{team.city}</p>
        <div className={styles.clubCardBottom}><span>Reputação <strong>{team.reputation}<small> / 100</small></strong></span><span className={styles.chooseClub}>Assumir clube <Icon name="arrow" /></span></div>
      </button>)}
    </div>
    <p className={styles.selectionFootnote}>Todos os clubes e jogadores são fictícios. Uma temporada, infinitas possibilidades.</p>
  </main>;
}
