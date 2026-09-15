import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { Manifest, ManifestFlow } from './types.js';

export interface UploadOptions {
  url: string;
  outDir: string;
  manifest: Manifest;
  token: string;
  log: (msg: string) => void;
}

/**
 * Screenshot bytes per request.
 *
 * A whole capture in one POST is fine at a dozen frames and fails at seventy:
 * the request dies mid-body and the server reports a truncated form. The
 * platform's intake is built for this — a push arrives as several POSTs, and
 * only the first carries `replace=true` — so the uploader batches to a size
 * that comfortably survives a dev server and a proxy alike.
 */
const BATCH_BYTES = 4 * 1024 * 1024;

interface Pending {
  flow: ManifestFlow;
  frameIndex: number;
  bytes: number;
}

export async function uploadCapture(opts: UploadOptions): Promise<void> {
  const { url, outDir, manifest, token, log } = opts;

  // Stamp display order before splitting. Once frames are spread across
  // requests the receiving end can no longer infer order from array position,
  // so the manifest's own order has to travel with each row.
  const ordered: Manifest = {
    ...manifest,
    flows: manifest.flows.map((flow, flowPos) => ({
      ...flow,
      position: flow.position ?? flowPos,
      frames: flow.frames.map((frame, framePos) => ({
        ...frame,
        position: frame.position ?? framePos,
      })),
    })),
  };

  const batches = await planBatches(ordered, outDir, log);
  log(
    `[upload] ${countFrames(ordered)} screenshot${countFrames(ordered) === 1 ? '' : 's'} in ` +
      `${batches.length} request${batches.length === 1 ? '' : 's'}...`,
  );

  for (const [i, batch] of batches.entries()) {
    // Only the first request may replace — the rest append to it, or the
    // second batch would wipe what the first just wrote.
    const target = i === 0 ? url : withoutReplace(url);
    await postBatch(target, outDir, { ...ordered, flows: batch }, token, log, i + 1, batches.length);
  }
}

/**
 * Group the capture into requests, each under the byte budget.
 *
 * Flows are never reordered, only split: a flow with more frames than fit in
 * one request carries on in the next, and a frameless container rides along
 * with the first request so it reaches the flow tree at all.
 */
async function planBatches(
  manifest: Manifest,
  outDir: string,
  log: (msg: string) => void,
): Promise<ManifestFlow[][]> {
  const pending: Pending[] = [];
  const containers: ManifestFlow[] = [];

  for (const flow of manifest.flows) {
    if (flow.frames.length === 0) {
      containers.push(flow);
      continue;
    }
    for (const [frameIndex, frame] of flow.frames.entries()) {
      const filePath = join(outDir, frame.image);
      if (!existsSync(filePath)) {
        log(`[upload] missing screenshot ${frame.image} — skipped`);
        continue;
      }
      pending.push({ flow, frameIndex, bytes: (await stat(filePath)).size });
    }
  }

  const batches: ManifestFlow[][] = [];
  let current = new Map<string, ManifestFlow>();
  let bytes = 0;

  const flush = (): void => {
    if (current.size > 0) batches.push([...current.values()]);
    current = new Map();
    bytes = 0;
  };

  for (const item of pending) {
    if (item.bytes > BATCH_BYTES) {
      // Nothing can split one image across requests, so an oversized frame can
      // only be sent alone and hope. Say so: the alternative is a truncated
      // request and a "malformed form" error that names nothing.
      log(
        `[upload] ${item.flow.frames[item.frameIndex]?.image} is ${(item.bytes / 1024 / 1024).toFixed(1)}MB ` +
          `— larger than one request's budget. Capture it with \`scale: 'css'\` if it is a full-page frame.`,
      );
    }
    if (bytes > 0 && bytes + item.bytes > BATCH_BYTES) flush();
    const existing = current.get(item.flow.id);
    const target = existing ?? { ...item.flow, frames: [] };
    target.frames = [...target.frames, item.flow.frames[item.frameIndex]!];
    current.set(item.flow.id, target);
    bytes += item.bytes;
  }
  flush();

  if (batches.length === 0) batches.push([]);
  // Containers hold no bytes, so they cost nothing to send first, and sending
  // them first means every child arrives to a parent that already exists.
  batches[0] = [...containers, ...batches[0]!];
  return batches;
}

async function postBatch(
  url: string,
  outDir: string,
  manifest: Manifest,
  token: string,
  log: (msg: string) => void,
  index: number,
  total: number,
): Promise<void> {
  const form = new FormData();
  form.append('manifest', new Blob([JSON.stringify(manifest)], { type: 'application/json' }));

  let count = 0;
  for (const flow of manifest.flows) {
    for (const frame of flow.frames) {
      const filePath = join(outDir, frame.image);
      if (!existsSync(filePath)) continue;
      form.append(frame.image, await fileToBlob(filePath), basename(filePath));
      count++;
    }
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: form,
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `Upload failed on request ${index}/${total}: ${response.status} ${response.statusText} ${text}`,
    );
  }
  log(`[upload]   ✓ ${index}/${total} — ${count} screenshot${count === 1 ? '' : 's'}`);
}

function withoutReplace(url: string): string {
  const parsed = new URL(url);
  parsed.searchParams.delete('replace');
  return parsed.toString();
}

function countFrames(manifest: Manifest): number {
  return manifest.flows.reduce((n, f) => n + f.frames.length, 0);
}

async function fileToBlob(filePath: string): Promise<Blob> {
  // Read fully into memory — a screenshot is under a megabyte, and the batch
  // budget above caps how many are held at once.
  const chunks: Buffer[] = [];
  const stream = createReadStream(filePath);
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return new Blob([Buffer.concat(chunks)], { type: 'image/png' });
}
