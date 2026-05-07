// Database row types — the shape of our public.* tables.
// Supabase client returns these via `.from('table').select<...>()`.

export type Role = 'agency' | 'customer';
export type Platform = 'web' | 'ios' | 'android';

export interface Profile {
  id: string;
  email: string;
  name: string | null;
  role: Role;
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
}

export interface Frame {
  id: string;
  app_id: string;
  flow_id: string;
  frame_id: string;
  flow_name: string;
  frame_name: string;
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

export interface ManifestSnapshot {
  projectId: string;
  buildSha: string;
  capturedAt: string;
  platform: Platform;
  flows: ManifestFlowSnapshot[];
}

export interface ManifestFlowSnapshot {
  id: string;
  name: string;
  frames: ManifestFrameSnapshot[];
}

export interface ManifestFrameSnapshot {
  id: string;
  name: string;
  image: string;
}
