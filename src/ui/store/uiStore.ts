import { create } from 'zustand';
import type { PlayerPosition } from '../../engine/models';

export const initialUiPreferences = {
  marketPosition: 'all' as PlayerPosition | 'all', marketSearch: '', marketSource: 'market',
  marketAge: 'all', marketClub: 'all',
  marketSelected: null as string | null, marketOffer: 0, marketSalary: 0, marketYears: 3,
  marketDealType: 'buy' as 'buy' | 'loan',
  squadPosition: 'all' as PlayerPosition | 'all', compareLeft: '', compareRight: '', compareSearch: '',
  squadSelected: null as string | null, calendarOnlyMine: true,
};
export const useUiStore = create(() => ({ ...initialUiPreferences }));
export const resetUiPreferences = () => useUiStore.setState({ ...initialUiPreferences });
