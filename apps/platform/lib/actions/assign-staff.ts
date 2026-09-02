'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentProfile } from '@/lib/queries';
import { getSupabaseAdminClient, getSupabaseServerClient } from '@/lib/supabase/server';

interface AssignInput {
  appId: string;
  appSlug: string;
  field: 'designer_id' | 'pm_id';
  /** Profile id to assign, or null/empty string to clear. */
  profileId: string | null;
}

export async function assignStaff(input: AssignInput): Promise<{ ok?: true; error?: string }> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== 'agency') {
    return { error: 'Only agency members can assign Designer / PM.' };
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

  // Being named Designer / PM is what people expect to grant access to the
  // project in Capture — but Capture reads `project_members` (see
  // /api/projects/mine), not `designer_id` / `pm_id`. Without this upsert the
  // assignment is invisible to the desktop app and the person "doesn't see the
  // project", which is exactly how it behaved before.
  //
  // Non-fatal: the staff field is already saved, so a failure here degrades to
  // the old behaviour rather than losing the assignment.
  if (value) {
    const admin = getSupabaseAdminClient();
    const { data: assignee } = await admin
      .from('profiles')
      .select('role')
      .eq('id', value)
      .maybeSingle();
    // Customers have no Capture surface and are blocked by RLS from writing
    // captures, so only agency-tier assignees become project members.
    if (assignee?.role === 'agency') {
      const { error: memberErr } = await admin
        .from('project_members')
        .upsert(
          { app_id: input.appId, user_id: value, assigned_by: profile.id },
          { onConflict: 'app_id,user_id', ignoreDuplicates: true },
        );
      if (memberErr) {
        return {
          error: `Saved, but granting Capture access failed: ${memberErr.message}`,
        };
      }
    }
  }

  revalidatePath('/');
  revalidatePath(`/app/${input.appSlug}`);
  return { ok: true };
}
