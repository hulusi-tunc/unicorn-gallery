import { NextResponse, type NextRequest } from 'next/server';
import { ARCHIVE_GRACE_DAYS } from '@/lib/db';
import { getSupabaseAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Daily cron — hard-deletes apps whose archived_at is older than the
 * grace window. Cascades through frames / builds / frame_versions /
 * comments via FK ON DELETE CASCADE; then best-effort wipes the bucket
 * objects so we don't pay for storage on dead PNGs.
 *
 * Auth: Authorization: Bearer <CRON_SECRET>. Vercel Cron sends this
 * header automatically when configured via vercel.json. CRON_SECRET
 * must be set as a project env var.
 *
 * Idempotent — running twice in the same day is fine. The query is
 * exact (`archived_at < now() - interval`), and a re-run finds zero
 * rows the second time.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: 'CRON_SECRET not configured.' },
      { status: 500 },
    );
  }
  const auth = request.headers.get('authorization') ?? '';
  const provided = auth.startsWith('Bearer ')
    ? auth.slice(7).trim()
    : auth.trim();
  if (provided !== cronSecret) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const admin = getSupabaseAdminClient();

  const cutoff = new Date(Date.now() - ARCHIVE_GRACE_DAYS * 24 * 60 * 60 * 1000);
  const { data: due, error: lookupErr } = await admin
    .from('apps')
    .select('id, slug, name, archived_at')
    .lt('archived_at', cutoff.toISOString());
  if (lookupErr) {
    return NextResponse.json({ error: lookupErr.message }, { status: 500 });
  }

  const results: Array<{ slug: string; ok: boolean; error?: string; frames?: number; storage?: number }> = [];

  for (const app of due ?? []) {
    try {
      // Collect storage paths first — once the row is gone, frames are
      // cascaded and we lose the URLs.
      const { data: frames } = await admin
        .from('frames')
        .select('latest_image_url')
        .eq('app_id', app.id);
      const storagePaths = (frames ?? [])
        .map((f) => extractStoragePath(f.latest_image_url as string | null))
        .filter((p): p is string => Boolean(p));

      // Delete app row — cascades frames / builds / frame_versions / comments.
      const { error: delErr } = await admin
        .from('apps')
        .delete()
        .eq('id', app.id);
      if (delErr) {
        results.push({ slug: app.slug, ok: false, error: delErr.message });
        continue;
      }

      // Best-effort storage wipe.
      let storageDeleted = 0;
      if (storagePaths.length > 0) {
        const { data: removed } = await admin.storage
          .from('screenshots')
          .remove(storagePaths);
        storageDeleted = removed?.length ?? 0;
      }

      results.push({
        slug: app.slug,
        ok: true,
        frames: frames?.length ?? 0,
        storage: storageDeleted,
      });
    } catch (err) {
      results.push({
        slug: app.slug,
        ok: false,
        error: (err as Error).message,
      });
    }
  }

  return NextResponse.json({
    ran_at: new Date().toISOString(),
    grace_days: ARCHIVE_GRACE_DAYS,
    cutoff: cutoff.toISOString(),
    found: due?.length ?? 0,
    deleted: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}

function extractStoragePath(url: string | null): string | null {
  if (!url) return null;
  const m = /\/screenshots\/(.+?)(?:\?|$)/.exec(url);
  return m?.[1] ?? null;
}
