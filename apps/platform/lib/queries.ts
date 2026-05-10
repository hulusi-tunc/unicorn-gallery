import 'server-only';
import { cache } from 'react';
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

/**
 * Returns the signed-in user's profile, or null if not signed in.
 *
 * Wrapped in React's `cache()` so the dashboard layout + every child page
 * that calls this share a single result per request. Saves a Supabase Auth
 * round-trip + a profiles SELECT per duplicate caller.
 */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
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
});

const APP_WITH_STAFF_SELECT = `
  *,
  designer:profiles!apps_designer_id_fkey(id, email, name, flavor, avatar_url),
  pm:profiles!apps_pm_id_fkey(id, email, name, flavor, avatar_url)
`;

/**
 * Lists apps visible to the current user (via RLS), with designer+PM joined.
 *
 * Archive-aware: archived apps are hidden by default. Pass
 * `{ includeArchived: true }` to surface them (used by the "Archived" admin
 * view and by listArchivedApps below) or `{ archivedOnly: true }` to fetch
 * only the archived set.
 */
export async function listVisibleApps(options?: {
  includeArchived?: boolean;
  archivedOnly?: boolean;
}): Promise<AppRowWithStaff[]> {
  const supabase = await getSupabaseServerClient();
  let query = supabase
    .from('apps')
    .select(APP_WITH_STAFF_SELECT)
    .order('created_at', { ascending: false });
  if (options?.archivedOnly) {
    query = query.not('archived_at', 'is', null);
  } else if (!options?.includeArchived) {
    query = query.is('archived_at', null);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as AppRowWithStaff[];
}

/** Same as listVisibleApps but only the archived rows, newest-archived first. */
export async function listArchivedApps(): Promise<AppRowWithStaff[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from('apps')
    .select(APP_WITH_STAFF_SELECT)
    .not('archived_at', 'is', null)
    .order('archived_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as AppRowWithStaff[];
}

/**
 * Frames in this app whose latest push (frames.latest_build_id → builds
 * .created_at) happened AFTER the user's last frame_reads.last_read_at.
 * Frames the user has never opened also count — they're brand new for them.
 *
 * Used by the per-flow strip + filmstrip to drop a small "Updated" pill
 * on cards that have been re-snapped since the user last visited, mirroring
 * Capture's desktop "Updated" badge.
 *
 * Returns a Set of frame UUIDs (not the desktop `frame_id` strings) so the
 * caller can match against frames.id when iterating manifest frames + their
 * resolved DB rows. For now we just use the desktop frame_id since that's
 * what JourneyStrip has on hand — see resolveByFrameKey below.
 */
export async function getFreshFrameKeys(
  userId: string,
  appId: string,
): Promise<Set<string>> {
  const supabase = await getSupabaseServerClient();
  // Pull frames + their latest build's created_at + the user's read time.
  const { data: frames, error: framesErr } = await supabase
    .from('frames')
    .select('id, frame_id, latest_build_id')
    .eq('app_id', appId);
  if (framesErr || !frames) return new Set();
  const buildIds = Array.from(
    new Set(
      (frames as Array<{ latest_build_id: string | null }>)
        .map((f) => f.latest_build_id)
        .filter((b): b is string => Boolean(b)),
    ),
  );
  if (buildIds.length === 0) return new Set();
  const [{ data: builds }, { data: reads }] = await Promise.all([
    supabase.from('builds').select('id, created_at').in('id', buildIds),
    supabase
      .from('frame_reads')
      .select('frame_id, last_read_at')
      .eq('user_id', userId)
      .in(
        'frame_id',
        (frames as Array<{ id: string }>).map((f) => f.id),
      ),
  ]);
  const buildAt = new Map<string, string>();
  for (const b of (builds ?? []) as Array<{ id: string; created_at: string }>) {
    buildAt.set(b.id, b.created_at);
  }
  const readAt = new Map<string, string>();
  for (const r of (reads ?? []) as Array<{ frame_id: string; last_read_at: string }>) {
    readAt.set(r.frame_id, r.last_read_at);
  }
  const fresh = new Set<string>();
  for (const f of frames as Array<{
    id: string;
    frame_id: string;
    latest_build_id: string | null;
  }>) {
    if (!f.latest_build_id) continue;
    const updatedAt = buildAt.get(f.latest_build_id);
    if (!updatedAt) continue;
    const seenAt = readAt.get(f.id);
    if (!seenAt || updatedAt > seenAt) {
      fresh.add(f.frame_id);
    }
  }
  return fresh;
}

/**
 * Pull the per-frame capture history from frame_captures. Latest first
 * (idx ASC: idx 0 = latest, 1+ = past versions newest-first like Capture
 * orders snap.versions[]). Used by the frame view's version scrubber.
 */
export async function listFrameCaptures(
  frameRowId: string,
): Promise<Array<{ idx: number; image_url: string; captured_at: string }>> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from('frame_captures')
    .select('idx, image_url, captured_at')
    .eq('frame_id', frameRowId)
    .order('idx', { ascending: true });
  if (error) return [];
  return (data ?? []) as Array<{ idx: number; image_url: string; captured_at: string }>;
}

/**
 * Look up an app by slug. Returns archived rows too — viewing an archived
 * project's restore page or surfacing the "deleting in N days" banner needs
 * to find them. Filter at the call site if you need active-only.
 */
export const getAppBySlug = cache(
  async (slug: string): Promise<AppRowWithStaff | null> => {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
      .from('apps')
      .select(APP_WITH_STAFF_SELECT)
      .eq('slug', slug)
      .maybeSingle();
    if (error) return null;
    return data as unknown as AppRowWithStaff | null;
  },
);

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
    .select('id, email, name, flavor, avatar_url')
    .eq('role', 'agency')
    .order('name', { ascending: true });
  if (error) return [];
  return (data ?? []) as ProfileLite[];
}

