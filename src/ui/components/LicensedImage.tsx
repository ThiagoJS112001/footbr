import { useState } from 'react';
import type { ReactNode } from 'react';
import type { ImageRef } from '../../data/catalog';

export function imageDisplayUrl(image?: ImageRef): string | null {
  if (!image?.license || !image.displayUrl) return null;
  if (/^\/api\/media\/[a-f0-9-]+$/.test(image.displayUrl)) return image.displayUrl;
  try { const url = new URL(image.displayUrl); return url.protocol === 'https:' && url.hostname === 'media.api-sports.io' ? url.href : null; } catch { return null; }
}
export function LicensedImage({ image, fallback, className, alt = '' }: { image?: ImageRef; fallback: ReactNode; className?: string; alt?: string }) {
  const src = imageDisplayUrl(image);
  const [failed, setFailed] = useState<string | null>(null);
  return src && src !== failed ? <img src={src} alt={alt} className={className} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(src)} /> : <>{fallback}</>;
}
