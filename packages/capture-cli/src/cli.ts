#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Command } from 'commander';
import { loadConfig } from './config.js';
import { runMaestroFlow } from './flows/maestro.js';
import { runPlaywrightFlow } from './flows/playwright-flow.js';
import { countFrames, writeManifest } from './manifest.js';
import { withPlaywrightSession } from './playwright-session.js';
import { walkRoutes } from './walkers/playwright.js';
import type { Manifest, ManifestFlow, Platform } from './types.js';

const program = new Command();

program
  .name('gallery-capture')
  .description('Walk every route and named flow in a project, screenshot each one, write a manifest.')
  .option('-c, --config <path>', 'path to gallery.config.ts', './gallery.config.ts')
  .option('-o, --out <dir>', 'output directory', './out')
  .option('--build-sha <sha>', 'build SHA (defaults to GIT_SHA, VERCEL_GIT_COMMIT_SHA, or `git rev-parse HEAD`)')
  .option('--platform <platform>', 'web | ios | android', 'web')
  .option('--clean', 'wipe output dir before running', false)
  .option('--upload <url>', 'POST manifest + screenshots to a platform URL after capture')
  .option('--project-token <token>', 'project token for upload (defaults to GALLERY_PROJECT_TOKEN env)');

program.parse();
const opts = program.opts<{
  config: string;
  out: string;
  buildSha?: string;
  platform: string;
  clean: boolean;
  upload?: string;
  projectToken?: string;
}>();

main().catch((err: unknown) => {
  console.error('[gallery-capture] Failed:', err instanceof Error ? err.message : err);
  if (err instanceof Error && err.stack) console.error(err.stack);
  process.exit(1);
});

async function main(): Promise<void> {
  const projectRoot = process.cwd();
  const outDir = resolve(projectRoot, opts.out);
  const log = (m: string): void => console.log(m);

  if (opts.clean) {
    await rm(outDir, { recursive: true, force: true });
  }
  await mkdir(outDir, { recursive: true });

  log(`[gallery-capture] Loading config from ${opts.config}`);
  const config = await loadConfig(opts.config);

  if (config.seed) {
    log('[gallery-capture] Running seed...');
    await config.seed();
  }

  const buildSha =
    opts.buildSha ??
    process.env['GIT_SHA'] ??
    process.env['VERCEL_GIT_COMMIT_SHA'] ??
    gitHeadSha(projectRoot) ??
    'unknown';
  const platform = parsePlatform(opts.platform);

  log(`[gallery-capture] Project: ${config.projectId} | Build: ${buildSha} | Platform: ${platform}`);

  const flows: ManifestFlow[] = [];
  const allFlowFiles = config.flows ?? [];
  const playwrightFlowFiles = allFlowFiles.filter((f) => /\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(f));
  const maestroFlowFiles = allFlowFiles.filter((f) => /\.(ya?ml)$/i.test(f));
  const unknownFlowFiles = allFlowFiles.filter(
    (f) => !playwrightFlowFiles.includes(f) && !maestroFlowFiles.includes(f),
  );
  for (const f of unknownFlowFiles) {
    log(`[gallery-capture] Warning: ignoring flow file with unknown extension: ${f}`);
  }

  const needsPlaywright =
    (platform === 'web' && config.skipRouteWalker !== true) || playwrightFlowFiles.length > 0;

  if (needsPlaywright) {
    await withPlaywrightSession(
      config,
      async (page) => {
        if (platform === 'web' && config.skipRouteWalker !== true) {
          log('[gallery-capture] Walking routes...');
          const routes = await walkRoutes({ config, page, outDir, projectRoot, log });
          if (routes.frames.length > 0) flows.push(routes);
        }
        for (const flowFile of playwrightFlowFiles) {
          try {
            const flow = await runPlaywrightFlow({ flowFile, page, outDir, projectRoot, log });
            if (flow && flow.frames.length > 0) flows.push(flow);
          } catch (err) {
            log(`[gallery-capture] Playwright flow ${flowFile} failed: ${(err as Error).message}`);
          }
        }
      },
      log,
    );
  }

  for (const flowFile of maestroFlowFiles) {
    try {
      const flow = await runMaestroFlow({ flowFile, outDir, projectRoot, log });
      if (flow && flow.frames.length > 0) flows.push(flow);
    } catch (err) {
      log(`[gallery-capture] Maestro flow ${flowFile} failed: ${(err as Error).message}`);
    }
  }

  const manifest: Manifest = {
    projectId: config.projectId,
    buildSha,
    capturedAt: new Date().toISOString(),
    platform,
    flows,
  };

  await writeManifest(outDir, manifest);
  const total = countFrames(manifest);
  log(`[gallery-capture] Wrote ${join(outDir, 'manifest.json')} with ${total} frame${total === 1 ? '' : 's'} across ${flows.length} flow${flows.length === 1 ? '' : 's'}.`);

  if (opts.upload) {
    await uploadCapture(opts.upload, outDir, manifest, opts.projectToken, log);
  }
}

async function uploadCapture(
  url: string,
  outDir: string,
  manifest: Manifest,
  tokenOpt: string | undefined,
  log: (m: string) => void,
): Promise<void> {
  const token = tokenOpt ?? process.env['GALLERY_PROJECT_TOKEN'];
  if (!token) {
    throw new Error(
      'Upload requested but no project token found. Pass --project-token <token> or set GALLERY_PROJECT_TOKEN.',
    );
  }
  log(`[gallery-capture] Uploading to ${url}...`);
  const { uploadCapture: doUpload } = await import('./upload.js');
  await doUpload({ url, outDir, manifest, token, log });
  log('[gallery-capture] Upload complete.');
}

function parsePlatform(input: string): Platform {
  if (input === 'web' || input === 'ios' || input === 'android') return input;
  throw new Error(`Invalid --platform "${input}". Expected web|ios|android.`);
}

function gitHeadSha(cwd: string): string | undefined {
  try {
    return execSync('git rev-parse --short HEAD', {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() || undefined;
  } catch {
    return undefined;
  }
}

