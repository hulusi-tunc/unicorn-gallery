import 'server-only';

import { getSupabaseAdminClient } from '@/lib/supabase/server';
import type { Release, ReleaseKind } from '@/lib/releases-shared';

const COLS =
  'id, kind, channel, version, file_url, file_name, size_bytes, notes, created_at';

/**
 * Newest release per (kind, channel). The download page only ever shows the
 * current build, so this collapses history server-side rather than shipping
 * every row to the client.
 */
export async function getLatestReleases(): Promise<Release[]> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('app_releases')
    .select(COLS)
    .order('created_at', { ascending: false });
  if (error || !data) return [];

  const seen = new Set<string>();
  const latest: Release[] = [];
  for (const row of data as Release[]) {
    const key = `${row.kind}::${row.channel}`;
    if (seen.has(key)) continue;
    seen.add(key);
    latest.push(row);
  }
  return latest;
}

/** Full history for one artifact, newest first. */
export async function getReleaseHistory(kind: ReleaseKind): Promise<Release[]> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('app_releases')
    .select(COLS)
    .eq('kind', kind)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error || !data) return [];
  return data as Release[];
}
