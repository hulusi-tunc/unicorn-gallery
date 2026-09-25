import 'server-only';
import { headers } from 'next/headers';
import { BRANDS, type Brand, brandIdForHost } from '@/lib/brand';

/** The brand this request is being served as, from the host it arrived on. */
export async function getBrand(): Promise<Brand> {
  const h = await headers();
  return BRANDS[brandIdForHost(h.get('x-forwarded-host') ?? h.get('host'))];
}
