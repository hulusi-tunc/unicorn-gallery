import { NextResponse, type NextRequest } from 'next/server';
import { archiveDaysRemaining } from '@/lib/db';
import {
  getSupabaseAdminClient,
  getSupabaseServerClient,
} from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * Read-only archive status. Capture uses this on refreshProjectRegistry to
 * detect when a project was archived from the web side and drop the local
 * entry. Auth: project_token (Bearer) — same as the POST below.
 */
export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await ctx.params;
  const auth = request.headers.get('authorization') ?? '';
  const bearer = auth.startsWith('Bearer ')
    ? auth.slice(7).trim()
    : auth.trim();
  if (!bearer) {
    return NextResponse.json({ error: 'Missing project token.' }, { status: 401 });
  }
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('apps')
    .select('slug, archived_at, archive_reason, project_token')
    .eq('slug', slug)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
  }
  if (data.project_token !== bearer) {
    return NextResponse.json({ error: 'Invalid project token.' }, { status: 403 });
  }
  return NextResponse.json({
    slug: data.slug,
    archived_at: data.archived_at,
    archive_reason: data.archive_reason,
    days_remaining: data.archived_at
      ? archiveDaysRemaining(data.archived_at)
      : null,
  });
}

/**
 * Soft-delete a project (archive). The project disappears from default
 * lists for everyone but its rows + storage stay intact for 90 days. A
 * daily cron job (`/api/cron/hard-delete-archived`) does the actual
 * cleanup; users can `/restore` any time before that.
 *
 * Auth: either
 *   - Authorization: Bearer <project_token>  (desktop tool)
 *   - or a logged-in agency session cookie   (web UI)
 *
 * Idempotent: archiving an already-archived project just refreshes the
 * `archived_at` timestamp (extends the grace period). That's the gentler
 * behavior — if a user re-clicks the button, they don't accidentally
 * burn through their grace window.
 */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await ctx.params;
  if (!slug) {
    return NextResponse.json({ error: 'Missing slug.' }, { status: 400 });
  }

  let body: { reason?: string } = {};
  try {
    if (request.headers.get('content-length') !== '0') {
      body = (await request.json()) as { reason?: string };
    }
  } catch {
    // empty body is fine
  }
  const reason = (body.reason ?? 'user_initiated').slice(0, 200);

  const auth = request.headers.get('authorization') ?? '';
  const bearer = auth.startsWith('Bearer ')
    ? auth.slice(7).trim()
    : auth.trim();

  let archivedBy: string | null = null;
  let authorized = false;

  if (bearer) {
    // Desktop / CLI path: match project_token to this exact slug.
    const admin = getSupabaseAdminClient();
    const { data, error } = await admin
      .from('apps')
      .select('slug, project_token')
      .eq('slug', slug)
      .maybeSingle();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    }
    if (data.project_token !== bearer) {
      return NextResponse.json({ error: 'Invalid project token.' }, { status: 403 });
    }
    authorized = true;
  } else {
    // Web UI path: agency session cookie. RLS enforces that only agency
    // members (or admins) can update an app row. We attempt the update
    // with the user-scoped client; failure → not authorized.
    const sb = await getSupabaseServerClient();
    const { data: user } = await sb.auth.getUser();
    if (!user.user) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }
    archivedBy = user.user.id;
    authorized = true;
  }

  if (!authorized) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('apps')
    .update({
      archived_at: new Date().toISOString(),
      archive_reason: reason,
      archived_by: archivedBy,
    })
    .eq('slug', slug)
    .select('id, slug, archived_at')
    .single();

  if (error) {
    return NextResponse.json(
      { error: `Archive failed: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    slug: data.slug,
    archived_at: data.archived_at,
  });
}
