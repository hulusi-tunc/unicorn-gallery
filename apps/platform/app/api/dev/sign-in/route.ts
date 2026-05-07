import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdminClient, getSupabaseServerClient } from '@/lib/supabase/server';

// Dev-only sign-in bypass.
// Skips email + Supabase's redirect-URL allowlist by:
//   1. generateLink (admin) -> token_hash
//   2. verifyOtp (server) with our cookie adapter -> session cookies set
// Then redirects to `next` (default: /).
export async function GET(request: NextRequest): Promise<Response> {
  if (process.env['NODE_ENV'] === 'production' && !process.env['ALLOW_DEV_SIGNIN']) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const email = request.nextUrl.searchParams.get('email');
  const next = request.nextUrl.searchParams.get('next') ?? '/';
  if (!email) {
    return NextResponse.json({ error: 'email is required' }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  if (linkErr || !link?.properties?.hashed_token) {
    return NextResponse.json(
      { error: linkErr?.message ?? 'Could not generate link' },
      { status: 500 },
    );
  }

  const server = await getSupabaseServerClient();
  const { error: verifyErr } = await server.auth.verifyOtp({
    type: 'email',
    token_hash: link.properties.hashed_token,
  });
  if (verifyErr) {
    return NextResponse.json({ error: verifyErr.message }, { status: 401 });
  }

  return NextResponse.redirect(new URL(next, request.nextUrl.origin));
}
