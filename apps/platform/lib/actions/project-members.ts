'use server';

import { nanoid } from 'nanoid';
import { revalidatePath } from 'next/cache';
import { getCurrentProfile } from '@/lib/queries';
import { getSupabaseAdminClient } from '@/lib/supabase/server';

async function requireAgency(): Promise<{ id: string } | { error: string }> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== 'agency') {
    return { error: 'Agency members only.' };
  }
  return { id: profile.id };
}

/**
 * Assign a studio member to a project. The member will then see this project
 * in their Capture desktop app and can push captures to it. Idempotent.
 *
 * Only agency-tier profiles can be assigned — customers have no Capture
 * surface and are blocked by RLS from writing captures.
 */
export async function assignProjectMember(input: {
  appId: string;
  appSlug: string;
  userId: string;
}): Promise<{ ok?: true; error?: string }> {
  const me = await requireAgency();
  if ('error' in me) return me;

  const admin = getSupabaseAdminClient();

  const { data: profile, error: profErr } = await admin
    .from('profiles')
    .select('role')
    .eq('id', input.userId)
    .maybeSingle();
  if (profErr) return { error: profErr.message };
  if (!profile) return { error: 'Member not found.' };
  if (profile.role !== 'agency') {
    return { error: 'Only studio members (agency) can be assigned to projects.' };
  }

  const { error } = await admin
    .from('project_members')
    .upsert(
      { app_id: input.appId, user_id: input.userId, assigned_by: me.id },
      { onConflict: 'app_id,user_id', ignoreDuplicates: true },
    );
  if (error) return { error: error.message };

  revalidatePath(`/app/${input.appSlug}`);
  return { ok: true };
}

/** Remove a member's assignment. They lose access to the project in Capture. */
export async function unassignProjectMember(input: {
  appId: string;
  appSlug: string;
  userId: string;
}): Promise<{ ok?: true; error?: string }> {
  const me = await requireAgency();
  if ('error' in me) return me;

  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from('project_members')
    .delete()
    .eq('app_id', input.appId)
    .eq('user_id', input.userId);
  if (error) return { error: error.message };

  // Rotate the project token so the removed member's locally-cached pgt_ can no
  // longer push / pull / archive this project. Remaining members and the owner
  // pick up the new token on their next Capture refresh (/api/projects/mine).
  const { error: rotateErr } = await admin
    .from('apps')
    .update({ project_token: `pgt_${nanoid(32)}` })
    .eq('id', input.appId);
  if (rotateErr) {
    return { error: `Unassigned, but token rotation failed: ${rotateErr.message}` };
  }

  revalidatePath(`/app/${input.appSlug}`);
  return { ok: true };
}