export const getLatestBuild = cache(async (appId: string): Promise<Build | null> => {
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
});

/**
 * Per-frame unread comment count for the current user.
 * Returned as a Map<frame_row_id, unread_count> so the caller can spread
 * indicator badges across thumbnails / sidebar / app cards.
 *
 * "Unread" = a comment created after the user's last_read_at for that frame
 * (or any comment if the user has never opened the frame), AND not authored
 * by the user themselves (don't ping someone with their own comment).
 */
export async function getUnreadCountsByFrame(userId: string): Promise<Map<string, number>> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc('get_unread_comment_counts', { p_user_id: userId });
  if (error || !data) {
    // Fallback: compute in-app if the RPC doesn't exist yet (cold migration).
    return computeUnreadCountsClient(userId);
  }
  const m = new Map<string, number>();
  for (const row of data as Array<{ frame_id: string; unread: number }>) {
    m.set(row.frame_id, Number(row.unread));
  }
  return m;
}

async function computeUnreadCountsClient(userId: string): Promise<Map<string, number>> {
  const supabase = await getSupabaseServerClient();
  // Pull all visible comments + the user's frame_reads, then diff client-side.
  // For small scale this is fine; if this grows, we'll add a SQL RPC.
  const [{ data: comments }, { data: reads }] = await Promise.all([
    supabase.from('comments').select('frame_id, author_id, created_at').neq('author_id', userId),
    supabase.from('frame_reads').select('frame_id, last_read_at').eq('user_id', userId),
  ]);
  const lastRead = new Map<string, string>();
  for (const r of (reads ?? []) as Array<{ frame_id: string; last_read_at: string }>) {
    lastRead.set(r.frame_id, r.last_read_at);
  }
  const m = new Map<string, number>();
  for (const c of (comments ?? []) as Array<{ frame_id: string; created_at: string }>) {
    const lr = lastRead.get(c.frame_id);
    if (!lr || c.created_at > lr) {
      m.set(c.frame_id, (m.get(c.frame_id) ?? 0) + 1);
    }
  }
  return m;
}

/**
 * Per-app unread notification counts for the current user, plus the total
 * across all apps for the topbar bell badge. Returned together so the
 * dashboard load makes ONE notifications query instead of two.
 */
export const getUnreadOverview = cache(async (
  userId: string,
): Promise<{ total: number; byApp: Map<string, number> }> => {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from('notifications')
    .select('app_id')
    .eq('user_id', userId)
    .is('seen_at', null);
  if (error || !data) return { total: 0, byApp: new Map() };
  const byApp = new Map<string, number>();
  for (const row of data as Array<{ app_id: string }>) {
    byApp.set(row.app_id, (byApp.get(row.app_id) ?? 0) + 1);
  }
  return { total: data.length, byApp };
});

