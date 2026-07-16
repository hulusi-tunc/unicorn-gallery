import 'server-only';
import { cache } from 'react';
import { getSupabaseServerClient } from './supabase/server';
import type {
  AppRow,
  AppRowWithStaff,
  Build,
  DorAssessment,
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
 * App ids the current user has pinned ("favorited") to the top of their
 * dashboard. Per-user; a Set for O(1) lookup when sorting + rendering cards.
 */
export async function getFavoriteAppIds(userId: string): Promise<Set<string>> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from('app_favorites')
    .select('app_id')
    .eq('user_id', userId);
  if (error || !data) return new Set();
  return new Set((data as Array<{ app_id: string }>).map((r) => r.app_id));
}

/**
 * A few representative screen thumbnails per app for the dashboard card's
 * hover carousel: the FIRST frame of each distinct flow, in capture order,
 * capped at `perApp`. Keyed by app id. Apps with no frames are absent — the
 * card falls back to its single `preview_image_url`. One query for the whole
 * grid (RLS scopes it to apps the user can see).
 */
export async function getPreviewFramesByApp(
  appIds: string[],
  perApp = 6,
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (appIds.length === 0) return out;
  const supabase = await getSupabaseServerClient();
  // Capture order mirrors the desktop view (see listFramesForApp): flow
  // position first, then frame position. We take the first frame we see per
  // (app, flow), so each preview is a distinct flow's opening screen.
  const { data, error } = await supabase
    .from('frames')
    .select('app_id, flow_id, latest_image_url, flow_position, frame_position')
    .in('app_id', appIds)
    .not('latest_image_url', 'is', null)
    .order('flow_position', { ascending: true, nullsFirst: false })
    .order('flow_id', { ascending: true })
    .order('frame_position', { ascending: true, nullsFirst: false });
  if (error || !data) return out;
  const flowsSeen = new Map<string, Set<string>>();
  for (const r of data as Array<{
    app_id: string;
    flow_id: string;
    latest_image_url: string | null;
  }>) {
    if (!r.latest_image_url) continue;
    let seen = flowsSeen.get(r.app_id);
    if (!seen) {
      seen = new Set();
      flowsSeen.set(r.app_id, seen);
    }
    if (seen.has(r.flow_id)) continue; // already took this flow's opening frame
    const list = out.get(r.app_id) ?? [];
    if (list.length >= perApp) continue;
    seen.add(r.flow_id);
    list.push(r.latest_image_url);
    out.set(r.app_id, list);
  }
  return out;
}

export interface FrameUnresolvedSummary {
  count: number;
  /** Most recent unresolved comments, newest-first. Capped at 3 for hover. */
  preview: Array<{
    authorName: string | null;
    authorEmail: string;
    authorRole: 'agency' | 'customer';
    authorAvatarUrl: string | null;
    body: string;
    createdAt: string;
  }>;
}

/**
 * Returns a Map from manifest `frame_id` string → unresolved comment
 * summary (count + a short preview of the latest comments). Frames with
 * zero unresolved comments are absent from the map. Used by the per-flow
 * strip to surface an orange badge on cards with open feedback so PMs
 * can scan a flow at a glance AND hover for a quick look at what's open
 * without clicking through to the frame.
 */
