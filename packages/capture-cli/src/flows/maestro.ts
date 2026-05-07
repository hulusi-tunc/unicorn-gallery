import { execSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readdir, rename, rm } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import type { ManifestFlow, ManifestFrame } from '../types.js';

export function isMaestroInstalled(): boolean {
  try {
    execSync('maestro --version', {
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5_000,
    });
    return true;
  } catch {
    return false;
  }
}

export interface RunMaestroFlowOptions {
  flowFile: string;
  outDir: string;
  projectRoot: string;
  log?: (msg: string) => void;
}

export async function runMaestroFlow(
  opts: RunMaestroFlowOptions,
): Promise<ManifestFlow | null> {
  const { flowFile, outDir, projectRoot } = opts;
  const log = opts.log ?? ((m: string) => console.log(m));

  if (!isMaestroInstalled()) {
    throw new Error(
      'Maestro is not installed. Install with: curl -Ls "https://get.maestro.mobile.dev" | bash',
    );
  }

  const absPath = resolve(projectRoot, flowFile);
  if (!existsSync(absPath)) {
    throw new Error(`Maestro flow file not found: ${absPath}`);
  }

  const id = sanitizeId(basename(flowFile, extname(flowFile)));
  log(`[maestro ${id}] running ${flowFile}`);

  const flowDir = join(outDir, 'screenshots', id);
  const tempDir = join(outDir, '.maestro-temp', id);
  await rm(tempDir, { recursive: true, force: true });
  await mkdir(flowDir, { recursive: true });
  await mkdir(tempDir, { recursive: true });

  const exitCode = await new Promise<number>((res, rej) => {
    const proc = spawn('maestro', ['test', absPath], {
      cwd: tempDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, MAESTRO_DRIVER_STARTUP_TIMEOUT: '60000' },
    });
    proc.stdout?.on('data', (chunk: Buffer) => {
      const lines = chunk.toString('utf8').trim().split('\n');
      for (const line of lines) if (line) log(`[maestro ${id}] ${line}`);
    });
    proc.stderr?.on('data', (chunk: Buffer) => {
      const lines = chunk.toString('utf8').trim().split('\n');
      for (const line of lines) if (line) log(`[maestro ${id}] ! ${line}`);
    });
    proc.on('close', (code) => res(code ?? 1));
    proc.on('error', rej);
  });

  if (exitCode !== 0) {
    log(`[maestro ${id}] exited ${exitCode} — keeping any screenshots that were taken`);
  }

  const frames = await collectScreenshots(tempDir, flowDir, id);
  await rm(tempDir, { recursive: true, force: true });

  return {
    id,
    name: humanize(id),
    frames,
  };
}

async function collectScreenshots(
  tempDir: string,
  flowDir: string,
  flowId: string,
): Promise<ManifestFrame[]> {
  const entries = await walk(tempDir);
  const frames: ManifestFrame[] = [];
  let counter = 0;
  for (const file of entries) {
    if (!file.toLowerCase().endsWith('.png')) continue;
    const rawName = basename(file, '.png');
    const frameId = sanitizeId(rawName) || `frame-${++counter}`;
    const outName = `${frameId}.png`;
    await rename(file, join(flowDir, outName));
    frames.push({
      id: frameId,
      name: humanize(frameId),
      image: `screenshots/${flowId}/${outName}`,
    });
  }
  return frames.sort((a, b) => a.id.localeCompare(b.id));
}

async function walk(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(full)));
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

function sanitizeId(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').toLowerCase();
}

function humanize(id: string): string {
  return id
    .replace(/^\d+[-_]?/, '')
    .split(/[-_]/)
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ') || id;
}
