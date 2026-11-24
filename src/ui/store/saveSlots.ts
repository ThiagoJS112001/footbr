declare global {
  interface Window {
    footbrDesktop?: {
      readSave(slot: number): string | null;
      writeSave(slot: number, data: string): void;
    };
  }
}

export const saveKey = (slot = 0) => `footbr.save.v1.${slot}`;

export function readSlot(slot: number): string | null {
  if (typeof window !== 'undefined' && window.footbrDesktop) return window.footbrDesktop.readSave(slot);
  return typeof localStorage === 'undefined' ? null : localStorage.getItem(saveKey(slot));
}

export function writeSlot(slot: number, data: string): void {
  if (typeof window !== 'undefined' && window.footbrDesktop) window.footbrDesktop.writeSave(slot, data);
  else if (typeof localStorage !== 'undefined') localStorage.setItem(saveKey(slot), data);
}
