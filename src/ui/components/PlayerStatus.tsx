import type { Player } from '../../engine/models';
import views from '../screens/ClubViews.module.css';

export function PlayerStatus({ player }: { player: Player }) {
  const { injury, discipline } = player;
  const suspension = discipline.redSuspension;
  return <>
    {injury && <span className={views.injuryStatus} title={`Lesionado · ${injury.remainingDays} dias`} aria-label={`Lesionado por ${injury.remainingDays} dias`}>✚</span>}
    {discipline.suspendedMatches > 0 && <span className={suspension ? views.redStatus : views.yellowStatus}
      title={`Suspenso · ${discipline.suspendedMatches} jogo(s)${suspension ? ' por expulsão' : ''}`}
      aria-label={`Suspenso por ${discipline.suspendedMatches} jogo(s)${suspension ? ' por expulsão' : ''}`}>{discipline.suspendedMatches}</span>}
    {discipline.yellowCards > 0 && <span className={views.yellowStatus} title={`${discipline.yellowCards} de 3 amarelos`}
      aria-label={`${discipline.yellowCards} de 3 amarelos`}>{discipline.yellowCards}/3</span>}
  </>;
}
