import type { League } from '../../engine/models';
import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { averageOverall } from '../utils';
import { ClubBadge } from '../components/ClubBadge';
import { PageHeader } from '../components/PageHeader';
import { Icon } from '../components/Icon';
import { Brand } from '../components/Brand';
import styles from '../App.module.css';

export function ClubSelection({ league: primary }: { league: League }) {
  const [alternate, setAlternate] = useState(false);
  const otherLeague = useGameStore((state) => state.otherLeague);
  const league = alternate && otherLeague ? otherLeague : primary;
  const selectTeam = useGameStore((state) => state.selectTeam);
  const navigate = useGameStore((state) => state.navigate);
  const source = useGameStore((state) => state.source);
  return <main className={styles.selection}>
    <div className={styles.selectionTop}><Brand /><button className={styles.textButton} onClick={() => navigate('menu')}>← Voltar ao início</button></div>
    <PageHeader eyebrow="NOVO JOGO · ESCOLHA DO CLUBE" title="Onde começa a sua história?" description="Um favorito ao título ou um desafio para surpreender. Escolha o clube que você vai comandar."><span className={styles.pill}>{league.teams.length} CLUBES · 1 CAMPEONATO</span></PageHeader>
    {otherLeague && <div className={styles.controls}><button className={alternate ? styles.secondaryButton : styles.primaryButton} onClick={() => setAlternate(false)}>Divisão 1</button><button className={alternate ? styles.primaryButton : styles.secondaryButton} onClick={() => setAlternate(true)}>Divisão 2</button></div>}
    <div className={styles.selectionLegend}><span>{league.name}</span><span>Ordenados por força do elenco</span></div>
    <div className={styles.clubGrid}>
      {[...league.teams].sort((a, b) => averageOverall(b) - averageOverall(a)).map((team) => <button className={styles.clubCard} key={team.id} onClick={() => selectTeam(team.id)} aria-label={`Assumir ${team.name}`}>
        <div className={styles.clubCardTop}><ClubBadge name={team.name} image={team.identity?.facts.image} size="large" /><span className={styles.overallNumber}>{averageOverall(team).toFixed(1)}<small>FORÇA MÉDIA</small></span></div>
        <h2>{team.name}</h2><p className={styles.muted}>{team.city} · {team.identity ? team.identity.provider === 'demo' ? 'Demonstração fictícia' : 'Identidade importada' : 'Clube fictício'}</p>
        <div className={styles.clubCardBottom}><span>Reputação <strong>{team.reputation}<small> / 100</small></strong></span><span className={styles.chooseClub}>Assumir clube <Icon name="arrow" /></span></div>
      </button>)}
    </div>
    <p className={styles.selectionFootnote}>{source ? `${source.importedClubs} clubes importados · ${source.fictionalClubs} clubes fictícios complementares. Atributos, finanças e contratos são simulação. Base independente: atualizações da API não alteram esta carreira.` : 'Todos os clubes e jogadores são fictícios. Uma temporada, infinitas possibilidades.'}</p>
  </main>;
}
