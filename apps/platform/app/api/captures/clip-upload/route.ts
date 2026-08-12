import { NextResponse, type NextRequest } from 'next/server';
import { findAppByToken } from '@/lib/intake';
import { getSupabaseAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SCREENSHOTS_BUCKET = 'screenshots';

const sanitize = (s: string): string =>
  s.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^\.+/, '');

/**
 * Issue a signed direct-to-storage upload URL for a frame's motion clip.
 *
 * Clips easily exceed request-body limits (Next dev caps ~10MB, hosted
 * Vercel ~4.5MB), so Capture uploads them straight to Supabase Storage and
 * the push manifest carries only the resulting public URL — the intake
 * accepts it via the same storage-URL passthrough used for synced frames.
 *
 * Auth: the same project-token bearer as the upload endpoint. The server
 * builds the storage path itself so a client can never write outside its
 * own app's prefix.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const auth = request.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : auth.trim();

  const app = await findAppByToken(token);
  if ('status' in app) {
    return NextResponse.json({ error: app.message }, { status: app.status });
  }

  let body: { buildSha?: string; flowId?: string; frameId?: string; ext?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  if (!body.buildSha || !body.flowId || !body.frameId) {
    return NextResponse.json(
      { error: 'buildSha, flowId and frameId are required.' },
      { status: 400 },
    );
  }
  const ext = body.ext === 'webm' ? 'webm' : 'mp4';
  const path = `${app.id}/${sanitize(body.buildSha)}/${sanitize(body.flowId)}/${sanitize(body.frameId)}-motion.${ext}`;

  const admin = getSupabaseAdminClient();
  // Signed upload URLs reject existing objects — drop any prior clip at
  // this path first so a re-push of the same build overwrites cleanly.
  await admin.storage.from(SCREENSHOTS_BUCKET).remove([path]);
  const { data, error } = await admin.storage
    .from(SCREENSHOTS_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) {
    return NextResponse.json(
      { error: `Signed upload URL failed: ${error?.message ?? 'no data'}` },
      { status: 500 },
    );
  }
  const { data: pub } = admin.storage.from(SCREENSHOTS_BUCKET).getPublicUrl(path);
  return NextResponse.json({
    ok: true,
    signedUrl: data.signedUrl,
    token: data.token,
    path: data.path,
    publicUrl: pub.publicUrl,
  });
}
