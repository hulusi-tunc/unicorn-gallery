import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/server';

interface Body {
  name?: string;
  email?: string;
  role?: 'agency' | 'customer';
  flavor?: 'designer' | 'non-designer';
  code?: string;
}

const AGENCY_INVITE_CODE = process.env['AGENCY_INVITE_CODE'] ?? 'unicorns-only';

export async function POST(request: NextRequest): Promise<Response> {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const name = body.name?.trim();
  const role = body.role ?? 'customer';
  const flavor = body.flavor === 'non-designer' ? 'non-designer' : 'designer';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Valid email is required.' }, { status: 400 });
  }
  if (!name || name.length < 2) {
    return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
  }
  if (role !== 'agency' && role !== 'customer') {
    return NextResponse.json({ error: 'Invalid role.' }, { status: 400 });
  }
  if (role === 'agency' && body.code !== AGENCY_INVITE_CODE) {
    return NextResponse.json({ error: 'Invalid agency invite code.' }, { status: 401 });
  }
  if (role === 'customer') {
    return NextResponse.json(
      { error: 'Customers must be invited by their PM, not self-signup.' },
      { status: 403 },
    );
  }

  const admin = getSupabaseAdminClient();

  // Pre-stamp the role so the trigger picks it up on profile creation.
  const { error: pendErr } = await admin
    .from('pending_role_assignments')
    .upsert({ email, role }, { onConflict: 'email' });
  if (pendErr) {
    return NextResponse.json({ error: pendErr.message }, { status: 500 });
  }

  // Check if auth user already exists
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = list?.users.find((u) => u.email === email);

  if (!existing) {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { name },
    });
    if (createErr) {
      return NextResponse.json({ error: createErr.message }, { status: 500 });
    }
    // Trigger created the profile; backfill name + flavor.
    if (created.user) {
      await admin
        .from('profiles')
        .update({ name, flavor })
        .eq('id', created.user.id);
    }
  } else {
    // User exists — make sure profile.role/name/flavor are set.
    await admin.from('profiles').update({ role, name, flavor }).eq('id', existing.id);
    await admin.from('pending_role_assignments').delete().eq('email', email);
  }

  // Build a dev sign-in URL the form can redirect to (skips email verification).
  const signInUrl = `/api/dev/sign-in?email=${encodeURIComponent(email)}`;

  return NextResponse.json({ ok: true, signInUrl });
}
