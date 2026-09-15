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
  /** Defaults to true — see GalleryConfig.fullPage. */
  fullPage?: boolean;
  log?: (msg: string) => void;
}

/**
 * A flow file exports either one `defineFlow(...)` or, when it owns a whole
 * section, a `defineFlows(...)` list — the section's container plus its
 * sub-flows. Both come back as an array so the caller has one shape to handle.
 */
export async function runPlaywrightFlow(
  opts: RunPlaywrightFlowOptions,
): Promise<ManifestFlow[]> {
  const { flowFile, page, outDir, projectRoot } = opts;
  const fullPage = opts.fullPage ?? true;
  const log = opts.log ?? ((m: string) => console.log(m));
  const absPath = resolve(projectRoot, flowFile);

  const jiti = createJiti(pathToFileURL(absPath).href, { interopDefault: true });
  const loaded = await jiti.import<PlaywrightFlowDefinition | PlaywrightFlowDefinition[]>(
    absPath,
    { default: true },
  );
  const defs = Array.isArray(loaded) ? loaded : [loaded];
  if (defs.length === 0 || defs.some((d) => !d || d.__kind !== 'playwright-flow')) {
    throw new Error(
      `${flowFile} did not export a defineFlow() value. Expected: \`export default defineFlow(id, name, async ({page, snap}) => {...})\`, or defineFlows(...) for a section.`,
    );
  }

  const out: ManifestFlow[] = [];
  for (const def of defs) {
    log(`[flow ${def.id}] running ${flowFile}`);

    const flowDir = join(outDir, 'screenshots', def.id);
    await mkdir(flowDir, { recursive: true });

    const frames: ManifestFrame[] = [];
    const ctx: FlowSnapContext = {
      page,
      snap: async (id, name, options) => {
        const filename = `${id}.png`;
        await page.screenshot({
          path: join(flowDir, filename),
          fullPage: options?.fullPage ?? fullPage,
          ...(options?.scale ? { scale: options.scale } : {}),
        });
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

    out.push({
      id: def.id,
      name: def.name,
      ...(def.parentFlowId ? { parentFlowId: def.parentFlowId } : {}),
      frames,
    });
  }
  return out;
}

function humanize(id: string): string {
  return id
    .replace(/^\d+[-_]?/, '')
    .split(/[-_]/)
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}
