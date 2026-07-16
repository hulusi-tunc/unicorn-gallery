import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/server';
import { extractBearer, getUserFromBearer, isBearerAuthError } from '@/lib/user-token';

export const runtime = 'nodejs';

/**
 * The projects the signed-in user may work on in the Capture desktop app.
 *
 * Auth: Authorization: Bearer <Supabase user access token> (a JWT). This is
 * what the desktop app sends after the user signs in — NOT a per-project
 * `pgt_` token and NOT the shared SETUP_TOKEN.
 *
 * Scope:
 *   - Studio owner  → every (non-archived) project.
 *   - Member        → only projects they're assigned to via project_members
 *                     (which includes projects they created from Capture, since
 *                     create-as-user auto-assigns the creator).
 *
 * Each project carries its `pgt_` project token so Capture can pull the
 * existing manifest and push captures through the unchanged intake endpoints.
 * Because a member only ever receives tokens for assigned projects, the user
 * identity is what gates which projects (and tokens) they can touch.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const token = extractBearer(request);
  if (!token) {
    return NextResponse.json({ error: 'Missing session token.' }, { status: 401 });
  }
  const user = await getUserFromBearer(token);
  if (isBearerAuthError(user)) {
    return NextResponse.json({ error: user.message }, { status: user.status });
  }

  const admin = getSupabaseAdminClient();
  const COLS =
    'id, slug, name, platform, project_token, preview_image_url, accent_color, created_at';

  let rows:
    | Array<{
        id: string;
        slug: string;
        name: string;
        platform: string;
        project_token: string | null;
        preview_image_url: string | null;
        accent_color: string | null;
        created_at: string;
      }>
    | null = [];

  if (user.isOwner) {
    const { data, error } = await admin
      .from('apps')
      .select(COLS)
      .is('archived_at', null)
      .order('created_at', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    rows = data;
  } else {
    // Members may only create/push projects, so anyone non-owner who reaches
    // here must be agency-tier. Customers have no Capture surface.
    if (user.role !== 'agency') {
      return NextResponse.json(
        { error: 'Your account is not a studio member. Ask the owner for access.' },
        { status: 403 },
      );
    }
    const { data: memberships, error: mErr } = await admin
      .from('project_members')
      .select('app_id')
      .eq('user_id', user.id);
    if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });
    const appIds = (memberships ?? []).map((m) => m.app_id);
    if (appIds.length === 0) {
      rows = [];
    } else {
      const { data, error } = await admin
        .from('apps')
        .select(COLS)
        .in('id', appIds)
        .is('archived_at', null)
        .order('created_at', { ascending: false });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      rows = data;
    }
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      isOwner: user.isOwner,
    },
    projects: (rows ?? []).map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      platform: p.platform,
      projectToken: p.project_token,
      previewImageUrl: p.preview_image_url,
      accentColor: p.accent_color,
      createdAt: p.created_at,
    })),
  });
}
