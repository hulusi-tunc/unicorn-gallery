'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentProfile } from '@/lib/queries';
import { getSupabaseAdminClient } from '@/lib/supabase/server';

const HARDCODED_ADMIN = 'hulusitunc1@gmail.com';

async function requireAdmin(): Promise<{ id: string } | { error: string }> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== 'agency' || !profile.is_admin) {
    return { error: 'Admin only.' };
  }
  return { id: profile.id };
}

/** Toggle admin status on another agency user. Cannot demote the founder. */
export async function setAdmin(input: {
  profileId: string;
  isAdmin: boolean;
}): Promise<{ ok?: true; error?: string }> {
  const me = await requireAdmin();
  if ('error' in me) return me;

  const admin = getSupabaseAdminClient();

  // Don't let anyone (even another admin) demote the hardcoded founder.
  const { data: target } = await admin
    .from('profiles')
    .select('email')
    .eq('id', input.profileId)
    .maybeSingle();
  if (target?.email === HARDCODED_ADMIN && !input.isAdmin) {
    return { error: 'Cannot demote the founder.' };
  }

  const { error } = await admin
    .from('profiles')
    .update({ is_admin: input.isAdmin })
    .eq('id', input.profileId);
  if (error) return { error: error.message };

  revalidatePath('/admin');
  return { ok: true };
}

/** Change a user's tier between agency and customer. */
export async function setRole(input: {
  profileId: string;
  role: 'agency' | 'customer';
}): Promise<{ ok?: true; error?: string }> {
  const me = await requireAdmin();
  if ('error' in me) return me;

  const admin = getSupabaseAdminClient();

  // Don't let anyone demote the founder.
  const { data: target } = await admin
    .from('profiles')
    .select('email')
    .eq('id', input.profileId)
    .maybeSingle();
  if (target?.email === HARDCODED_ADMIN && input.role !== 'agency') {
    return { error: 'Cannot change the founder\'s role.' };
  }

  // If we drop to customer, also strip admin.
  const patch =
    input.role === 'agency' ? { role: 'agency' } : { role: 'customer', is_admin: false };
  const { error } = await admin
    .from('profiles')
    .update(patch)
    .eq('id', input.profileId);
  if (error) return { error: error.message };

  revalidatePath('/admin');
  return { ok: true };
}

/** Hard-delete a user. Cascades to profile via FK on auth.users. */
export async function kickUser(profileId: string): Promise<{ ok?: true; error?: string }> {
  const me = await requireAdmin();
  if ('error' in me) return me;
  if (profileId === me.id) return { error: 'You can\'t kick yourself.' };

  const admin = getSupabaseAdminClient();

  // Block kicking the founder.
  const { data: target } = await admin
    .from('profiles')
    .select('email')
    .eq('id', profileId)
    .maybeSingle();
  if (target?.email === HARDCODED_ADMIN) {
    return { error: 'Cannot remove the founder.' };
  }

  const { error } = await admin.auth.admin.deleteUser(profileId);
  if (error) return { error: error.message };

  revalidatePath('/admin');
  revalidatePath('/');
  return { ok: true };
}

/** Add a teammate. Email-only. They'll sign in via magic link. */
export async function addTeammate(input: {
  email: string;
  name?: string;
  flavor?: 'designer' | 'non-designer';
  isAdmin?: boolean;
}): Promise<{ ok?: true; error?: string; signInUrl?: string }> {
  const me = await requireAdmin();
  if ('error' in me) return me;

  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Valid email is required.' };
  }

  const admin = getSupabaseAdminClient();

  // 1. Stamp pending role + flavor so the trigger picks it up.
  const { error: pendErr } = await admin
    .from('pending_role_assignments')
    .upsert({ email, role: 'agency' }, { onConflict: 'email' });
  if (pendErr) return { error: pendErr.message };

  // 2. Look up or create auth user.
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = list?.users.find((u) => u.email === email);

  let userId: string;
  if (existing) {
    userId = existing.id;
  } else {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { name: input.name },
    });
    if (createErr) return { error: createErr.message };
    userId = created.user!.id;
  }

  // 3. Update profile to set role/flavor/admin/name.
  await admin
    .from('profiles')
    .update({
      role: 'agency',
      name: input.name?.trim() || null,
      flavor: input.flavor === 'non-designer' ? 'non-designer' : 'designer',
      is_admin: !!input.isAdmin,
    })
    .eq('id', userId);

  // 4. Clear the pending row (no-op if it was already consumed by the trigger).
  await admin.from('pending_role_assignments').delete().eq('email', email);

  revalidatePath('/admin');
  return {
    ok: true,
    signInUrl: `/api/dev/sign-in?email=${encodeURIComponent(email)}`,
  };
}
