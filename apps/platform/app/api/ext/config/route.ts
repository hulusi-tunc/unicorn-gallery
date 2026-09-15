import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Public bootstrap for the Chrome extension.
 *
 * The extension is configured with a gallery URL and nothing else, so it needs
 * somewhere to learn which Supabase project to authenticate against. Both
 * values are already public — they ship in the web app's client bundle and are
 * useless without a password, because every table is behind RLS — so serving
 * them here adds no exposure. It saves pinning them into the extension build,
 * where a rotation would mean re-packing and re-installing it everywhere.
 *
 * Deliberately NOT a sign-in endpoint: the extension posts the password
 * straight to Supabase, so no credential ever passes through this app.
 */
export function GET(): Response {
  const supabaseUrl =
    process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? process.env['SUPABASE_URL'];
  const supabaseAnonKey =
    process.env['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'] ??
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ??
    process.env['SUPABASE_ANON_KEY'];

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { ok: false, error: 'Gallery is missing its Supabase public config.' },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { ok: true, supabaseUrl, supabaseAnonKey },
    {
      headers: {
        // The extension is a null-origin caller; it only ever reads.
        'access-control-allow-origin': '*',
        'cache-control': 'public, max-age=300',
      },
    },
  );
}

export function OPTIONS(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type, authorization',
      'access-control-allow-methods': 'GET, OPTIONS',
    },
  });
}
