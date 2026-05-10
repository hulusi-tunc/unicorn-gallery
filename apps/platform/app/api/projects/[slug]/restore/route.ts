import { NextResponse, type NextRequest } from 'next/server';
import { ARCHIVE_GRACE_DAYS, archiveDeleteAt } from '@/lib/db';
import {
  getSupabaseAdminClient,
  getSupabaseServerClient,
} from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * Restore a previously-archived project — clear archived_at, archive_reason,
 * archived_by. Only valid within the grace window (archived_at + 90 days).
 *
 * Restore is web-UI only; desktop has no "undo archive" affordance because
 * once a designer archives a project, the local Capture cache drops the
 * registry entry. They can re-add via "+ Add" instead.
 *
 * Auth: agency session cookie. RLS prevents non-agency users from updating.
 */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await ctx.params;
  if (!slug) {
    return NextResponse.json({ error: 'Missing slug.' }, { status: 400 });
  }

  const sb = await getSupabaseServerClient();
  const { data: user } = await sb.auth.getUser();
  if (!user.user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const admin = getSupabaseAdminClient();
  const { data: existing, error: lookupErr } = await admin
    .from('apps')
    .select('id, slug, archived_at')
    .eq('slug', slug)
    .maybeSingle();
  if (lookupErr) {
    return NextResponse.json({ error: lookupErr.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
  }
  if (!existing.archived_at) {
    return NextResponse.json(
      { error: 'Project is not archived — nothing to restore.' },
      { status: 400 },
    );
  }
  // Refuse to restore once the grace period has lapsed. The cron may not
  // have hard-deleted yet, but the contract is "90 days max".
  if (archiveDeleteAt(existing.archived_at).getTime() < Date.now()) {
    return NextResponse.json(
      {
        error: `Grace period (${ARCHIVE_GRACE_DAYS} days) has expired. Project will be hard-deleted on the next cron tick.`,
      },
      { status: 410 },
    );
  }

  const { data, error } = await admin
    .from('apps')
    .update({
      archived_at: null,
      archive_reason: null,
      archived_by: null,
    })
    .eq('slug', slug)
    .select('id, slug')
    .single();

  if (error) {
    return NextResponse.json(
      { error: `Restore failed: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, slug: data.slug });
}
