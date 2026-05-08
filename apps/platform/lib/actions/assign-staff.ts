'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentProfile } from '@/lib/queries';
import { getSupabaseServerClient } from '@/lib/supabase/server';

interface AssignInput {
  appId: string;
  appSlug: string;
  field: 'designer_id' | 'pm_id';
  /** Profile id to assign, or null/empty string to clear. */
  profileId: string | null;
}

export async function assignStaff(input: AssignInput): Promise<{ ok?: true; error?: string }> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== 'agency' || !profile.is_admin) {
    return { error: 'Only admins can assign Designer / PM.' };
  }

  if (input.field !== 'designer_id' && input.field !== 'pm_id') {
    return { error: 'Invalid field.' };
  }

  const supabase = await getSupabaseServerClient();
  const value = input.profileId && input.profileId.length > 0 ? input.profileId : null;
  const { error } = await supabase
    .from('apps')
    .update({ [input.field]: value })
    .eq('id', input.appId);
  if (error) return { error: error.message };

  revalidatePath('/');
  revalidatePath(`/app/${input.appSlug}`);
  return { ok: true };
}
