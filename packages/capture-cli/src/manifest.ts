import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Manifest } from './types.js';

export async function writeManifest(outDir: string, manifest: Manifest): Promise<void> {
  await mkdir(outDir, { recursive: true });
  await writeFile(
    join(outDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n',
    'utf8',
  );
}

export function countFrames(manifest: Manifest): number {
  return manifest.flows.reduce((n, f) => n + f.frames.length, 0);
}
