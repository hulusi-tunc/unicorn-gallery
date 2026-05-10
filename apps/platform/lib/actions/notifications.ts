'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentProfile } from '@/lib/queries';
import { getSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Stamp `frame_reads.last_read_at = now()` for the current user. Called when a
 * user opens a frame detail page — clears the unread badge for that frame.
 *
 * Also marks any `comment` / `reply` notifications for this frame as seen,
 * so the bell badge drops in sync.
 */
export async function markFrameRead(input: {
  frameRowId: string;
  appSlug: string;
}): Promise<{ ok?: true; error?: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: 'Not signed in.' };

  const supabase = await getSupabaseServerClient();

  const now = new Date().toISOString();
  const { error: rerr } = await supabase
    .from('frame_reads')
    .upsert(
      { user_id: profile.id, frame_id: input.frameRowId, last_read_at: now },
      { onConflict: 'user_id,frame_id' },
    );
  if (rerr) return { error: rerr.message };

  // Best-effort: mark seen for this frame (don't block on it).
  await supabase
    .from('notifications')
    .update({ seen_at: now })
    .eq('user_id', profile.id)
    .eq('frame_id', input.frameRowId)
    .is('seen_at', null);

  revalidatePath(`/app/${input.appSlug}`);
  revalidatePath('/notifications');
  return { ok: true };
}

/** Mark all of the current user's unseen notifications as seen. */
export async function markAllNotificationsSeen(): Promise<{ ok?: true; error?: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: 'Not signed in.' };

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase
    .from('notifications')
    .update({ seen_at: new Date().toISOString() })
    .eq('user_id', profile.id)
    .is('seen_at', null);
  if (error) return { error: error.message };

  revalidatePath('/notifications');
  revalidatePath('/');
  return { ok: true };
}

/** Mark a single notification as seen — used when the user clicks through to its frame. */
export async function markNotificationSeen(input: {
  notificationId: string;
}): Promise<{ ok?: true; error?: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: 'Not signed in.' };

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase
    .from('notifications')
    .update({ seen_at: new Date().toISOString() })
    .eq('id', input.notificationId)
    .eq('user_id', profile.id);
  if (error) return { error: error.message };
  return { ok: true };
}
