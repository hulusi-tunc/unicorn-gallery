import 'server-only';
import { getSupabaseServerClient } from './supabase/server';
import type {
  AppRow,
  AppRowWithStaff,
  Build,
  Frame,
  ManifestSnapshot,
  Profile,
  ProfileLite,
} from './db';

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

const APP_WITH_STAFF_SELECT = `
  *,
  designer:profiles!apps_designer_id_fkey(id, email, name, flavor, avatar_url),
  pm:profiles!apps_pm_id_fkey(id, email, name, flavor, avatar_url)
`;

/** Lists apps visible to the current user (via RLS), with designer+PM joined. */
export async function listVisibleApps(): Promise<AppRowWithStaff[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from('apps')
    .select(APP_WITH_STAFF_SELECT)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as AppRowWithStaff[];
}

export async function getAppBySlug(slug: string): Promise<AppRowWithStaff | null> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from('apps')
    .select(APP_WITH_STAFF_SELECT)
    .eq('slug', slug)
    .maybeSingle();
  if (error) return null;
  return data as unknown as AppRowWithStaff | null;
}

/**
 * Admin-only: lists every profile (agency + customer) for the admin users
 * table. Uses the service role to bypass RLS and the trip through Supabase
 * server client so we always have a fresh fetch.
 */
export async function listAllProfiles(): Promise<Profile[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Profile[];
}

/** Lists every agency profile — used for the designer / PM picker. */
export async function listAgencyProfiles(): Promise<ProfileLite[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, name, flavor, avatar_url, is_admin')
    .eq('role', 'agency')
    .order('name', { ascending: true });
  if (error) return [];
  return (data ?? []) as ProfileLite[];
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
  // Order by capture-assigned positions so the web view mirrors the
  // desktop view exactly. Rows without positions (older uploads) sort
  // last via `nullsFirst: false`, then by flow_id/frame_id as fallback.
  const { data, error } = await supabase
    .from('frames')
    .select('*')
    .eq('app_id', appId)
    .order('flow_position', { ascending: true, nullsFirst: false })
    .order('flow_id', { ascending: true })
    .order('frame_position', { ascending: true, nullsFirst: false })
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
    {
      id: string;
      name: string;
      parentFlowId: string | null;
      frames: Frame[];
    }
  >();
  for (const f of frames) {
    let g = byFlow.get(f.flow_id);
    if (!g) {
      g = {
        id: f.flow_id,
        name: f.flow_name,
        parentFlowId: f.parent_flow_id,
        frames: [],
      };
      byFlow.set(f.flow_id, g);
    } else if (g.parentFlowId == null && f.parent_flow_id) {
      // Earlier rows for this flow may pre-date the parent migration.
      // Pick up the parent the moment any row references it.
      g.parentFlowId = f.parent_flow_id;
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
      parentFlowId: g.parentFlowId ?? undefined,
      frames: g.frames.map((f) => ({
        id: f.frame_id,
        name: f.frame_name,
        image: f.latest_image_url ?? '',
      })),
    })),
  };
}
