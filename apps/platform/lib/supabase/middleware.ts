import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

interface CookieToSet {
  name: string;
  value: string;
  options: CookieOptions;
}

const PUBLIC_PATHS = [
  '/sign-in',
  '/sign-up',
  '/auth/callback',
  '/auth/error',
  '/api/dev',
  '/api/sign-up',
  '/shared',
  // Public Definition-of-Ready calculator + its save endpoint. /dor/team is
  // covered by this prefix but stays gated by the (dashboard) layout + an
  // agency check in the page; the GET /api/dor handler enforces agency too.
  '/dor',
  '/api/dor',
];

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic =
    PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + '/')) ||
    path.startsWith('/_next') ||
    path.startsWith('/api/captures') || // intake API has its own bearer auth
    path.startsWith('/api/projects'); // init CLI flow has its own bearer auth

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/sign-in';
    url.searchParams.set('next', path);
    return NextResponse.redirect(url);
  }

  return response;
}
