'use server';

import { revalidatePath } from 'next/cache';
import { archiveDeleteAt, ARCHIVE_GRACE_DAYS } from '@/lib/db';
import { getCurrentProfile } from '@/lib/queries';
import {
  getSupabaseAdminClient,
  getSupabaseServerClient,
} from '@/lib/supabase/server';

/**
 * Server action — archive (soft-delete) a project. Mirrors the API endpoint
 * but bound to the user's session so the archived_by column tracks who did
 * it. Used by the Archive button in the dashboard's app menu + app header.
 */
export async function archiveProject(input: {
  appSlug: string;
  reason?: string;
}): Promise<{ ok?: true; error?: string; archived_at?: string }> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== 'agency') {
    return { error: 'Only agency members can archive projects.' };
  }
  const sb = await getSupabaseServerClient();
  const { data, error } = await sb
    .from('apps')
    .update({
      archived_at: new Date().toISOString(),
      archive_reason: (input.reason ?? 'user_initiated_web').slice(0, 200),
      archived_by: profile.id,
    })
    .eq('slug', input.appSlug)
    .select('slug, archived_at')
    .single();
  if (error) return { error: error.message };
  revalidatePath('/');
  revalidatePath('/archived');
  revalidatePath(`/app/${input.appSlug}`);
  return { ok: true, archived_at: data.archived_at };
}

/**
 * Server action — restore an archived project. Only valid within the
 * grace window. Past that, restore returns an error and the caller should
 * tell the user to contact an admin (who has the hard-delete bypass) or
 * just re-onboard the project from scratch.
 */
export async function restoreProject(input: {
  appSlug: string;
}): Promise<{ ok?: true; error?: string }> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== 'agency') {
    return { error: 'Only agency members can restore projects.' };
  }
  const admin = getSupabaseAdminClient();
  const { data: existing, error: lookupErr } = await admin
    .from('apps')
    .select('slug, archived_at')
    .eq('slug', input.appSlug)
    .maybeSingle();
  if (lookupErr) return { error: lookupErr.message };
  if (!existing) return { error: 'Project not found.' };
  if (!existing.archived_at) {
    return { error: 'Project is not archived — nothing to restore.' };
  }
  if (archiveDeleteAt(existing.archived_at).getTime() < Date.now()) {
    return {
      error: `Grace period (${ARCHIVE_GRACE_DAYS} days) has expired. Contact an admin if you need it back.`,
    };
  }
  const { error } = await admin
    .from('apps')
    .update({
      archived_at: null,
      archive_reason: null,
      archived_by: null,
    })
    .eq('slug', input.appSlug);
  if (error) return { error: error.message };
  revalidatePath('/');
  revalidatePath('/archived');
  revalidatePath(`/app/${input.appSlug}`);
  return { ok: true };
}

/**
 * Hard-delete a project NOW, bypassing the 90-day grace window. Available
 * to any agency member, but only for projects that are already archived
 * (so accidental clicks while browsing live projects can't nuke them).
 * The confirmation must equal the slug to prevent muscle-memory mistakes.
 */
export async function hardDeleteArchivedProject(input: {
  appSlug: string;
  confirmation: string;
}): Promise<{ ok?: true; error?: string; deleted?: { frames: number; storage: number } }> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== 'agency') {
    return { error: 'Only agency members can hard-delete projects.' };
  }
  if (input.confirmation !== input.appSlug) {
    return { error: 'Confirmation slug does not match — type the slug exactly to proceed.' };
  }
  const admin = getSupabaseAdminClient();

  // 1) Find the app — must already be archived. We don't allow live projects
  //    to be hard-deleted in one shot; they have to go through archive first.
  const { data: app, error: lookupErr } = await admin
    .from('apps')
    .select('id, slug, archived_at')
    .eq('slug', input.appSlug)
    .maybeSingle();
  if (lookupErr) return { error: lookupErr.message };
  if (!app) return { error: 'Project not found.' };
  if (!app.archived_at) {
    return {
      error: 'Project must be archived first. Archive it, then return to hard-delete.',
    };
  }

  // 2) Count frames + collect storage paths so the caller can report scope.
  // Storage URLs are full https URLs; parse out the path-relative-to-bucket.
  const { data: frames, error: framesErr } = await admin
    .from('frames')
    .select('id, latest_image_url')
    .eq('app_id', app.id);
  if (framesErr) return { error: framesErr.message };
  const storagePaths = (frames ?? [])
    .map((f) => extractStoragePath(f.latest_image_url as string | null))
    .filter((p): p is string => Boolean(p));

  // 3) Bulk-delete storage objects (best-effort). Try R2 first (new
  //    uploads); then Supabase (legacy). Orphaned objects are annoying but
  //    DB rows going first means nothing points at them, so non-fatal.
  let storageDeleted = 0;
  if (storagePaths.length > 0) {
    const { r2DeleteMany } = await import('@/lib/r2');
    storageDeleted += await r2DeleteMany(storagePaths).catch(() => 0);
    // Legacy: also try Supabase for any old-prefix URLs.
    const { data: removed } = await admin.storage
      .from('screenshots')
      .remove(storagePaths);
    storageDeleted += removed?.length ?? 0;
  }

  // 4) Delete the app row — frames/builds/comments/etc. cascade.
  const { error: delErr } = await admin
    .from('apps')
    .delete()
    .eq('id', app.id);
  if (delErr) return { error: delErr.message };

  revalidatePath('/');
  revalidatePath('/archived');
  return {
    ok: true,
    deleted: { frames: frames?.length ?? 0, storage: storageDeleted },
  };
}

/**
 * Pull the bucket-relative key out of a storage URL (R2 or legacy Supabase).
 * Returns null for unrecognized shapes — orphaned objects are non-fatal.
 */
function extractStoragePath(url: string | null): string | null {
  if (!url) return null;
  // R2: https://pub-<hash>.r2.dev/<key>
  const r2Prefix =
    process.env['R2_PUBLIC_URL'] ??
    'https://pub-c3fbfb7655eb4a7589d726cc0dfae691.r2.dev';
  if (url.startsWith(r2Prefix + '/')) {
    return url.slice(r2Prefix.length + 1).split('?')[0] ?? null;
  }
  // Legacy Supabase: .../public/screenshots/<key>
  const m = /\/screenshots\/(.+?)(?:\?|$)/.exec(url);
  return m?.[1] ?? null;
}
