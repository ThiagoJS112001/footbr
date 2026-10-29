export type Rng = () => number;

/** Mulberry32: inteiro de 32 bits como seed, saída no intervalo [0, 1). */
export function createRng(seed: number): Rng {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffff_ffff) {
    throw new RangeError('A seed deve ser um inteiro entre 0 e 4294967295.');
  }
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export function pick<T>(rng: Rng, values: readonly T[]): T {
  if (values.length === 0) throw new RangeError('A lista não pode estar vazia.');
  return values[randomInt(rng, 0, values.length - 1)];
}
