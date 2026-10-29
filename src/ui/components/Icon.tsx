export type IconName = 'dashboard' | 'squad' | 'standings' | 'calendar' | 'arrow' | 'exit' | 'shield';
const paths: Record<IconName, string> = {
  dashboard: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  squad: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M16 3a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  standings: 'M4 20V10h4v10 M10 20V4h4v16 M16 20v-7h4v7 M2 20h20',
  calendar: 'M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2 M7 14h3 M14 14h3 M7 18h3',
  arrow: 'M4 12h16 M14 6l6 6-6 6',
  exit: 'M9 4H4v16h5 M13 8l4 4-4 4 M8 12h13',
  shield: 'M12 2l8 3v6c0 5-8 11-8 11S4 16 4 11V5z M9 12l2 2 4-5',
};
export function Icon({ name }: { name: IconName }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
