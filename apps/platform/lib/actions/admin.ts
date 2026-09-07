'use server';

import { revalidatePath } from 'next/cache';
import type { Role } from '@/lib/db';
import { getCurrentProfile } from '@/lib/queries';
import { getSupabaseAdminClient } from '@/lib/supabase/server';
import { STUDIO_OWNER_EMAIL } from '@/lib/user-token';

const HARDCODED_FOUNDER = STUDIO_OWNER_EMAIL;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

interface Caller {
  id: string;
  email: string;
  /** True iff the caller is the studio owner. */
  isFounder: boolean;
}

async function requireAgency(): Promise<Caller | { error: string }> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== 'agency') {
    return { error: 'Agency members only.' };
  }
  const email = profile.email.toLowerCase();
  return {
    id: profile.id,
    email,
    isFounder: email === HARDCODED_FOUNDER.toLowerCase(),
  };
}

/** Reads the target's email + role, or an error if the profile is gone. */
async function loadTarget(
  profileId: string,
): Promise<{ email: string; role: Role; isFounder: boolean } | { error: string }> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('profiles')
    .select('email, role')
    .eq('id', profileId)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: 'Account not found.' };
  const email = (data.email ?? '').toLowerCase();
  return {
    email,
    role: data.role as Role,
    isFounder: email === HARDCODED_FOUNDER.toLowerCase(),
  };
}

/** Change a user's tier between agency and customer. */
export async function setRole(input: {
  profileId: string;
  role: Role;
}): Promise<{ ok?: true; error?: string }> {
  const me = await requireAgency();
  if ('error' in me) return me;

  const target = await loadTarget(input.profileId);
  if ('error' in target) return target;

  // Don't let anyone demote the founder.
  if (target.isFounder && input.role !== 'agency') {
    return { error: 'Cannot change the founder\'s role.' };
  }
  // ...or demote themselves out of the admin panel they're standing in.
  if (input.profileId === me.id && input.role !== 'agency') {
    return { error: 'You can\'t demote yourself — ask another Unicorn.' };
  }

  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from('profiles')
    .update(
      input.role === 'agency'
        ? { role: input.role }
        : // A customer carries no designer / non-designer label.
          { role: input.role, flavor: null },
    )
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

  const target = await loadTarget(profileId);
  if ('error' in target) return target;
  if (target.isFounder) return { error: 'Cannot remove the founder.' };

  const admin = getSupabaseAdminClient();
  const { error } = await admin.auth.admin.deleteUser(profileId);
  if (error) return { error: error.message };

  revalidatePath('/admin');
  revalidatePath('/');
  return { ok: true };
}

export interface CreateAccountInput {
  email: string;
  password: string;
  name?: string;
  role: Role;
  flavor?: 'designer' | 'non-designer';
}

/**
 * Create an account straight from the admin panel with an email + password
 * the admin picks. No invite email is sent — the credentials are handed to
 * the person directly (same model as `inviteCustomer`), so the address is
 * marked confirmed up front and they can sign in at /sign-in immediately.
 */
export async function createAccount(
  input: CreateAccountInput,
): Promise<{ ok?: true; error?: string; signInUrl?: string }> {
  const me = await requireAgency();
  if ('error' in me) return me;

  const email = input.email.trim().toLowerCase();
  const name = input.name?.trim() || null;
  const role: Role = input.role === 'agency' ? 'agency' : 'customer';
  // designer / non-designer describes how a Unicorn works. It means nothing
  // for a customer, so don't store one.
  const flavor =
    role === 'agency' ? (input.flavor === 'non-designer' ? 'non-designer' : 'designer') : null;

  if (!EMAIL_RE.test(email)) return { error: 'Valid email is required.' };
  if (input.password.length < MIN_PASSWORD) {
    return { error: `Password must be at least ${MIN_PASSWORD} characters.` };
  }

  const admin = getSupabaseAdminClient();

  // Refuse to clobber an existing account — editing it is a separate,
  // deliberate action rather than a side effect of "create".
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listErr) return { error: listErr.message };
  if (list?.users.some((u) => u.email?.toLowerCase() === email)) {
    return { error: 'An account with that email already exists. Edit it instead.' };
  }

  // Stamp the role so the handle_new_user trigger applies it on insert.
  const { error: pendErr } = await admin
    .from('pending_role_assignments')
    .upsert({ email, role }, { onConflict: 'email' });
  if (pendErr) return { error: pendErr.message };

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: name ? { name } : undefined,
  });
  if (createErr) {
    await admin.from('pending_role_assignments').delete().eq('email', email);
    return { error: createErr.message };
  }

  const userId = created.user!.id;

  // The trigger created the profile — backfill the fields it can't know.
  const { error: profErr } = await admin
    .from('profiles')
    .update({ role, name, flavor })
    .eq('id', userId);
  if (profErr) return { error: profErr.message };

  await admin.from('pending_role_assignments').delete().eq('email', email);

  revalidatePath('/admin');
  return {
    ok: true,
    signInUrl: `${getSiteUrl()}/sign-in?email=${encodeURIComponent(email)}`,
  };
}

