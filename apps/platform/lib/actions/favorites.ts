'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentProfile } from '@/lib/queries';
import { getSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Pin / unpin an app to the top of the current user's dashboard. Per-user —
 * writes (or deletes) a row in app_favorites, which RLS limits to your own
 * rows. `pinned` is the DESIRED next state, so the client can send it straight
 * from an optimistic toggle.
 */
export async function setAppPinned(input: {
  appId: string;
  pinned: boolean;
}): Promise<{ ok?: true; error?: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: 'Not signed in.' };

  const supabase = await getSupabaseServerClient();
  if (input.pinned) {
    const { error } = await supabase
      .from('app_favorites')
      .upsert(
        { user_id: profile.id, app_id: input.appId },
        { onConflict: 'user_id,app_id' },
      );
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from('app_favorites')
      .delete()
      .eq('user_id', profile.id)
      .eq('app_id', input.appId);
    if (error) return { error: error.message };
  }

  // The dashboard lives at both '/' and '/apps'; refresh both so the grid
  // re-sorts (pinned float to the top) on the next render.
  revalidatePath('/');
  revalidatePath('/apps');
  return { ok: true };
}