export async function getUnresolvedCommentsByFrame(
  appId: string,
): Promise<Map<string, FrameUnresolvedSummary>> {
  const supabase = await getSupabaseServerClient();
  const { data: frames, error: framesErr } = await supabase
    .from('frames')
    .select('id, frame_id')
    .eq('app_id', appId);
  if (framesErr || !frames || frames.length === 0) return new Map();
  const idToKey = new Map<string, string>();
  for (const f of frames as Array<{ id: string; frame_id: string }>) {
    idToKey.set(f.id, f.frame_id);
  }
  const { data: comments, error: commentsErr } = await supabase
    .from('comments')
    .select(
      'frame_id, body, created_at, author:profiles!comments_author_id_fkey(name, email, role, avatar_url)',
    )
    .in('frame_id', Array.from(idToKey.keys()))
    .is('resolved_at', null)
    .order('created_at', { ascending: false });
  if (commentsErr) return new Map();
  const result = new Map<string, FrameUnresolvedSummary>();
  type AuthorRow = {
    name: string | null;
    email: string;
    role: 'agency' | 'customer';
    avatar_url: string | null;
  };
  type RawComment = {
    frame_id: string;
    body: string;
    created_at: string;
    // Supabase types nested selects as arrays even for single FK joins.
    author: AuthorRow | AuthorRow[] | null;
  };
  for (const c of (comments ?? []) as unknown as RawComment[]) {
    const key = idToKey.get(c.frame_id);
    if (!key) continue;
    let entry = result.get(key);
    if (!entry) {
      entry = { count: 0, preview: [] };
      result.set(key, entry);
    }
    entry.count += 1;
    if (entry.preview.length < 3) {
      const a = Array.isArray(c.author) ? c.author[0] : c.author;
      entry.preview.push({
        authorName: a?.name ?? null,
        authorEmail: a?.email ?? '',
        authorRole: a?.role ?? 'customer',
        authorAvatarUrl: a?.avatar_url ?? null,
        body: c.body,
        createdAt: c.created_at,
      });
    }
  }
  return result;
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
 * Look up a specific build by its per-app version number. Powers the
 * `?v=N` URL contract — the dropdown links to `?v=2`, this query
 * resolves it to the build's UUID for `getManifestForApp(appId, buildId)`.
 */
export async function getBuildByVersion(
  appId: string,
  version: number,
): Promise<Build | null> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from('builds')
    .select('*')
    .eq('app_id', appId)
    .eq('version', version)
    .maybeSingle();
  if (error) return null;
  return data as Build | null;
}

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

export interface ProjectMemberWithProfile {
  user_id: string;
  added_at: string;
  assigned_by: string | null;
  profile: ProfileLite & { role: 'agency' | 'customer' };
}

/**
 * Studio members assigned to a project via project_members. These are the
 * agency users who will see the project in the Capture desktop app and can
 * push captures to it. The owner sees every project regardless and is not
 * required to have a row here. The explicit FK hint disambiguates the two
 * profile foreign keys (user_id, assigned_by).
 */
export async function listProjectMembers(
  appId: string,
): Promise<ProjectMemberWithProfile[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from('project_members')
    .select(
      'user_id, added_at, assigned_by, profile:profiles!project_members_user_id_fkey(id, email, name, flavor, avatar_url, role)',
    )
    .eq('app_id', appId)
    .order('added_at', { ascending: false });
  if (error) return [];
  return (data ?? []) as unknown as ProjectMemberWithProfile[];
}

export interface EligibleCustomer {
  user_id: string;
  profile: ProfileLite;
  /** True when this customer is already linked to the current app. */
  alreadyOnThisApp: boolean;
  /** Names of other (non-archived) apps this customer is already on. */
  otherApps: { slug: string; name: string }[];
}

/**
 * Lists every customer profile in the system, with hints about which apps
 * each one already has access to. Powers the "existing customers" picker
 * in the Share dialog so an agency PM can attach a known customer to a
 * new app in one click — no email re-typing, no duplicate auth accounts
 * from typos.
 *
 * The source of truth is `profiles` (role='customer'), NOT `app_customers`
 * — a customer who exists but has no app linkage yet (e.g. role flipped
 * manually from the admin page) still shows up in the picker.
 */