/** @deprecated — prefer getUnreadOverview. Kept for backwards compatibility. */
export async function getUnreadCountsByApp(userId: string): Promise<Map<string, number>> {
  const { byApp } = await getUnreadOverview(userId);
  return byApp;
}

/**
 * Per-flow + per-frame unread counts within a single app, keyed by the
 * MANIFEST string ids (flow.id and frame.id from the manifest), so the
 * flow sidebar and frame thumbnails can drop indicators directly.
 */
export async function getUnreadByFlowAndFrameForApp(
  appId: string,
  userId: string,
): Promise<{ byFlow: Map<string, number>; byFrame: Map<string, number> }> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from('notifications')
    .select('frame:frames!notifications_frame_id_fkey(flow_id, frame_id)')
    .eq('user_id', userId)
    .eq('app_id', appId)
    .is('seen_at', null);
  const byFlow = new Map<string, number>();
  const byFrame = new Map<string, number>();
  if (error || !data) return { byFlow, byFrame };
  for (const row of data as unknown as Array<{
    frame: { flow_id: string; frame_id: string } | null;
  }>) {
    if (!row.frame) continue;
    const f = row.frame.flow_id;
    const k = `${row.frame.flow_id}::${row.frame.frame_id}`;
    byFlow.set(f, (byFlow.get(f) ?? 0) + 1);
    byFrame.set(k, (byFrame.get(k) ?? 0) + 1);
  }
  return { byFlow, byFrame };
}

/**
 * Total unread comments across every visible app, for the topbar bell badge.
 * Routes through `getUnreadOverview` which is request-cached, so calling this
 * in the dashboard layout AND `getUnreadCountsByApp` in the page costs only
 * one notifications query.
 */
export async function getTotalUnreadCount(userId: string): Promise<number> {
  const { total } = await getUnreadOverview(userId);
  return total;
}

export interface NotificationFeedItem {
  id: string;
  kind: 'comment' | 'mention' | 'reply';
  seen_at: string | null;
  created_at: string;
  comment: {
    id: string;
    body: string;
    parent_id: string | null;
  } | null;
  frame: {
    id: string;
    flow_id: string;
    frame_id: string;
    flow_name: string;
    frame_name: string;
    latest_image_url: string | null;
  } | null;
  app: {
    id: string;
    slug: string;
    name: string;
    accent_color: string | null;
  } | null;
  actor: ProfileLite | null;
}

export async function listNotifications(
  userId: string,
  opts: { limit?: number; onlyUnseen?: boolean } = {},
): Promise<NotificationFeedItem[]> {
  const supabase = await getSupabaseServerClient();
  const limit = opts.limit ?? 50;
  let q = supabase
    .from('notifications')
    .select(
      'id, kind, seen_at, created_at, ' +
        'comment:comments!notifications_comment_id_fkey(id, body, parent_id), ' +
        'frame:frames!notifications_frame_id_fkey(id, flow_id, frame_id, flow_name, frame_name, latest_image_url), ' +
        'app:apps!notifications_app_id_fkey(id, slug, name, accent_color), ' +
        'actor:profiles!notifications_actor_id_fkey(id, email, name, flavor, avatar_url)',
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (opts.onlyUnseen) q = q.is('seen_at', null);
  const { data, error } = await q;
  if (error) return [];
  return (data ?? []) as unknown as NotificationFeedItem[];
}

/**
 * Profiles that the agency or this app's customers can @mention from a
 * comment on this app: every agency user + every customer linked to this app.
 */
export interface MentionableProfile {
  id: string;
  email: string;
  name: string | null;
  /** Stable handle used in @-mention text. lowercased email-prefix. */
  handle: string;
  role: 'agency' | 'customer';
  avatar_url: string | null;
}

export async function getMentionableProfilesForApp(
  appId: string,
): Promise<MentionableProfile[]> {
  const supabase = await getSupabaseServerClient();
  const [agency, customers] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, email, name, role, avatar_url')
      .eq('role', 'agency')
      .order('name', { ascending: true }),
    supabase
      .from('app_customers')
      .select('profile:profiles!inner(id, email, name, role, avatar_url)')
      .eq('app_id', appId),
  ]);
  const out: MentionableProfile[] = [];
  for (const p of (agency.data ?? []) as Array<{
    id: string;
    email: string;
    name: string | null;
    role: 'agency' | 'customer';
    avatar_url: string | null;
  }>) {
    out.push({ ...p, handle: handleFromEmail(p.email) });
  }
  for (const row of (customers.data ?? []) as unknown as Array<{
    profile: {
      id: string;
      email: string;
      name: string | null;
      role: 'agency' | 'customer';
      avatar_url: string | null;
    };
  }>) {
    const p = row.profile;
    if (out.find((o) => o.id === p.id)) continue;
    out.push({ ...p, handle: handleFromEmail(p.email) });
  }
  return out;
}

