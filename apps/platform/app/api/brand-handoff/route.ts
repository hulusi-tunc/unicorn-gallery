import { NextResponse, type NextRequest } from 'next/server';
import { BRANDS } from '@/lib/brand';
import { getBrand } from '@/lib/brand-server';
import { getClientBrand, getCurrentProfile } from '@/lib/queries';
import { requestOrigin, safeNextPath } from '@/lib/safe-next';
import { getSupabaseAdminClient, getSupabaseServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * Moves a white-labelled client off the Unicorn host, still signed in.
 *
 * A session lives in cookies on one host, so redirecting a client who signed
 * in on the Unicorn address to their brand's address would drop them on its
 * sign-in page. Instead this mints a one-time sign-in token for the user
 * already signed in here (an admin magic link; nothing is emailed), ends the
 * session on this host, and hands the token to /auth/handoff on the brand's
 * host, which signs them in there and continues to `next`.
 *
 * Only a customer whose projects all carry a white-label brand is moved, and
 * only ever as themselves; everyone else goes straight on to `next`.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const next = safeNextPath(request.nextUrl.searchParams.get('next'));
  const origin = requestOrigin(request);
  const stay = NextResponse.redirect(new URL(next, origin));

  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.redirect(new URL('/sign-in', origin));
  if (profile.role !== 'customer') return stay;

  const target = await getClientBrand(profile.id);
  if (target === 'unicorn' || (await getBrand()).id === target) return stay;

  const admin = getSupabaseAdminClient();
  const { data: link, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: profile.email,
  });
  if (error || !link?.properties?.hashed_token) return stay;

  // No Unicorn session is left behind for this client.
  const supabase = await getSupabaseServerClient();
  // Local scope: only this browser's Unicorn session, not the client's
  // sessions on other devices.
  await supabase.auth.signOut({ scope: 'local' });

  const dest = new URL('/auth/handoff', BRANDS[target].origin);
  dest.searchParams.set('token_hash', link.properties.hashed_token);
  dest.searchParams.set('next', next);
  return NextResponse.redirect(dest);
}
