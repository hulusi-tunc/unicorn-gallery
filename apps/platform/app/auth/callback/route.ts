import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';

// Magic-link landing page. Supabase appends a code which we exchange for a session.
export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';
  const error = searchParams.get('error_description') ?? searchParams.get('error');

  if (error) {
    const u = new URL('/sign-in', origin);
    u.searchParams.set('error', error);
    return NextResponse.redirect(u);
  }

  if (code) {
    const supabase = await getSupabaseServerClient();
    const { error: exchErr } = await supabase.auth.exchangeCodeForSession(code);
    if (exchErr) {
      const u = new URL('/sign-in', origin);
      u.searchParams.set('error', exchErr.message);
      return NextResponse.redirect(u);
    }
  }

  return NextResponse.redirect(new URL(next, origin));
}
