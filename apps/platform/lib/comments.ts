import 'server-only';
import { getSupabaseServerClient } from './supabase/server';
import type { Comment, Frame } from './db';

export async function findOrCreateFrame(
  appId: string,
  flowId: string,
  flowName: string,
  frameId: string,
  frameName: string,
  imageUrl: string,
  buildId: string | null,
): Promise<Frame> {
  const supabase = await getSupabaseServerClient();
  // Try to find existing
  const existing = await supabase
    .from('frames')
    .select('*')
    .eq('app_id', appId)
    .eq('flow_id', flowId)
    .eq('frame_id', frameId)
    .maybeSingle();
  if (existing.data) return existing.data as Frame;

  const insert = await supabase
    .from('frames')
    .insert({
      app_id: appId,
      flow_id: flowId,
      frame_id: frameId,
      flow_name: flowName,
      frame_name: frameName,
      latest_image_url: imageUrl,
      latest_build_id: buildId,
    })
    .select('*')
    .single();
  if (insert.error) throw insert.error;
  return insert.data as Frame;
}

export interface CommentWithAuthor extends Comment {
  author: {
    id: string;
    name: string | null;
    email: string;
    role: 'agency' | 'customer';
    avatar_url: string | null;
  };
}

export async function listCommentsForFrame(frameRowId: string): Promise<CommentWithAuthor[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from('comments')
    .select('*, author:profiles!comments_author_id_fkey(id, name, email, role, avatar_url)')
    .eq('frame_id', frameRowId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as CommentWithAuthor[];
}
