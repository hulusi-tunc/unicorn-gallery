import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentProfile } from '@/lib/queries';
import { R2_BUCKET, R2_PUBLIC_PREFIX, r2 } from '@/lib/r2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const sanitize = (s: string): string =>
  s.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^\.+/, '').slice(0, 120);

/** Max artifact size we'll hand out a signed URL for. A signed DMG is ~150MB. */
const MAX_RELEASE_BYTES = 500 * 1024 * 1024;

/**
 * Issue a presigned direct-to-R2 PUT so an agency member can publish a new
 * Capture build from the browser.
 *
 * The bytes never touch the Next server: a DMG is two orders of magnitude past
 * Vercel's ~4.5MB request body cap, so the browser PUTs straight to R2 and then
 * calls `publishRelease` with the resulting public URL. Same shape as the
 * motion-clip upload path.
 *
 * The server builds the object key itself, so a caller can't write outside the
 * releases prefix.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== 'agency') {
    return NextResponse.json(
      { error: 'Only studio members can publish releases.' },
      { status: 403 },
    );
  }

  let body: { kind?: string; version?: string; fileName?: string; sizeBytes?: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const kind = body.kind === 'macos-desktop' || body.kind === 'chrome-extension' ? body.kind : null;
  if (!kind) {
    return NextResponse.json(
      { error: 'kind must be macos-desktop or chrome-extension.' },
      { status: 400 },
    );
  }
  if (!body.version || !body.fileName) {
    return NextResponse.json(
      { error: 'version and fileName are required.' },
      { status: 400 },
    );
  }
  if (typeof body.sizeBytes === 'number' && body.sizeBytes > MAX_RELEASE_BYTES) {
    return NextResponse.json(
      { error: 'That file is larger than the 500MB release limit.' },
      { status: 413 },
    );
  }

  const fileName = sanitize(body.fileName);
  const contentType = fileName.toLowerCase().endsWith('.dmg')
    ? 'application/x-apple-diskimage'
    : fileName.toLowerCase().endsWith('.zip')
      ? 'application/zip'
      : 'application/octet-stream';

  // Timestamp in the key so publishing the same version twice never collides
  // and old builds stay downloadable from the history list.
  const key = `releases/${kind}/${Date.now()}-${sanitize(body.version)}-${fileName}`;

  try {
    const signedUrl = await getSignedUrl(
      r2,
      new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, ContentType: contentType }),
      { expiresIn: 3600 },
    );
    return NextResponse.json({
      ok: true,
      signedUrl,
      contentType,
      publicUrl: `${R2_PUBLIC_PREFIX}/${key}`,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Signed upload URL failed: ${(e as Error).message}` },
      { status: 500 },
    );
  }
}
