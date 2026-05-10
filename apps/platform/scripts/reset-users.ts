/**
 * One-shot: wipe every auth.users row + create the founder account.
 *
 * Profiles cascade-delete through their FK on auth.users(id), so we don't
 * need to manually nuke the public.profiles table.
 *
 * Usage: pnpm tsx scripts/reset-users.ts
 */
import { createClient } from '@supabase/supabase-js';
import { loadEnv } from './load-env.js';

loadEnv();

const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL']!;
const SERVICE_ROLE = process.env['SUPABASE_SERVICE_ROLE_KEY']!;
const FOUNDER_EMAIL = 'hulusitunc1@gmail.com';
const FOUNDER_PASSWORD = 'hulusi2006';
const FOUNDER_NAME = 'Hulusi Tunc';

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main(): Promise<void> {
  // 1. Delete every existing auth user (cascades to profiles).
  console.log('Listing existing users…');
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listErr) throw listErr;
  const users = list?.users ?? [];
  console.log(`  found ${users.length} user(s)`);

  for (const u of users) {
    const { error } = await admin.auth.admin.deleteUser(u.id);
    if (error) {
      console.warn(`  ! failed to delete ${u.email ?? u.id}: ${error.message}`);
    } else {
      console.log(`  - deleted ${u.email ?? u.id}`);
    }
  }

  // Defensive: clear any pending_role_assignments rows so the trigger
  // doesn't try to apply stale role intent.
  await admin.from('pending_role_assignments').delete().neq('email', '');

  // 2. Create the founder account fresh.
  console.log(`Creating founder ${FOUNDER_EMAIL} …`);
  await admin
    .from('pending_role_assignments')
    .upsert({ email: FOUNDER_EMAIL, role: 'agency' }, { onConflict: 'email' });

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: FOUNDER_EMAIL,
    password: FOUNDER_PASSWORD,
    email_confirm: true,
    user_metadata: { name: FOUNDER_NAME },
  });
  if (createErr || !created.user) {
    throw createErr ?? new Error('createUser returned no user');
  }

  // 3. Backfill profile (the handle_new_user trigger created it; we just
  // make sure name + flavor look right).
  await admin
    .from('profiles')
    .update({ name: FOUNDER_NAME, role: 'agency', flavor: 'designer' })
    .eq('id', created.user.id);

  // Clean up the pending row.
  await admin.from('pending_role_assignments').delete().eq('email', FOUNDER_EMAIL);

  console.log('✓ Done.');
  console.log(`   Email:    ${FOUNDER_EMAIL}`);
  console.log(`   Password: ${FOUNDER_PASSWORD}`);
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
