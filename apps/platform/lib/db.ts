// Database row types — the shape of our public.* tables.
// Supabase client returns these via `.from('table').select<...>()`.

export type Role = 'agency' | 'customer';
export type Platform = 'web' | 'ios' | 'android';

export interface Profile {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  flavor: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface AppRow {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  icon_url: string | null;
  preview_image_url: string | null;
  accent_color: string | null;
  platform: Platform;
  created_by: string | null;
  created_at: string;
  designer_id: string | null;
  pm_id: string | null;
  public_share_token: string | null;
  /**
   * Archive lifecycle. NULL = active (default). Non-null = soft-deleted at
   * this timestamp; restorable until +90 days, after which the daily cron
   * hard-deletes everything (rows + storage). See lib/actions/archive.ts.
   */
  archived_at: string | null;
  archive_reason: string | null;
  archived_by: string | null;
}

/** Hard-delete grace period — 90 days. Tweak if business policy changes. */
export const ARCHIVE_GRACE_DAYS = 90;

/** Compute when an archived app will be permanently deleted. */
export function archiveDeleteAt(archivedAt: string): Date {
  const t = new Date(archivedAt);
  t.setUTCDate(t.getUTCDate() + ARCHIVE_GRACE_DAYS);
  return t;
}

/** Days remaining before an archived app is hard-deleted (negative if overdue). */
export function archiveDaysRemaining(archivedAt: string): number {
  const ms = archiveDeleteAt(archivedAt).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

/** Lightweight profile used in lookups (avatar / chip rendering). */
export interface ProfileLite {
  id: string;
  email: string;
  name: string | null;
  flavor: string | null;
  avatar_url: string | null;
}

/** AppRow with optional designer + PM profiles joined in. */
export interface AppRowWithStaff extends AppRow {
  designer: ProfileLite | null;
  pm: ProfileLite | null;
}

export interface AppCustomer {
  app_id: string;
  user_id: string;
  invited_by: string | null;
  added_at: string;
}

export interface Invite {
  id: string;
  app_id: string;
  email: string;
  invited_by: string | null;
  token: string;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
}

export interface Build {
  id: string;
  app_id: string;
  sha: string;
  captured_at: string;
  platform: Platform;
  manifest: ManifestSnapshot;
  is_visible: boolean;
  created_at: string;
  /** Per-app monotonic version number (v1, v2, ...). Null on legacy rows. */
  version: number | null;
  /** Optional human note shown in version history. */
  message: string | null;
  /**
   * Full flow hierarchy incl. empty grouping flows (containers with no frames
   * of their own). Lets the gallery keep sub-flows nested under containers the
   * frame-derived tree can't represent. Null on legacy / pre-migration rows.
   */
  flow_tree?: Array<{
    id: string;
    name: string;
    parentFlowId: string | null;
    position: number | null;
  }> | null;
}

export interface Frame {
  id: string;
  app_id: string;
  flow_id: string;
  frame_id: string;
  flow_name: string;
  frame_name: string;
  /** Set for sub-flows; null/undefined for top-level flows. */
  parent_flow_id: string | null;
  /** Capture-assigned index of the flow among its siblings (smaller = earlier). */
  flow_position: number | null;
  /** Capture-assigned index of the frame within its flow. */
  frame_position: number | null;
  latest_image_url: string | null;
  latest_build_id: string | null;
  created_at: string;
}

export interface Comment {
  id: string;
  frame_id: string;
  parent_id: string | null;
  author_id: string;
  body: string;
  pin_x: number | null;
  pin_y: number | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
}

export type NotificationKind = 'comment' | 'mention' | 'reply';

export interface Notification {
  id: string;
  user_id: string;
  kind: NotificationKind;
  comment_id: string;
  frame_id: string;
  app_id: string;
  actor_id: string | null;
  seen_at: string | null;
  created_at: string;
}

export interface FrameRead {
  user_id: string;
  frame_id: string;
  last_read_at: string;
}

/** A Definition of Ready self-check. `scores` holds raw 0/0.5/1 ticks keyed by
 *  criterion id (see lib/dor/criteria.ts); `score`/`verdict` are server-derived. */
export interface DorAssessment {
  id: string;
  /** Optional link to a gallery project. Null for free-text / not-yet-onboarded. */
  app_id: string | null;
  project_name: string;
  /** Who ran the check. Null if that profile was later removed. */
  designer_id: string | null;
  designer_name: string;
  track: 'ai' | 'figma';
  /** Raw answers keyed by criterion id (leaf 0/0.5/1) or "criterionId.subCheckId" ('met'|'na'). */
  scores: Record<string, number | string>;
  /** Normalized 0–10, recomputed server-side on every write. */
  score: number;
  verdict: 'cleared' | 'almost' | 'not_ready';
  /** Estimated hours of work. Null until the score clears the ETA unlock threshold. */
  eta_hours: number | null;
  eta_date: string | null;
  /** Designer's free-text final thoughts on the handoff. */
  notes: string | null;
  /** Optional per-section notes, keyed by criterion id. */
  section_notes: Record<string, string>;
  /** Unguessable token for the public read-only share page. */
  share_token: string | null;
  /** true = anonymous submission from the public calculator (excluded from team history). */
  is_public: boolean;
  created_at: string;
}

export interface ManifestSnapshot {
  projectId: string;
  buildSha: string;
  capturedAt: string;
  platform: Platform;
  /** Optional human note ("Added booking flow") shown on the version page. */
  message?: string;
  flows: ManifestFlowSnapshot[];
}

export interface ManifestFlowSnapshot {
  id: string;
  name: string;
  /** When set, this flow renders as a sub-flow of `parentFlowId`. */
  parentFlowId?: string;
  /** The route that auto-spawns into this flow (capture-side). */
  autoRoute?: string;
  /** Index among sibling flows (smaller = earlier). */
  position?: number;
  frames: ManifestFrameSnapshot[];
}

export interface ManifestFrameSnapshot {
  id: string;
  name: string;
  /** Index within the flow (smaller = earlier). */
  position?: number;
  image: string;
  /**
   * Past captures of this same frame slot, captured before the latest
   * one (newest first). Mirrors Capture's snap.versions[] array.
   * Empty/undefined for frames that have only ever been snapped once.
   */
  versions?: Array<{
    image: string;
    capturedAt: string;
  }>;
}