export interface UpdateAccountInput {
  profileId: string;
  /** New login email. Omit to leave unchanged. */
  email?: string;
  /** New password. Omit (or pass empty) to leave unchanged. */
  password?: string;
  /** Display name. Pass '' to clear it. */
  name?: string;
  role?: Role;
  flavor?: 'designer' | 'non-designer';
}

/**
 * Edit an existing account: login email, password, display name, tier and
 * flavor, in one save. Email and password go to Supabase Auth (the source of
 * truth for sign-in); the rest lands on the profile row.
 *
 * The founder's credentials are only editable by the founder — otherwise any
 * agency user could rotate the owner's password and lock them out.
 */
export async function updateAccount(
  input: UpdateAccountInput,
): Promise<{ ok?: true; error?: string; emailChanged?: boolean; passwordChanged?: boolean }> {
  const me = await requireAgency();
  if ('error' in me) return me;

  const target = await loadTarget(input.profileId);
  if ('error' in target) return target;

  const admin = getSupabaseAdminClient();

  const wantsEmail =
    input.email !== undefined && input.email.trim().toLowerCase() !== target.email;
  const wantsPassword = Boolean(input.password && input.password.length > 0);

  if (target.isFounder && (wantsEmail || wantsPassword) && !me.isFounder) {
    return { error: 'Only the founder can change the founder\'s credentials.' };
  }
  if (input.role && input.role !== 'agency' && target.isFounder) {
    return { error: 'Cannot change the founder\'s role.' };
  }
  if (input.role && input.role !== 'agency' && input.profileId === me.id) {
    return { error: 'You can\'t demote yourself — ask another Unicorn.' };
  }

  // ── Credentials (Supabase Auth) ───────────────────────────────────────────
  let nextEmail: string | null = null;
  if (wantsEmail) {
    nextEmail = input.email!.trim().toLowerCase();
    if (!EMAIL_RE.test(nextEmail)) return { error: 'Valid email is required.' };

    const { data: clash, error: clashErr } = await admin
      .from('profiles')
      .select('id')
      .eq('email', nextEmail)
      .maybeSingle();
    if (clashErr) return { error: clashErr.message };
    if (clash && clash.id !== input.profileId) {
      return { error: 'That email is already used by another account.' };
    }
  }

  if (wantsPassword && input.password!.length < MIN_PASSWORD) {
    return { error: `Password must be at least ${MIN_PASSWORD} characters.` };
  }

  if (nextEmail || wantsPassword) {
    const { error: authErr } = await admin.auth.admin.updateUserById(input.profileId, {
      ...(nextEmail ? { email: nextEmail, email_confirm: true } : {}),
      ...(wantsPassword ? { password: input.password } : {}),
    });
    if (authErr) return { error: authErr.message };
  }

  // ── Profile row ───────────────────────────────────────────────────────────
  const patch: Record<string, unknown> = {};
  if (nextEmail) patch['email'] = nextEmail;
  if (input.name !== undefined) patch['name'] = input.name.trim() || null;
  if (input.role) patch['role'] = input.role;
  const effectiveRole = input.role ?? target.role;
  if (effectiveRole !== 'agency') {
    // Demoting to customer drops the label too, so it can't resurface later.
    patch['flavor'] = null;
  } else if (input.flavor) {
    patch['flavor'] = input.flavor;
  }

  if (Object.keys(patch).length > 0) {
    const { error: profErr } = await admin
      .from('profiles')
      .update(patch)
      .eq('id', input.profileId);
    if (profErr) {
      // Auth already moved; surface it so the admin can retry rather than
      // leaving them wondering why the table still shows the old address.
      return {
        error: nextEmail
          ? `Sign-in email updated, but the profile row failed: ${profErr.message}`
          : profErr.message,
      };
    }
  }

  revalidatePath('/admin');
  revalidatePath('/profile');
  return {
    ok: true,
    emailChanged: Boolean(nextEmail),
    passwordChanged: wantsPassword,
  };
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
  if (!EMAIL_RE.test(email)) {
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

function getSiteUrl(): string {
  const fromEnv =
    process.env['NEXT_PUBLIC_SITE_URL'] ??
    process.env['VERCEL_PROJECT_PRODUCTION_URL'] ??
    process.env['VERCEL_URL'];
  if (fromEnv) {
    const url = fromEnv.startsWith('http') ? fromEnv : `https://${fromEnv}`;
    return url.replace(/\/$/, '');
  }
  return 'http://localhost:3010';
}
