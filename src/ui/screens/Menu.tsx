import { useGameStore } from '../store/gameStore';
import { Icon } from '../components/Icon';
import { SaveControls } from '../components/SaveControls';
import { Brand } from '../components/Brand';
import { TacticalPitch } from '../components/TacticalPitch';
import styles from '../App.module.css';

export function Menu() {
  const { startNewGame, selectedTeamId, navigate, error, live } = useGameStore();
  return <main className={styles.menu}>
    <header className={styles.menuHeader}><Brand /><span className={styles.menuLabel}>FUTEBOL. DO SEU JEITO.</span></header>
    <div className={styles.menuContent}>
      <section><span className={styles.pill}><span className={styles.liveDot} /> UMA NOVA TEMPORADA ESPERA POR VOCÊ</span>
        <h1>Seu clube.<br />Sua <em>história.</em></h1>
        <p className={styles.menuDescription}>Da primeira escalação à última rodada. Assuma um clube, forme seu elenco e conquiste seu lugar no futebol.</p>
        <div className={styles.menuActions}><button className={styles.primaryButton} disabled={!!live} onClick={() => startNewGame()}>Novo jogo <Icon name="arrow" /></button>
          {selectedTeamId && <button className={styles.secondaryButton} onClick={() => navigate('dashboard')}>{live ? 'Retomar partida' : 'Continuar temporada'}</button>}
        </div>
        <div className={styles.menuActions}><button className={styles.secondaryButton} disabled={!!live} onClick={() => navigate('data-import')}><Icon name="save" /> Importação de Dados · Base para nova carreira</button></div>
        <SaveControls compact />
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <div className={styles.menuNumbers}><div><strong>40</strong><span>clubes para comandar</span></div><div><strong>02</strong><span>divisões com acesso</span></div><div><strong>38</strong><span>rodadas por temporada</span></div></div>
      </section>
      <div className={styles.pitchArt} aria-hidden="true">
        <div className={styles.pitchCaption}><span>O JOGO COMEÇA FORA DAS QUATRO LINHAS</span><span>01 / 38</span></div>
        <TacticalPitch />
        <div className={styles.pitchFooter}><Icon name="shield" /><span>O próximo capítulo<br /><strong>tem a sua assinatura.</strong></span></div>
      </div>
    </div>
    <footer className={styles.menuFooter}><span>UM NOVO JEITO DE VIVER O FUTEBOL.</span><span>Novo jogo: base fictícia. Bases externas: Importação de Dados.</span></footer>
  </main>;
}
