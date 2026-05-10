'use server';

import { revalidatePath } from 'next/cache';
import { nanoid } from 'nanoid';
import { getCurrentProfile } from '@/lib/queries';
import { getSupabaseAdminClient } from '@/lib/supabase/server';

async function requireAgency(): Promise<{ id: string } | { error: string }> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== 'agency') {
    return { error: 'Agency members only.' };
  }
  return { id: profile.id };
}

interface InviteCustomerInput {
  appId: string;
  appSlug: string;
  email: string;
  password: string;
  name?: string;
}

interface InviteCustomerResult {
  ok?: true;
  error?: string;
  /** Sign-in URL the agency user can copy and send. */
  signInUrl?: string;
  /** True when the auth user was just created (vs. already existed). */
  created?: boolean;
  /** True when an existing user's password was reset to the new value. */
  passwordUpdated?: boolean;
}

/**
 * Adds a customer to an app: creates the auth user with a PM-chosen password
 * (or resets an existing user's password to the new value), sets profile.role
 * to 'customer', inserts into app_customers, and returns the sign-in URL +
 * credentials the agency user can hand-deliver.
 *
 * Password-mode: there is NO email — the PM shares email + password directly
 * with the customer. The customer signs in at /sign-in with those creds.
 */
export async function inviteCustomer(
  input: InviteCustomerInput,
): Promise<InviteCustomerResult> {
  const me = await requireAgency();
  if ('error' in me) return me;

  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Valid email is required.' };
  }
  if (input.password.length < 8) {
    return { error: 'Password must be at least 8 characters.' };
  }

  const admin = getSupabaseAdminClient();

  // 1. Find or create the auth user.
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = list?.users.find((u) => u.email === email);

  let userId: string;
  let created = false;
  let passwordUpdated = false;

  if (existing) {
    userId = existing.id;
    // Reset password to whatever the PM just chose so the credentials are usable.
    const { error: pwErr } = await admin.auth.admin.updateUserById(existing.id, {
      password: input.password,
    });
    if (pwErr) return { error: pwErr.message };
    passwordUpdated = true;
  } else {
    await admin
      .from('pending_role_assignments')
      .upsert({ email, role: 'customer' }, { onConflict: 'email' });

    const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: input.password,
      email_confirm: true,
      user_metadata: { name: input.name },
    });
    if (createErr) return { error: createErr.message };
    userId = newUser.user!.id;
    created = true;
  }

  // 2. Ensure profile is set as customer (don't accidentally demote agency users).
  const { data: existingProfile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (!existingProfile) {
    await admin.from('profiles').insert({
      id: userId,
      email,
      name: input.name?.trim() || null,
      role: 'customer',
    });
  } else if (existingProfile.role !== 'agency' && existingProfile.role !== 'customer') {
    await admin
      .from('profiles')
      .update({ role: 'customer', name: input.name?.trim() || null })
      .eq('id', userId);
  }

  // 3. Insert app_customers row (idempotent — primary key prevents duplicates).
  const { error: linkErr } = await admin
    .from('app_customers')
    .upsert(
      { app_id: input.appId, user_id: userId, invited_by: me.id },
      { onConflict: 'app_id,user_id', ignoreDuplicates: true },
    );
  if (linkErr) return { error: linkErr.message };

  revalidatePath(`/app/${input.appSlug}`);
  const signInUrl = `${getSiteUrl()}/sign-in?email=${encodeURIComponent(email)}&next=${encodeURIComponent(`/app/${input.appSlug}`)}`;
  return {
    ok: true,
    created,
    passwordUpdated,
    signInUrl,
  };
}

export async function removeCustomer(input: {
  appId: string;
  appSlug: string;
  userId: string;
}): Promise<{ ok?: true; error?: string }> {
  const me = await requireAgency();
  if ('error' in me) return me;

  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from('app_customers')
    .delete()
    .eq('app_id', input.appId)
    .eq('user_id', input.userId);
  if (error) return { error: error.message };

  revalidatePath(`/app/${input.appSlug}`);
  return { ok: true };
}

/** Mint or rotate the public share token. Pass null to disable sharing. */
export async function setPublicShareToken(input: {
  appId: string;
  appSlug: string;
  /** When undefined, generates a fresh token. When null, clears the token. */
  action: 'enable' | 'rotate' | 'disable';
}): Promise<{ ok?: true; error?: string; token?: string | null }> {
  const me = await requireAgency();
  if ('error' in me) return me;

  const admin = getSupabaseAdminClient();
  const token = input.action === 'disable' ? null : nanoid(24);
  const { error } = await admin
    .from('apps')
    .update({ public_share_token: token })
    .eq('id', input.appId);
  if (error) return { error: error.message };

  revalidatePath(`/app/${input.appSlug}`);
  return { ok: true, token };
}

function getSiteUrl(): string {
  const fromEnv =
    process.env['NEXT_PUBLIC_SITE_URL'] ??
    process.env['VERCEL_PROJECT_PRODUCTION_URL'] ??
    process.env['VERCEL_URL'];
  if (fromEnv) {
    return fromEnv.startsWith('http') ? fromEnv : `https://${fromEnv}`;
  }
  return 'http://localhost:3010';
}