export async function listEligibleCustomersForApp(
  appId: string,
): Promise<EligibleCustomer[]> {
  const supabase = await getSupabaseServerClient();

  const [profilesRes, linksRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, email, name, flavor, avatar_url')
      .eq('role', 'customer'),
    supabase
      .from('app_customers')
      .select('user_id, app:apps!inner(id, slug, name, archived_at)'),
  ]);

  if (profilesRes.error) return [];

  const profiles = (profilesRes.data ?? []) as unknown as ProfileLite[];
  const links = (linksRes.data ?? []) as unknown as Array<{
    user_id: string;
    app: { id: string; slug: string; name: string; archived_at: string | null };
  }>;

  const linksByUser = new Map<
    string,
    { alreadyOnThisApp: boolean; otherApps: { slug: string; name: string }[] }
  >();
  for (const row of links) {
    if (row.app.archived_at) continue;
    let entry = linksByUser.get(row.user_id);
    if (!entry) {
      entry = { alreadyOnThisApp: false, otherApps: [] };
      linksByUser.set(row.user_id, entry);
    }
    if (row.app.id === appId) {
      entry.alreadyOnThisApp = true;
    } else {
      entry.otherApps.push({ slug: row.app.slug, name: row.app.name });
    }
  }

  return profiles
    .map<EligibleCustomer>((p) => {
      const link = linksByUser.get(p.id);
      return {
        user_id: p.id,
        profile: {
          id: p.id,
          email: p.email,
          name: p.name,
          flavor: p.flavor,
          avatar_url: p.avatar_url,
        },
        alreadyOnThisApp: link?.alreadyOnThisApp ?? false,
        otherApps: link?.otherApps ?? [],
      };
    })
    .sort((a, b) => {
      const an = a.profile.name?.trim() || a.profile.email;
      const bn = b.profile.name?.trim() || b.profile.email;
      return an.localeCompare(bn);
    });
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
 * Reconstruct a manifest for an app at a specific version.
 *
 * - When `buildId` is omitted: returns the LATEST view, built from the
 *   `frames` table (source of truth for positions, parent_flow_id, names).
 *   This is what every page renders by default.
 * - When `buildId` is provided: returns that version's snapshot, built from
 *   `frame_versions` rows for that build. Positions and parent_flow_id are
 *   filled in from the `frames` table when the frame still exists there;
 *   otherwise they default to insertion order / null.
 *
 * Returns null if the app has no frames at that version.
 */
