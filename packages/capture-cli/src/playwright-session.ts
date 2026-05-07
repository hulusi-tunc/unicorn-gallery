import { chromium, type Page } from 'playwright';
import type { GalleryConfig } from './types.js';

const DEFAULT_VIEWPORT = { width: 1440, height: 900 };

export async function withPlaywrightSession<T>(
  config: GalleryConfig,
  fn: (page: Page) => Promise<T>,
  log: (msg: string) => void,
): Promise<T> {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      viewport: config.viewport ?? DEFAULT_VIEWPORT,
    });
    const page = await context.newPage();
    if (config.auth) {
      log('[playwright] Running auth step...');
      await config.auth(page);
    }
    return await fn(page);
  } finally {
    await browser.close();
  }
}
