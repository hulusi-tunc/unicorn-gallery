import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NextResponse, type NextRequest } from 'next/server';
import { findAppByToken } from '@/lib/intake';
import { R2_BUCKET, R2_PUBLIC_PREFIX, r2 } from '@/lib/r2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const sanitize = (s: string): string =>
  s.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^\.+/, '');

/**
 * Issue a presigned direct-to-R2 upload URL for a frame's motion clip.
 *
 * Clips easily exceed request-body limits (Next dev caps ~10MB, hosted
 * Vercel ~4.5MB), so Capture uploads them straight to R2 and the push
 * manifest carries only the resulting public URL - the intake accepts it
 * via the same storage-URL passthrough used for synced frames.
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

  // Best-effort delete any existing object at this path so re-pushes
  // overwrite cleanly.
  await r2
    .send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: path }))
    .catch(() => {});

  try {
    const signedUrl = await getSignedUrl(
      r2,
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: path,
        ContentType: ext === 'webm' ? 'video/webm' : 'video/mp4',
      }),
      { expiresIn: 3600 },
    );
    const publicUrl = `${R2_PUBLIC_PREFIX}/${path}`;
    return NextResponse.json({
      ok: true,
      signedUrl,
      token: null, // R2 presigned URLs are self-contained
      path,
      publicUrl,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Signed upload URL failed: ${(e as Error).message}` },
      { status: 500 },
    );
  }
}
