import { LayoutDashboard, Users, Trophy, CalendarDays, ArrowRight, LogOut, ShieldCheck, Goal, Play,
  ArrowLeftRight, Wallet, History, UserRound, ChevronDown, Clock3, MapPin, Newspaper, HeartPulse,
  Target, ChartNoAxesCombined, ChevronRight, Shirt, Save, Check, GraduationCap, Building2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type IconName = 'dashboard' | 'squad' | 'standings' | 'calendar' | 'arrow' | 'exit' | 'shield'
  | 'lineup' | 'match' | 'market' | 'finances' | 'history' | 'user' | 'chevron' | 'clock' | 'stadium'
  | 'news' | 'condition' | 'target' | 'trend' | 'next' | 'shirt' | 'save' | 'check' | 'cup' | 'academy' | 'board' | 'compare';
const icons: Record<IconName, LucideIcon> = {
  dashboard: LayoutDashboard, squad: Users, standings: Trophy, calendar: CalendarDays, arrow: ArrowRight,
  exit: LogOut, shield: ShieldCheck, lineup: Goal, match: Play, market: ArrowLeftRight, finances: Wallet,
  history: History, user: UserRound, chevron: ChevronDown, clock: Clock3, stadium: MapPin,
  news: Newspaper, condition: HeartPulse, target: Target, trend: ChartNoAxesCombined,
  next: ChevronRight, shirt: Shirt, save: Save, check: Check,
  cup: Trophy, academy: GraduationCap, board: Building2, compare: ArrowLeftRight,
};
export function Icon({ name, size = 21, className }: { name: IconName; size?: number; className?: string }) {
  const Component = icons[name];
  return <Component size={size} strokeWidth={1.8} className={className} aria-hidden="true" />;
}
