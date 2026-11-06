import { gzipSync, gunzipSync, strToU8, strFromU8 } from 'fflate';

const prefix = 'footbr:gzip:1:';
const maxBytes = 30_000_000;
const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
function crc32(bytes: Uint8Array): number {
  let value = 0xffff_ffff;
  for (const byte of bytes) value = (value >>> 8) ^ crcTable[(value ^ byte) & 255];
  return (value ^ 0xffff_ffff) >>> 0;
}

/** Apenas o armazenamento local é comprimido; a exportação continua sendo JSON. */
export function encodeStoredSave(raw: string): string {
  const bytes = strToU8(raw);
  if (bytes.length > maxBytes) throw new Error('Save muito grande para armazenamento local.');
  const zipped = gzipSync(bytes, { level: 1 });
  let binary = '';
  for (let offset = 0; offset < zipped.length; offset += 8192) binary += String.fromCharCode(...zipped.subarray(offset, offset + 8192));
  return prefix + btoa(binary);
}
export function decodeStoredSave(stored: string): string {
  if (!stored.startsWith(prefix)) return stored; // Slots das versões anteriores.
  if (stored.length > maxBytes) throw new Error('Save armazenado muito grande.');
  try {
    const binary = atob(stored.slice(prefix.length));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    if (bytes.length < 18) throw new Error('Dados incompletos.');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const expected = view.getUint32(bytes.length - 4, true);
    if (expected > maxBytes) throw new Error('Tamanho descompactado inválido.');
    const result = gunzipSync(bytes, { out: new Uint8Array(expected) });
    if (result.length !== expected || crc32(result) !== view.getUint32(bytes.length - 8, true)) throw new Error('Integridade inválida.');
    return strFromU8(result);
  } catch { throw new Error('O save armazenado está corrompido ou excede o limite.'); }
}
