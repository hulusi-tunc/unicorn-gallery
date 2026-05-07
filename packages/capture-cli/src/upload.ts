import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { Manifest } from './types.js';

export interface UploadOptions {
  url: string;
  outDir: string;
  manifest: Manifest;
  token: string;
  log: (msg: string) => void;
}

export async function uploadCapture(opts: UploadOptions): Promise<void> {
  const { url, outDir, manifest, token, log } = opts;

  const form = new FormData();
  form.append('manifest', new Blob([JSON.stringify(manifest)], { type: 'application/json' }));

  let count = 0;
  for (const flow of manifest.flows) {
    for (const frame of flow.frames) {
      const filePath = join(outDir, frame.image);
      if (!existsSync(filePath)) {
        log(`[upload] missing screenshot ${frame.image} — skipped`);
        continue;
      }
      const info = await stat(filePath);
      const blob = await fileToBlob(filePath, info.size);
      form.append(frame.image, blob, basename(filePath));
      count++;
    }
  }

  log(`[upload] sending ${count} screenshot${count === 1 ? '' : 's'}...`);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
    },
    body: form,
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Upload failed: ${response.status} ${response.statusText} ${text}`);
  }
}

async function fileToBlob(filePath: string, size: number): Promise<Blob> {
  // Read fully into memory — screenshots are small (<1MB typically).
  // Avoids streaming complexity for v0.
  const chunks: Buffer[] = [];
  const stream = createReadStream(filePath);
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  const buffer = Buffer.concat(chunks);
  if (buffer.length !== size) {
    // soft warning only
  }
  return new Blob([buffer], { type: 'image/png' });
}
