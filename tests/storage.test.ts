import { describe, expect, it } from 'vitest';
import { createCareer } from '../src/engine/career/career';
import { encodeSave } from '../src/engine/save/save';
import { decodeStoredSave, encodeStoredSave } from '../src/ui/store/saveStorage';

describe('armazenamento de carreiras longas', () => {
  it('comprime um save real e recupera o JSON original, incluindo acentos', () => {
    const career = createCareer(42);
    career.selectedTeamId = career.league.teams[0].id;
    const raw = encodeSave({ career, lastRound: null, progress: null });
    const stored = encodeStoredSave(raw);
    expect(stored.length).toBeLessThan(raw.length * .4);
    expect(decodeStoredSave(stored) === raw).toBe(true);
    expect(decodeStoredSave(raw) === raw).toBe(true);
  });
  it('rejeita corrupção e tamanho de saída excessivo antes de alocar a descompressão', () => {
    const stored = encodeStoredSave('{"mensagem":"São João, promoção e confiança"}');
    const pieces = stored.split(':');
    const bytes = Uint8Array.from(atob(pieces[3]), (c) => c.charCodeAt(0));
    bytes[bytes.length - 8] ^= 255;
    expect(() => decodeStoredSave(pieces.slice(0, 3).join(':') + ':' + btoa(String.fromCharCode(...bytes)))).toThrow('corrompido');
    new DataView(bytes.buffer).setUint32(bytes.length - 4, 30_000_001, true);
    expect(() => decodeStoredSave(pieces.slice(0, 3).join(':') + ':' + btoa(String.fromCharCode(...bytes)))).toThrow('limite');
  });
});
