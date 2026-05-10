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
}
