'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentProfile } from '@/lib/queries';
import { getSupabaseAdminClient } from '@/lib/supabase/server';

const HARDCODED_FOUNDER = 'hulusitunc1@gmail.com';

async function requireAgency(): Promise<{ id: string } | { error: string }> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== 'agency') {
    return { error: 'Agency members only.' };
  }
  return { id: profile.id };
}

/** Change a user's tier between agency and customer. */
export async function setRole(input: {
  profileId: string;
  role: 'agency' | 'customer';
}): Promise<{ ok?: true; error?: string }> {
  const me = await requireAgency();
  if ('error' in me) return me;

  const admin = getSupabaseAdminClient();

  // Don't let anyone demote the founder.
  const { data: target } = await admin
    .from('profiles')
    .select('email')
    .eq('id', input.profileId)
    .maybeSingle();
  if (target?.email === HARDCODED_FOUNDER && input.role !== 'agency') {
    return { error: 'Cannot change the founder\'s role.' };
  }

  const { error } = await admin
    .from('profiles')
    .update({ role: input.role })
    .eq('id', input.profileId);
  if (error) return { error: error.message };

  revalidatePath('/admin');
  return { ok: true };
}

/** Hard-delete a user. Cascades to profile via FK on auth.users. */
export async function kickUser(profileId: string): Promise<{ ok?: true; error?: string }> {
  const me = await requireAgency();
  if ('error' in me) return me;
  if (profileId === me.id) return { error: 'You can\'t kick yourself.' };

  const admin = getSupabaseAdminClient();

  // Block kicking the founder.
  const { data: target } = await admin
    .from('profiles')
    .select('email')
    .eq('id', profileId)
    .maybeSingle();
  if (target?.email === HARDCODED_FOUNDER) {
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
}): Promise<{ ok?: true; error?: string; signInUrl?: string }> {
  const me = await requireAgency();
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

  // 2. Look up or invite auth user. inviteUserByEmail (not createUser!)
  // is what sends Supabase's built-in invite email — createUser with
  // email_confirm:true just marks the address verified and never emails
  // anyone, which is why "Add Unicorn" wasn't reaching teammates.
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = list?.users.find((u) => u.email === email);

  let userId: string;
  if (existing) {
    userId = existing.id;
  } else {
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ??
      'https://unicorn-studio-gallery.vercel.app';
    const { data: invited, error: inviteErr } =
      await admin.auth.admin.inviteUserByEmail(email, {
        data: input.name ? { name: input.name } : undefined,
        redirectTo: `${siteUrl}/login`,
      });
    if (inviteErr) return { error: inviteErr.message };
    userId = invited.user!.id;
  }

  // 3. Update profile to set role/flavor/name.
  await admin
    .from('profiles')
    .update({
      role: 'agency',
      name: input.name?.trim() || null,
      flavor: input.flavor === 'non-designer' ? 'non-designer' : 'designer',
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
