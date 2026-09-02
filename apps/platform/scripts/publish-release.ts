/**
 * Publish a Capture build so it shows up on /downloads.
 *
 * The gallery has no upload form — releases are published from here, next to
 * the build that produced them.
 *
 *   pnpm release:publish -- \
 *     --kind macos-desktop \
 *     --version 0.1.4 \
 *     --file ../capture/artifacts/stable-macos-arm64-UnicornStudio.dmg \
 *     --notes "Fixes partial pushes"
 *
 * Flags: --kind macos-desktop|chrome-extension (required)
 *        --version <string>                    (required)
 *        --file <path>                         (required)
 *        --channel stable|canary               (default: stable)
 *        --notes <string>                      (optional)
 */
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createReadStream } from 'node:fs';
import { basename } from 'node:path';
import { stat } from 'node:fs/promises';
import pg from 'pg';
import { loadEnv } from './load-env.js';

loadEnv();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const kind = arg('kind');
const version = arg('version');
const file = arg('file');
const channel = arg('channel') ?? 'stable';
const notes = arg('notes');

if (kind !== 'macos-desktop' && kind !== 'chrome-extension') {
  console.error('--kind must be macos-desktop or chrome-extension');
  process.exit(1);
}
if (channel !== 'stable' && channel !== 'canary') {
  console.error('--channel must be stable or canary');
  process.exit(1);
}
if (!version || !file) {
  console.error('--version and --file are required');
  process.exit(1);
}

const info = await stat(file).catch(() => null);
if (!info?.isFile()) {
  console.error(`Not a file: ${file}`);
  process.exit(1);
}

const sanitize = (s: string): string =>
  s.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^\.+/, '').slice(0, 120);

const fileName = sanitize(basename(file));
const contentType = fileName.toLowerCase().endsWith('.dmg')
  ? 'application/x-apple-diskimage'
  : fileName.toLowerCase().endsWith('.zip')
    ? 'application/zip'
    : 'application/octet-stream';

const bucket = 'gallery-screenshots';
const publicPrefix =
  process.env['R2_PUBLIC_URL'] ??
  'https://pub-c3fbfb7655eb4a7589d726cc0dfae691.r2.dev';
// Timestamped so republishing a version never collides and older builds stay
// reachable from the history.
const key = `releases/${kind}/${Date.now()}-${sanitize(version)}-${fileName}`;

const r2 = new S3Client({
  region: 'auto',
  endpoint:
    process.env['R2_ENDPOINT'] ??
    'https://a02d2e29c7eacabfcec306efbf5db8c9.r2.cloudflarestorage.com',
  credentials: {
    accessKeyId: process.env['R2_ACCESS_KEY_ID'] ?? '',
    secretAccessKey: process.env['R2_SECRET_ACCESS_KEY'] ?? '',
  },
});

const mb = (info.size / (1024 * 1024)).toFixed(1);
console.log(`→ uploading ${fileName} (${mb} MB) to ${key}`);
await r2.send(
  new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: createReadStream(file),
    ContentLength: info.size,
    ContentType: contentType,
  }),
);

const fileUrl = `${publicPrefix}/${key}`;

const rawUrl = process.env['POSTGRES_URL_NON_POOLING'] ?? process.env['POSTGRES_URL'];
if (!rawUrl) {
  console.error('POSTGRES_URL_NON_POOLING (or POSTGRES_URL) is required.');
  process.exit(1);
}
// Same sslmode workaround as scripts/migrate.ts — pg mishandles Supabase's chain.
const stripped = rawUrl.replace(/[?&]sslmode=require\b/, '').replace(/([?&])$/, '');
const pgUrl = `${stripped}${stripped.includes('?') ? '&' : '?'}sslmode=no-verify`;

const pool = new pg.Pool({ connectionString: pgUrl, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();
try {
  await client.query(
    `insert into public.app_releases
       (kind, channel, version, file_url, file_name, size_bytes, notes)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [kind, channel, version, fileUrl, fileName, info.size, notes ?? null],
  );
  console.log(`✓ published ${kind} ${version} (${channel})`);
  console.log(`  ${fileUrl}`);
  console.log('  Visible now at /downloads');
} catch (err) {
  console.error('Publish failed:', err);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
