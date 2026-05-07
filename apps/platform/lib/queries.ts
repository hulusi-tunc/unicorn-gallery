import 'server-only';
import { getSupabaseServerClient } from './supabase/server';
import type { AppRow, Build, Frame, ManifestSnapshot, Profile } from './db';

/** Returns the signed-in user's profile, or null if not signed in. */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  if (error) return null;
  return data as Profile;
}

/** Lists apps visible to the current user (via RLS). Most-recent first. */
export async function listVisibleApps(): Promise<AppRow[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from('apps')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as AppRow[];
}

export async function getAppBySlug(slug: string): Promise<AppRow | null> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from('apps')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (error) return null;
  return data as AppRow | null;
}

export async function getLatestBuild(appId: string): Promise<Build | null> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from('builds')
    .select('*')
    .eq('app_id', appId)
    .eq('is_visible', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data as Build | null;
}

export async function listFramesForApp(appId: string): Promise<Frame[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from('frames')
    .select('*')
    .eq('app_id', appId)
    .order('flow_id', { ascending: true })
    .order('frame_id', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Frame[];
}

/**
 * Reconstruct a manifest from the `frames` table (source of truth) instead
 * of `builds.manifest` (only ever holds the most recent upload's snapshot —
 * which is the last batch when the capture client chunks).
 *
 * Returns null if there are no frames for the app yet.
 */
export async function getManifestForApp(
  appId: string,
): Promise<ManifestSnapshot | null> {
  const [latestBuild, frames] = await Promise.all([
    getLatestBuild(appId),
    listFramesForApp(appId),
  ]);
  if (frames.length === 0) return null;

  const byFlow = new Map<
    string,
    { id: string; name: string; frames: Frame[] }
  >();
  for (const f of frames) {
    let g = byFlow.get(f.flow_id);
    if (!g) {
      g = { id: f.flow_id, name: f.flow_name, frames: [] };
      byFlow.set(f.flow_id, g);
    }
    g.frames.push(f);
  }

  return {
    projectId: '',
    buildSha: latestBuild?.sha ?? '',
    capturedAt: latestBuild?.captured_at ?? new Date().toISOString(),
    platform: latestBuild?.platform ?? 'ios',
    flows: Array.from(byFlow.values()).map((g) => ({
      id: g.id,
      name: g.name,
      frames: g.frames.map((f) => ({
        id: f.frame_id,
        name: f.frame_name,
        image: f.latest_image_url ?? '',
      })),
    })),
  };
}