export const getManifestForApp = cache(async (
  appId: string,
  buildId?: string,
): Promise<ManifestSnapshot | null> => {
  if (buildId) {
    return getManifestForBuild(appId, buildId);
  }
  const [latestBuild, frames] = await Promise.all([
    getLatestBuild(appId),
    listFramesForApp(appId),
  ]);
  if (frames.length === 0) return null;

  // Only render frames that are part of the latest version. After the
  // version-history rewrite we no longer delete orphan frames on replace
  // pushes — they stay so old version views can render them — so the
  // `frames` table can contain rows from prior versions. Filter to the
  // current build's frame_versions to scope the default view correctly.
  const currentKeys = latestBuild
    ? await listFrameKeysForBuild(latestBuild.id)
    : null;

  // If frame_versions has no rows for the latest build (pre-migration
  // legacy data, or some odd state) fall back to showing every frame so
  // the dashboard isn't accidentally blank.
  const visibleFrames =
    currentKeys && currentKeys.size > 0
      ? frames.filter((f) => currentKeys.has(`${f.flow_id}::${f.frame_id}`))
      : frames;

  const byFlow = new Map<
    string,
    {
      id: string;
      name: string;
      parentFlowId: string | null;
      frames: Frame[];
    }
  >();
  for (const f of visibleFrames) {
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
      g.parentFlowId = f.parent_flow_id;
    }
    g.frames.push(f);
  }

  // Inject empty grouping flows (containers that hold sub-flows but no frames
  // of their own) from the build's stored flow tree, so children stay nested
  // under them instead of falling back to the top level. Only ancestors of
  // flows that actually have frames are added, so stale containers never
  // resurface.
  const treeMeta = (latestBuild?.flow_tree ?? []) as Array<{
    id: string;
    name: string;
    parentFlowId: string | null;
  }>;
  if (treeMeta.length > 0) {
    const metaById = new Map(treeMeta.map((m) => [m.id, m]));
    for (const g of Array.from(byFlow.values())) {
      let pid = g.parentFlowId;
      while (pid && !byFlow.has(pid)) {
        const m = metaById.get(pid);
        if (!m) break;
        byFlow.set(pid, { id: m.id, name: m.name, parentFlowId: m.parentFlowId, frames: [] });
        pid = m.parentFlowId;
      }
    }
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

/**
 * Returns the set of `${flow_id}::${frame_id}` keys that belong to a given
 * build. Used to filter the latest-view manifest to current-version frames.
 */
async function listFrameKeysForBuild(buildId: string): Promise<Set<string>> {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase
    .from('frame_versions')
    .select('flow_id, frame_id')
    .eq('build_id', buildId);
  const out = new Set<string>();
  for (const r of (data ?? []) as Array<{ flow_id: string; frame_id: string }>) {
    out.add(`${r.flow_id}::${r.frame_id}`);
  }
  return out;
}

/**
 * Build a manifest for a specific (non-current) build. Reads
 * `frame_versions` for the version's screen list + per-version image_url +
 * frame_name, then joins with the `frames` table for structural metadata
 * (parent_flow_id, positions). Frames that no longer exist in `frames`
 * (e.g. the desktop-reset scenario where IDs changed) fall back to
 * insertion order.
 */
async function getManifestForBuild(
  appId: string,
  buildId: string,
): Promise<ManifestSnapshot | null> {
  const supabase = await getSupabaseServerClient();
  const [versionsResult, build] = await Promise.all([
    supabase
      .from('frame_versions')
      .select('flow_id, frame_id, flow_name, frame_name, image_url')
      .eq('build_id', buildId)
      .eq('app_id', appId),
    (async () => {
      const { data } = await supabase
        .from('builds')
        .select('sha, captured_at, platform, flow_tree')
        .eq('id', buildId)
        .eq('app_id', appId)
        .maybeSingle();
      return data as {
        sha: string;
        captured_at: string;
        platform: string;
        flow_tree?: Array<{ id: string; name: string; parentFlowId: string | null; position: number | null }> | null;
      } | null;
    })(),
  ]);
  const versions = (versionsResult.data ?? []) as Array<{
    flow_id: string;
    frame_id: string;
    flow_name: string;
    frame_name: string;
    image_url: string;
  }>;
  if (versions.length === 0) return null;

  // Pull structural fields from `frames` for frames that still exist
  // (positions, parent_flow_id). Build a lookup by (flow_id, frame_id).
  const { data: frameRows } = await supabase
    .from('frames')
    .select('flow_id, frame_id, parent_flow_id, flow_position, frame_position')
    .eq('app_id', appId);
  const structural = new Map<
    string,
    {
      parent_flow_id: string | null;
      flow_position: number | null;
      frame_position: number | null;
    }
  >();
  for (const r of (frameRows ?? []) as Array<{
    flow_id: string;
    frame_id: string;
    parent_flow_id: string | null;
    flow_position: number | null;
    frame_position: number | null;
  }>) {
    structural.set(`${r.flow_id}::${r.frame_id}`, {
      parent_flow_id: r.parent_flow_id,
      flow_position: r.flow_position,
      frame_position: r.frame_position,
    });
  }

  const byFlow = new Map<
    string,
    {
      id: string;
      name: string;
      parentFlowId: string | null;
      position: number | null;
      frames: Array<{
        id: string;
        name: string;
        image: string;
        position: number | null;
      }>;
    }
  >();
  let frameOrderCounter = 0;
  for (const v of versions) {
    const s = structural.get(`${v.flow_id}::${v.frame_id}`);
    let g = byFlow.get(v.flow_id);
    if (!g) {
      g = {
        id: v.flow_id,
        name: v.flow_name,
        parentFlowId: s?.parent_flow_id ?? null,
        position: s?.flow_position ?? null,
        frames: [],
      };
      byFlow.set(v.flow_id, g);
    }
    g.frames.push({
      id: v.frame_id,
      name: v.frame_name,
      image: v.image_url,
      position: s?.frame_position ?? frameOrderCounter++,
    });
  }

  // Inject empty grouping flows from this build's stored flow tree (see
  // getManifestForApp) so frameless containers keep their children nested.
  const treeMeta = (build?.flow_tree ?? []) as Array<{
    id: string;
    name: string;
    parentFlowId: string | null;
    position: number | null;
  }>;
  if (treeMeta.length > 0) {
    const metaById = new Map(treeMeta.map((m) => [m.id, m]));
    for (const g of Array.from(byFlow.values())) {
      let pid = g.parentFlowId;
      while (pid && !byFlow.has(pid)) {
        const m = metaById.get(pid);
        if (!m) break;
        byFlow.set(pid, {
          id: m.id,
          name: m.name,
          parentFlowId: m.parentFlowId,
          position: m.position,
          frames: [],
        });
        pid = m.parentFlowId;
      }
    }
  }

  const flows = Array.from(byFlow.values())
    .sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity))
    .map((g) => ({
      id: g.id,
      name: g.name,
      parentFlowId: g.parentFlowId ?? undefined,
      frames: g.frames
        .sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity))
        .map((f) => ({ id: f.id, name: f.name, image: f.image })),
    }));

  return {
    projectId: '',
    buildSha: build?.sha ?? '',
    capturedAt: build?.captured_at ?? new Date().toISOString(),
    platform: (build?.platform as 'ios' | 'android' | 'web') ?? 'ios',
    flows,
  };
}

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

