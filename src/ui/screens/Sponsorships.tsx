import { useState } from 'react';
import type { Career } from '../../engine/career/career';
import { activeSponsor, sponsorBrands, sponsorBreakFee, sponsorshipOffers } from '../../engine/career/sponsors';
import type { Team } from '../../engine/models';
import { awardLabels } from '../../engine/career/awardTypes';
import type { SponsorContract } from '../../engine/career/types';
import { Panel } from '../components/Panel';
import { useGameStore } from '../store/gameStore';
import { currency } from '../utils';
import styles from '../App.module.css';
import views from './ClubViews.module.css';

function AwardTerms({ contract }: { contract: SponsorContract }) {
  if (!contract.awardBonuses?.length) return null;
  return <ul className={styles.compactList}>{contract.awardBonuses.map(({ kind, rate }) =>
    <li key={kind}><span>{awardLabels[kind]}</span><strong>{currency(Math.round(contract.annual * rate))} por edição</strong></li>)}</ul>;
}

export function Sponsorships({ career, team }: { career: Career; team: Team }) {
  const sponsor = useGameStore((state) => state.sponsor);
  const active = activeSponsor(career, team.id);
  const previous = career.systems.sponsors?.find((item) => item.teamId === team.id);
  const pending = previous && previous.start > career.season ? previous : undefined;
  const [replacing, setReplacing] = useState(false);
  const contract = active ?? pending;
  const disabled = career.systems.board.status !== 'active';
  const showOffers = !disabled && !pending && (!active || replacing);
  return <Panel title="Patrocínios do clube" icon="finances" className={views.surface}
    action={active && !disabled && <button className={styles.textButton} aria-expanded={replacing}
      onClick={() => setReplacing(!replacing)}>{replacing ? 'Manter contrato' : 'Avaliar rescisão'}</button>}>
    {contract && <div className={styles.controls}>
      <p><strong>{sponsorBrands[contract.sponsorId].name}</strong><br />
        {pending ? 'Agendado' : 'Em vigor'} · Temporadas {contract.start}–{contract.end} · {currency(contract.annual)} por temporada</p>
      <p>{contract.target ? `Meta de terminar entre os ${contract.target} primeiros ou conquistar um título.` : 'Sem meta esportiva.'}</p>
    </div>}
    {contract && <AwardTerms contract={contract} />}
    {active && showOffers && <p className={styles.tableNote}>Rescindir custa {currency(sponsorBreakFee(active))} e reduz a confiança da diretoria.</p>}
    {showOffers && <div className={views.careerCards}>{sponsorshipOffers(career, team).map((offer) => {
      const brand = sponsorBrands[offer.sponsorId];
      const isRenewal = previous?.sponsorId === offer.sponsorId;
      return <article key={offer.sponsorId} className={views.careerCard}>
        <span className={styles.muted}>{brand.profile}</span><h3>{brand.name}</h3>
        <p><strong>{currency(offer.annual)}</strong> por temporada · {brand.years} {brand.years === 1 ? 'ano' : 'anos'}</p>
        <p>{offer.target ? `Bônus de ${currency(Math.round(offer.annual * brand.bonus))} pelo top ${offer.target} ou por título.` : 'Sem metas ou bônus.'}</p>
        <AwardTerms contract={offer} />
        {offer.sponsorId === 'pulso' && <p className={styles.muted}>Frustrar a meta desgasta a diretoria. O efeito é maior em clubes de torcida.</p>}
        <button className={styles.secondaryButton} disabled={!!active && (isRenewal || team.budget < sponsorBreakFee(active))}
          onClick={() => { sponsor(offer.sponsorId, !!active); setReplacing(false); }}>
          {active ? isRenewal ? 'Patrocinador atual' : 'Rescindir e assinar' : isRenewal ? 'Renovar contrato' : 'Assinar contrato'}
        </button>
      </article>;
    })}</div>}
    {!contract && !showOffers && <p className={styles.tableNote}>O clube recebe a receita básica de patrocínio.</p>}
  </Panel>;
}
