import { nanoid } from 'nanoid';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/server';
import {
  type BearerUser,
  extractBearer,
  getUserFromBearer,
  isBearerAuthError,
} from '@/lib/user-token';

export const runtime = 'nodejs';

/**
 * List every project on the platform. Used by Capture's "Cleanup
 * unsynced" flow to diff the gallery against a local registry and
 * archive the leftovers in bulk. Same setup-token auth as POST so the
 * scope stays "the agency's desktops can manage their own projects."
 *
 * Optional `?platform=web` filter — agencies running both mobile +
 * web installs typically want to clean up one surface at a time.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const setupToken = process.env.SETUP_TOKEN;
  if (!setupToken) {
    return NextResponse.json(
      { error: 'Server is missing SETUP_TOKEN env var.' },
      { status: 500 },
    );
  }
  const auth = request.headers.get('authorization') ?? '';
  const provided = auth.startsWith('Bearer ')
    ? auth.slice(7).trim()
    : auth.trim();
  if (!provided || provided !== setupToken) {
    return NextResponse.json({ error: 'Invalid setup token.' }, { status: 401 });
  }
  const url = new URL(request.url);
  const platformFilter = url.searchParams.get('platform');
  const admin = getSupabaseAdminClient();
  let query = admin
    .from('apps')
    .select('id, slug, name, platform, archived_at, created_at')
    .order('created_at', { ascending: false });
  if (platformFilter) query = query.eq('platform', platformFilter);
  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ projects: data ?? [] });
}

/**
 * Create a new app row + project token. Called by `npx @unicorn-studio/snap-bridge init`
 * when the designer doesn't already have a token to paste.
 *
 * Auth: Authorization: Bearer <SETUP_TOKEN>. The setup token is a server-side
 * env var shared with agency members out-of-band. NOT a regular user session
 * because the CLI runs in the customer repo and has no Supabase cookie.
 *
 * Designer/PM assignment is left to the platform UI's staff strip — agency
 * members fill those in after the project is created.
 */
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

export async function POST(request: NextRequest): Promise<Response> {
  // Two kinds of caller create projects:
  //   1. The Capture desktop app, authenticated as a signed-in USER (a Supabase
  //      access-token JWT). The creator is recorded (created_by) and auto-
  //      assigned via project_members, so the project appears in their Capture
  //      dashboard and they can push to it.
  //   2. Headless flows (snap-bridge `init`, CI), authenticated with the shared
  //      SETUP_TOKEN. These have no user identity, so no assignment is made —
  //      the platform UI's staff strip handles staffing afterwards.
  const provided = extractBearer(request);
  if (!provided) {
    return NextResponse.json({ error: 'Missing bearer token.' }, { status: 401 });
  }

  const setupToken = process.env.SETUP_TOKEN;
  const isSetupToken = Boolean(setupToken) && provided === setupToken;

  let actor: BearerUser | null = null;
  if (!isSetupToken) {
    const resolved = await getUserFromBearer(provided);
    if (isBearerAuthError(resolved)) {
      return NextResponse.json({ error: resolved.message }, { status: resolved.status });
    }
    // Only studio members (agency) or the owner may create projects. Customers
    // have no Capture surface and can't write.
    if (resolved.role !== 'agency' && !resolved.isOwner) {
      return NextResponse.json(
        { error: 'Only studio members can create projects.' },
        { status: 403 },
      );
    }
    actor = resolved;
  }

  let body: { slug?: string; name?: string; platform?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Body is not valid JSON.' }, { status: 400 });
  }

  const slug = (body.slug ?? '').trim();
  const name = (body.name ?? '').trim();
  const platform = (body.platform ?? '').trim();

  if (!slug || !name || !platform) {
    return NextResponse.json(
      { error: 'Missing one of: slug, name, platform.' },
      { status: 400 },
    );
  }
  if (!SLUG_RE.test(slug)) {
    return NextResponse.json(
      { error: 'Invalid slug — use lowercase kebab-case (a–z, 0–9, hyphen).' },
      { status: 400 },
    );
  }
  if (!['web', 'ios', 'android'].includes(platform)) {
    return NextResponse.json(
      { error: 'Invalid platform — must be web, ios, or android.' },
      { status: 400 },
    );
  }

  const admin = getSupabaseAdminClient();

  // Idempotent: if slug already exists, return its existing token. Setup token
  // is an agency-internal secret, so re-issuing the project token to a caller
  // who already proved possession of the setup token is acceptable. Avoids
  // designers getting stuck on a 409 when re-running the wizard.
  //
  // Also: if the existing row is archived (90-day soft-delete), re-onboarding
  // counts as an explicit "I want this project back" — auto-restore it. The
  // designer's intent on +Add is unambiguous, and forcing them to bounce
  // through the gallery's /archived page just to click Restore would be a
  // dead-end UX.
  const { data: existing } = await admin
    .from('apps')
    .select('id, slug, name, platform, project_token, archived_at')
    .eq('slug', slug)
    .maybeSingle();
  if (existing) {
    // For user-authenticated (Capture) creates, a member may only "reuse" a
    // slug they're already assigned to — this stops one member from grabbing
    // another member's project by guessing its slug. The owner can reuse any.
    if (actor && !actor.isOwner) {
      const { data: membership } = await admin
        .from('project_members')
        .select('app_id')
        .eq('app_id', existing.id)
        .eq('user_id', actor.id)
        .maybeSingle();
      if (!membership) {
        return NextResponse.json(
          {
            error:
              "A project with that slug already exists and isn't assigned to you.",
          },
          { status: 409 },
        );
      }
    }
    const wasArchived = Boolean(existing.archived_at);
    if (wasArchived) {
      const { error: restoreErr } = await admin
        .from('apps')
        .update({
          archived_at: null,
          archive_reason: null,
          archived_by: null,
        })
        .eq('id', existing.id);
      if (restoreErr) {
        return NextResponse.json(
          { error: `Auto-restore failed: ${restoreErr.message}` },
          { status: 500 },
        );
      }
    }
    return NextResponse.json({
      id: existing.id,
      slug: existing.slug,
      name: existing.name,
      platform: existing.platform,
      projectToken: existing.project_token,
      reused: true,
      restored: wasArchived,
    });
  }

  const projectToken = `pgt_${nanoid(32)}`;
  const { data, error } = await admin
    .from('apps')
    .insert({
      slug,
      name,
      platform,
      project_token: projectToken,
      // Record the creator when a signed-in user created this from Capture.
      ...(actor ? { created_by: actor.id } : {}),
    })
    .select('id, slug, name, platform')
    .single();

  if (error) {
    return NextResponse.json(
      { error: `Insert failed: ${error.message}` },
      { status: 500 },
    );
  }

  // Auto-assign the creator so the project appears in their Capture dashboard.
  // Members only — the owner already sees every project, so no row is needed.
  if (actor && !actor.isOwner) {
    const { error: memberErr } = await admin
      .from('project_members')
      .upsert(
        { app_id: data.id, user_id: actor.id, assigned_by: actor.id },
        { onConflict: 'app_id,user_id', ignoreDuplicates: true },
      );
    if (memberErr) {
      return NextResponse.json(
        { error: `Project created but assignment failed: ${memberErr.message}` },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    id: data.id,
    slug: data.slug,
    name: data.name,
    platform: data.platform,
    projectToken,
  });
}
