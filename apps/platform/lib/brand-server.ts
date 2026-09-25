import 'server-only';
import { headers } from 'next/headers';
import { BRANDS, type Brand, type BrandId, brandIdForHost } from '@/lib/brand';

/** The brand this request is being served as, from the host it arrived on. */
export async function getBrand(): Promise<Brand> {
  const h = await headers();
  return BRANDS[brandIdForHost(h.get('x-forwarded-host') ?? h.get('host'))];
}

/**
 * The base URL for links we hand out for a brand (a customer's sign-in link).
 *
 * In production it is the brand's own origin, always. It used to come from
 * VERCEL_PROJECT_PRODUCTION_URL, which is whichever domain Vercel treats as
 * the project's main one, so adding the Netygo domain quietly turned every
 * Unicorn project's links into Netygo links. Previews and local dev keep
 * their own address so links there stay testable.
 */
export function brandSiteUrl(id: BrandId): string {
  if (process.env['VERCEL_ENV'] === 'production') return BRANDS[id].origin;
  const fromEnv = process.env['NEXT_PUBLIC_SITE_URL'] ?? process.env['VERCEL_URL'];
  if (!fromEnv) return 'http://localhost:3010';
  return (fromEnv.startsWith('http') ? fromEnv : `https://${fromEnv}`).replace(/\/$/, '');
}
