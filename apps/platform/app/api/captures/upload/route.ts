import busboy from 'busboy';
import { NextResponse, type NextRequest } from 'next/server';
import { findAppByToken, ingestCapture } from '@/lib/intake';
import type { ManifestSnapshot } from '@/lib/db';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface ParsedBody {
  manifestText: string;
  screenshots: Map<string, ArrayBuffer>;
}

/**
 * Stream the multipart body via busboy. We bypass `request.formData()`
 * because Next.js's built-in parser silently caps the body somewhere around
 * 10MB in dev mode — fine for tiny captures, broken for real RN sessions
 * (10+ frames × 600KB each easily blows past it). Streaming straight off
 * `request.body` has no such limit.
 */
async function parseMultipart(request: NextRequest): Promise<ParsedBody> {
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  const bb = busboy({
    headers,
    limits: { fileSize: 100 * 1024 * 1024 },
  });

  let manifestText = '';
  const screenshots = new Map<string, ArrayBuffer>();

  const done = new Promise<void>((resolve, reject) => {
    bb.on('file', (name, fileStream) => {
      const chunks: Buffer[] = [];
      fileStream.on('data', (chunk: Buffer) => chunks.push(chunk));
      fileStream.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (name === 'manifest') {
          manifestText = buf.toString('utf-8');
        } else {
          // copy into a fresh ArrayBuffer detached from Node's buffer pool
          const ab = new ArrayBuffer(buf.length);
          new Uint8Array(ab).set(buf);
          screenshots.set(name, ab);
        }
      });
      fileStream.on('error', reject);
    });
    bb.on('field', (name, value) => {
      if (name === 'manifest') manifestText = value;
    });
    bb.on('error', reject);
    bb.on('close', resolve);
  });

  if (!request.body) {
    throw new Error('Request body is empty.');
  }
  const reader = request.body.getReader();
  while (true) {
    const { done: end, value } = await reader.read();
    if (end) break;
    if (value) bb.write(Buffer.from(value));
  }
  bb.end();
  await done;

  return { manifestText, screenshots };
}

export async function POST(request: NextRequest): Promise<Response> {
  // Auth: Bearer <project-token> header.
  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : authHeader.trim();

  const app = await findAppByToken(token);
  if ('status' in app) {
    return NextResponse.json({ error: app.message }, { status: app.status });
  }

  let parsed: ParsedBody;
  try {
    parsed = await parseMultipart(request);
  } catch (err) {
    return NextResponse.json(
      { error: `Could not parse multipart body: ${(err as Error).message}` },
      { status: 400 },
    );
  }

  if (!parsed.manifestText) {
    return NextResponse.json({ error: 'Missing "manifest" field.' }, { status: 400 });
  }

  let manifest: ManifestSnapshot;
  try {
    manifest = JSON.parse(parsed.manifestText) as ManifestSnapshot;
  } catch (err) {
    return NextResponse.json(
      { error: `manifest is not valid JSON: ${(err as Error).message}` },
      { status: 400 },
    );
  }

  if (!manifest.buildSha || !Array.isArray(manifest.flows)) {
    return NextResponse.json(
      { error: 'manifest is missing required fields (buildSha, flows).' },
      { status: 400 },
    );
  }
  if (manifest.platform !== app.platform) {
    return NextResponse.json(
      {
        error: `Platform mismatch: app is ${app.platform}, manifest is ${manifest.platform}.`,
      },
      { status: 400 },
    );
  }

  const result = await ingestCapture({
    appId: app.id,
    appSlug: app.slug,
    manifest,
    screenshots: parsed.screenshots,
  });

  if ('status' in result && 'message' in result) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    app: { id: result.appId, slug: result.appSlug },
    build: { id: result.buildId, sha: result.buildSha },
    framesCount: result.framesCount,
  });
}
