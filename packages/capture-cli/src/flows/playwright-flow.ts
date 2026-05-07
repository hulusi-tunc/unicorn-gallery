import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createJiti } from 'jiti';
import type { Page } from 'playwright';
import type {
  FlowSnapContext,
  ManifestFlow,
  ManifestFrame,
  PlaywrightFlowDefinition,
} from '../types.js';

export interface RunPlaywrightFlowOptions {
  flowFile: string;
  page: Page;
  outDir: string;
  projectRoot: string;
  log?: (msg: string) => void;
}

export async function runPlaywrightFlow(
  opts: RunPlaywrightFlowOptions,
): Promise<ManifestFlow | null> {
  const { flowFile, page, outDir, projectRoot } = opts;
  const log = opts.log ?? ((m: string) => console.log(m));
  const absPath = resolve(projectRoot, flowFile);

  const jiti = createJiti(pathToFileURL(absPath).href, { interopDefault: true });
  const def = await jiti.import<PlaywrightFlowDefinition>(absPath, { default: true });
  if (!def || def.__kind !== 'playwright-flow') {
    throw new Error(
      `${flowFile} did not export a defineFlow() value. Expected: \`export default defineFlow(id, name, async ({page, snap}) => {...})\``,
    );
  }

  log(`[flow ${def.id}] running ${flowFile}`);

  const flowDir = join(outDir, 'screenshots', def.id);
  await mkdir(flowDir, { recursive: true });

  const frames: ManifestFrame[] = [];
  const ctx: FlowSnapContext = {
    page,
    snap: async (id, name) => {
      const filename = `${id}.png`;
      await page.screenshot({ path: join(flowDir, filename), fullPage: true });
      frames.push({
        id,
        name: name ?? humanize(id),
        image: `screenshots/${def.id}/${filename}`,
      });
      log(`[flow ${def.id}]   ✓ ${id}`);
    },
  };

  try {
    await def.run(ctx);
  } catch (err) {
    log(`[flow ${def.id}] ✗ failed mid-run: ${(err as Error).message}`);
  }

  return { id: def.id, name: def.name, frames };
}

function humanize(id: string): string {
  return id
    .replace(/^\d+[-_]?/, '')
    .split(/[-_]/)
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}
