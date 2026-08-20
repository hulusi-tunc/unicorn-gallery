import 'server-only';

import {
  DeleteObjectsCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

export const R2_BUCKET = 'gallery-screenshots';

export const R2_PUBLIC_PREFIX =
  process.env['R2_PUBLIC_URL'] ??
  'https://pub-c3fbfb7655eb4a7589d726cc0dfae691.r2.dev';

export const r2 = new S3Client({
  region: 'auto',
  endpoint:
    process.env['R2_ENDPOINT'] ??
    'https://a02d2e29c7eacabfcec306efbf5db8c9.r2.cloudflarestorage.com',
  credentials: {
    accessKeyId: process.env['R2_ACCESS_KEY_ID'] ?? '',
    secretAccessKey: process.env['R2_SECRET_ACCESS_KEY'] ?? '',
  },
});

/** Upload a file to R2. */
export async function r2Put(
  key: string,
  body: ArrayBuffer | Buffer | Uint8Array,
  contentType: string,
): Promise<void> {
  await r2.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: body instanceof Buffer ? body : Buffer.from(body as ArrayBuffer),
      ContentType: contentType,
    }),
  );
}

/** Construct the public URL for an R2 object. */
export function r2PublicUrl(key: string): string {
  return `${R2_PUBLIC_PREFIX}/${key}`;
}

/** Bulk-delete objects from R2 by key. */
export async function r2DeleteMany(keys: string[]): Promise<number> {
  if (keys.length === 0) return 0;
  // DeleteObjects accepts max 1000 keys per call
  let deleted = 0;
  for (let i = 0; i < keys.length; i += 1000) {
    const batch = keys.slice(i, i + 1000);
    const res = await r2.send(
      new DeleteObjectsCommand({
        Bucket: R2_BUCKET,
        Delete: { Objects: batch.map((Key) => ({ Key })) },
      }),
    );
    deleted += res.Deleted?.length ?? 0;
  }
  return deleted;
}
