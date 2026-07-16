import 'server-only';
import { getSupabaseAdminClient } from './supabase/server';

/**
 * The single studio owner ("super-admin"). This account sees and manages
 * EVERY project in Capture, bypassing project_members assignment. Everyone
 * else (agency "members") is scoped to the projects assigned to them.
 *
 * Kept as the canonical source of truth and imported by lib/actions/admin.ts
 * so "who is the founder/owner" is defined in exactly one place.
 */
export const STUDIO_OWNER_EMAIL = 'hulusitunc1@gmail.com';

export interface BearerUser {
  id: string;
  email: string;
  role: 'agency' | 'customer';
  /** True iff this is the studio owner (sees all projects in Capture). */
  isOwner: boolean;
}

export interface BearerAuthError {
  status: number;
  message: string;
}

export function isBearerAuthError(
  v: BearerUser | BearerAuthError,
): v is BearerAuthError {
  return (v as BearerAuthError).status !== undefined;
}

/** Pull the raw bearer token from an Authorization header, or null. */
export function extractBearer(request: Request): string | null {
  const auth = request.headers.get('authorization') ?? '';
  if (auth.startsWith('Bearer ')) {
    const t = auth.slice(7).trim();
    return t.length > 0 ? t : null;
  }
  return null;
}

/**
 * A Supabase access token is a JWT: three base64url segments joined by dots.
 * The legacy project/setup tokens (`pgt_…`, the opaque SETUP_TOKEN) never
 * contain dots, so this cleanly distinguishes a user session from a project
 * token on the shared intake/projects bearer surface.
 */
export function looksLikeJwt(token: string): boolean {
  return token.split('.').length === 3;
}

/**
 * Verify a Supabase user access token and resolve the caller's profile +
 * owner status. Uses the service-role client only to call the Auth admin
 * `getUser(jwt)` verification endpoint and to read the profile row — the
 * token itself is what authenticates the user.
 */
export async function getUserFromBearer(
  token: string,
): Promise<BearerUser | BearerAuthError> {
  if (!token || !token.trim()) {
    return { status: 401, message: 'Missing session token.' };
  }
  const admin = getSupabaseAdminClient();

  const { data, error } = await admin.auth.getUser(token.trim());
  if (error || !data?.user) {
    return { status: 401, message: 'Invalid or expired session. Please sign in again.' };
  }
  const user = data.user;

  const { data: profile, error: profErr } = await admin
    .from('profiles')
    .select('id, email, role')
    .eq('id', user.id)
    .maybeSingle();
  if (profErr) return { status: 500, message: profErr.message };
  if (!profile) {
    return { status: 403, message: 'No profile is linked to this account.' };
  }

  const email = (profile.email ?? user.email ?? '').toLowerCase();
  return {
    id: profile.id,
    email,
    role: profile.role as 'agency' | 'customer',
    isOwner: email === STUDIO_OWNER_EMAIL.toLowerCase(),
  };
}
