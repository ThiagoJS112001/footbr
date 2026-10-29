import { useGameStore } from '../store/gameStore';
import { Icon } from '../components/Icon';
import styles from '../App.module.css';

export function Menu() {
  const { startNewGame, selectedTeamId, navigate, error } = useGameStore();
  return <main className={styles.menu}>
    <header className={styles.menuHeader}><span className={styles.brand}><span className={styles.brandIcon}><Icon name="shield" /></span>foot<span className={styles.brandAccent}>br</span><span className={styles.brandDot}>.</span></span><span className={styles.menuLabel}>FUTEBOL. DO SEU JEITO.</span></header>
    <div className={styles.menuContent}>
      <section><span className={styles.pill}><span className={styles.liveDot} /> UMA NOVA TEMPORADA ESPERA POR VOCÊ</span>
        <h1>Seu clube.<br />Sua <em>história.</em></h1>
        <p className={styles.menuDescription}>Da primeira escalação à última rodada. Assuma um clube, forme seu elenco e conquiste seu lugar no futebol.</p>
        <div className={styles.menuActions}><button className={styles.primaryButton} onClick={() => startNewGame()}>Novo jogo <Icon name="arrow" /></button>
          {selectedTeamId && <button className={styles.secondaryButton} onClick={() => navigate('dashboard')}>Continuar temporada</button>}
        </div>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <div className={styles.menuNumbers}><div><strong>20</strong><span>clubes para comandar</span></div><div><strong>38</strong><span>rodadas para fazer história</span></div><div><strong>01</strong><span>objetivo: o título</span></div></div>
      </section>
      <div className={styles.pitchArt} aria-hidden="true">
        <div className={styles.pitchCaption}><span>O JOGO COMEÇA FORA DAS QUATRO LINHAS</span><span>01 / 38</span></div>
        <svg viewBox="0 0 380 510" className={styles.pitch}><defs><pattern id="grass" width="380" height="64" patternUnits="userSpaceOnUse"><rect width="380" height="32" fill="#18291d" /><rect y="32" width="380" height="32" fill="#1b2e21" /></pattern></defs><rect x="0" y="0" width="380" height="510" rx="8" fill="url(#grass)" /><g stroke="#739a72" strokeWidth="1.3" fill="none" opacity=".55"><rect x="24" y="24" width="332" height="462" /><path d="M24 255h332 M106 24v76h168V24 M144 24v30h92V24 M106 486v-76h168v76 M144 486v-30h92v30" /><circle cx="190" cy="255" r="52" /><path d="M151 100a48 48 0 0 0 78 0 M151 410a48 48 0 0 1 78 0" /></g><g fill="#b5dd87" stroke="#294b30" strokeWidth="5">{[[190, 450], [62, 357], [148, 374], [232, 374], [318, 357], [66, 234], [148, 254], [232, 254], [314, 234], [145, 130], [235, 130]].map(([x, y], index) => <g key={index}><circle cx={x} cy={y} r="14" /><text x={x} y={y + 3.5} textAnchor="middle" fontSize="10" stroke="none" fill="#14221a" fontWeight="700">{index + 1}</text></g>)}</g></svg>
        <div className={styles.pitchFooter}><Icon name="shield" /><span>O próximo capítulo<br /><strong>tem a sua assinatura.</strong></span></div>
      </div>
    </div>
    <footer className={styles.menuFooter}><span>UM NOVO JEITO DE VIVER O FUTEBOL.</span><span>Clubes e jogadores inteiramente fictícios.</span></footer>
  </main>;
}
