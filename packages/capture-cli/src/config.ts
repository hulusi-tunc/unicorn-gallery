import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createJiti } from 'jiti';
import type { GalleryConfig } from './types.js';

export function defineConfig(config: GalleryConfig): GalleryConfig {
  return config;
}

export async function loadConfig(configPath: string): Promise<GalleryConfig> {
  const absPath = resolve(process.cwd(), configPath);
  if (!existsSync(absPath)) {
    throw new Error(`Config file not found: ${absPath}`);
  }
  const jiti = createJiti(pathToFileURL(absPath).href, { interopDefault: true });
  const loaded = await jiti.import<GalleryConfig>(absPath, { default: true });
  if (!loaded || typeof loaded !== 'object') {
    throw new Error(
      `Config at ${absPath} did not export a default config object. Use \`export default defineConfig({...})\`.`,
    );
  }
  if (!loaded.projectId) {
    throw new Error(`Config at ${absPath} is missing required field "projectId".`);
  }
  if (!loaded.baseUrl) {
    throw new Error(`Config at ${absPath} is missing required field "baseUrl".`);
  }
  return loaded;
}
