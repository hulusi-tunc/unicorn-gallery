import { NextResponse, type NextRequest } from 'next/server';
import { requestOrigin, safeNextPath } from '@/lib/safe-next';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * Receiving end of /api/brand-handoff: redeem the one-time token on this
 * host, which sets this host's session cookies, then continue to `next`.
 * A spent or expired token lands on sign-in, never on an error page.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = request.nextUrl;
  const origin = requestOrigin(request);
  const tokenHash = searchParams.get('token_hash');
  const next = safeNextPath(searchParams.get('next'));

  if (tokenHash) {
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({ type: 'email', token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }

  const signIn = new URL('/sign-in', origin);
  signIn.searchParams.set('next', next);
  return NextResponse.redirect(signIn);
}
