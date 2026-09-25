/**
 * White-labelling.
 *
 * Unicorn Studio also delivers work as a third party under a partner's name,
 * and those clients must never see Unicorn: not the logo, the name, nor the
 * link. The gallery is one app and one database; what a visitor sees is
 * decided by the host they arrive on, and each project records which brand
 * its client knows it by, so its share links and client redirects go to that
 * brand's host.
 *
 * Add a brand here, give it a host, and it works everywhere the UI reads
 * `useBrand()` / `getBrand()`.
 */

export type BrandId = 'unicorn' | 'netygo';

export interface Brand {
  id: BrandId;
  /** The studio's name, as a client reads it ("Shared by …"). */
  name: string;
  /** Browser tab title and PDF creator. */
  productName: string;
  /** Meta description. */
  description: string;
  /** Small print under the sign-in forms. */
  authFooter: string;
  /** Badge on comments written by the studio team. */
  staffLabel: string;
  /** Public origin, no trailing slash. Share links for this brand's projects use it. */
  origin: string;
  /** Favicon and home-screen icon, from /public. */
  icon: string;
  appleIcon: string;
}

export const BRANDS: Record<BrandId, Brand> = {
  unicorn: {
    id: 'unicorn',
    name: 'Unicorn Studio',
    productName: 'Unicorn Studio Gallery',
    description:
      'Internal Mobbin-style gallery for the apps Unicorn Studio builds for its customers.',
    authFooter: 'Unicorn Studio · Internal gallery',
    staffLabel: 'Unicorn',
    origin: (process.env.NEXT_PUBLIC_UNICORN_ORIGIN ?? 'https://unicorn-studio-gallery.vercel.app').replace(/\/$/, ''),
    icon: '/brand/unicorn-icon.png',
    appleIcon: '/brand/unicorn-apple-icon.png',
  },
  netygo: {
    id: 'netygo',
    name: 'Netygo',
    productName: 'Netygo · Design review',
    description: 'Review and comment on the screens of your project.',
    authFooter: 'Netygo · Design review',
    staffLabel: 'Netygo',
    origin: (process.env.NEXT_PUBLIC_NETYGO_ORIGIN ?? 'https://netygo-review.vercel.app').replace(/\/$/, ''),
    icon: '/brand/netygo-icon.png',
    appleIcon: '/brand/netygo-apple-icon.png',
  },
};

export const BRAND_IDS = Object.keys(BRANDS) as BrandId[];

export function isBrandId(v: unknown): v is BrandId {
  return typeof v === 'string' && v in BRANDS;
}

/**
 * The brand a host serves. Any host naming a brand (netygo-review.vercel.app,
 * review.netygo.com, netygo.localhost for local testing) serves that brand;
 * everything else is Unicorn.
 */
export function brandIdForHost(host: string | null | undefined): BrandId {
  const h = (host ?? '').toLowerCase();
  if (h.includes('netygo')) return 'netygo';
  return 'unicorn';
}