export interface SearchAppHit {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  icon_url: string | null;
  accent_color: string | null;
}

export interface SearchFrameHit {
  id: string;
  flow_id: string;
  frame_id: string;
  flow_name: string;
  frame_name: string;
  latest_image_url: string | null;
  app_slug: string;
  app_name: string;
}

export interface SearchResults {
  apps: SearchAppHit[];
  frames: SearchFrameHit[];
}

// PostgREST `ilike` treats % and _ as wildcards and \ as escape. Quote them
// so a user typing "100%" doesn't accidentally match everything.
function escapeIlikePattern(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

export async function searchAppsAndFrames(
  q: string,
  limit = 6,
): Promise<SearchResults> {
  const trimmed = q.trim();
  if (!trimmed) return { apps: [], frames: [] };
  const supabase = await getSupabaseServerClient();
  const like = `%${escapeIlikePattern(trimmed)}%`;

  // Per-column ilike queries avoid PostgREST `.or()` parsing of commas /
  // parens in user input. RLS scopes both queries to what the user can see.
  const [appsName, appsTagline, framesFrame, framesFlow] = await Promise.all([
    supabase
      .from('apps')
      .select('id, slug, name, tagline, icon_url, accent_color')
      .is('archived_at', null)
      .ilike('name', like)
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('apps')
      .select('id, slug, name, tagline, icon_url, accent_color')
      .is('archived_at', null)
      .ilike('tagline', like)
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('frames')
      .select(
        'id, frame_id, flow_id, frame_name, flow_name, latest_image_url, created_at, app:apps!inner(slug, name, archived_at)',
      )
      .is('app.archived_at', null)
      .ilike('frame_name', like)
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('frames')
      .select(
        'id, frame_id, flow_id, frame_name, flow_name, latest_image_url, created_at, app:apps!inner(slug, name, archived_at)',
      )
      .is('app.archived_at', null)
      .ilike('flow_name', like)
      .order('created_at', { ascending: false })
      .limit(limit),
  ]);

  for (const r of [appsName, appsTagline, framesFrame, framesFlow]) {
    if (r.error) throw r.error;
  }

  const appsById = new Map<string, SearchAppHit>();
  for (const row of [...(appsName.data ?? []), ...(appsTagline.data ?? [])] as SearchAppHit[]) {
    if (!appsById.has(row.id)) appsById.set(row.id, row);
  }

  type RawFrame = {
    id: string;
    frame_id: string;
    flow_id: string;
    frame_name: string;
    flow_name: string;
    latest_image_url: string | null;
    app: { slug: string; name: string } | { slug: string; name: string }[];
  };
  const framesById = new Map<string, SearchFrameHit>();
  for (const row of [...(framesFrame.data ?? []), ...(framesFlow.data ?? [])] as RawFrame[]) {
    if (framesById.has(row.id)) continue;
    const app = Array.isArray(row.app) ? row.app[0] : row.app;
    if (!app) continue;
    framesById.set(row.id, {
      id: row.id,
      flow_id: row.flow_id,
      frame_id: row.frame_id,
      flow_name: row.flow_name,
      frame_name: row.frame_name,
      latest_image_url: row.latest_image_url,
      app_slug: app.slug,
      app_name: app.name,
    });
  }

  return {
    apps: Array.from(appsById.values()).slice(0, limit),
    frames: Array.from(framesById.values()).slice(0, limit),
  };
}

/**
 * Team-wide Definition of Ready history, newest first. RLS limits this to
 * agency members (the policy blocks customers entirely), so every agency
 * user sees the full list. Pass `project` to filter by exact project name —
 * mirrors the GET /api/dor `?project=` contract.
 */
export async function listDorAssessments(options?: {
  project?: string;
  limit?: number;
}): Promise<DorAssessment[]> {
  const supabase = await getSupabaseServerClient();
  let query = supabase
    .from('dor_assessments')
    .select('*')
    // Anonymous public-calculator submissions never appear in team history.
    .eq('is_public', false)
    .order('created_at', { ascending: false })
    .limit(options?.limit ?? 100);
  if (options?.project) query = query.eq('project_name', options.project);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as DorAssessment[];
}