function handleFromEmail(email: string): string {
  return (email.split('@')[0] ?? email).toLowerCase().replace(/[^a-z0-9_.-]/g, '');
}

export interface AppCustomerWithProfile {
  user_id: string;
  added_at: string;
  invited_by: string | null;
  profile: ProfileLite & { role: 'agency' | 'customer' };
}

export async function listAppCustomers(appId: string): Promise<AppCustomerWithProfile[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from('app_customers')
    .select(
      'user_id, added_at, invited_by, profile:profiles!inner(id, email, name, flavor, avatar_url, role)',
    )
    .eq('app_id', appId)
    .order('added_at', { ascending: false });
  if (error) return [];
  return (data ?? []) as unknown as AppCustomerWithProfile[];
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
export const getManifestForApp = cache(async (
  appId: string,
): Promise<ManifestSnapshot | null> => {
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
});

// ─────────────────────────────────────────────────────────────────────────────
// Version history
// ─────────────────────────────────────────────────────────────────────────────

export interface BuildSummary {
  id: string;
  version: number | null;
  sha: string;
  message: string | null;
  capturedAt: string;
  createdAt: string;
  added: number;
  updated: number;
  renamed: number;
  removed: number;
  unchanged: number;
}

/**
 * List all builds for an app (newest first) with per-build diff counts.
 * Counts come from `frame_versions.change_kind` for each build, plus a
 * computed `removed` count = frames in the previous build missing from this one.
 */
export async function listBuildsForApp(appId: string): Promise<BuildSummary[]> {
  const supabase = await getSupabaseServerClient();
  const { data: builds, error } = await supabase
    .from('builds')
    .select('id, version, sha, message, captured_at, created_at')
    .eq('app_id', appId)
    .order('created_at', { ascending: false });
  if (error || !builds) return [];

  // Pull all frame_versions for this app once and bucket by build_id.
  const { data: rows } = await supabase
    .from('frame_versions')
    .select('build_id, flow_id, frame_id, change_kind')
    .eq('app_id', appId);

  const byBuild = new Map<string, { kinds: Record<string, number>; keys: Set<string> }>();
  for (const r of rows ?? []) {
    let entry = byBuild.get(r.build_id);
    if (!entry) {
      entry = { kinds: { added: 0, updated: 0, renamed: 0, unchanged: 0 }, keys: new Set() };
      byBuild.set(r.build_id, entry);
    }
    entry.kinds[r.change_kind] = (entry.kinds[r.change_kind] ?? 0) + 1;
    entry.keys.add(`${r.flow_id}::${r.frame_id}`);
  }

  // Builds are newest-first; previous build (for removed-detection) is the
  // next entry in the array.
  return builds.map((b, i) => {
    const cur = byBuild.get(b.id);
    const prev = i + 1 < builds.length ? byBuild.get(builds[i + 1]!.id) : undefined;
    let removed = 0;
    if (prev && cur) {
      for (const key of prev.keys) if (!cur.keys.has(key)) removed++;
    }
    return {
      id: b.id,
      version: b.version,
      sha: b.sha,
      message: b.message,
      capturedAt: b.captured_at,
      createdAt: b.created_at,
      added: cur?.kinds.added ?? 0,
      updated: cur?.kinds.updated ?? 0,
      renamed: cur?.kinds.renamed ?? 0,
      unchanged: cur?.kinds.unchanged ?? 0,
      removed,
    };
  });
}
