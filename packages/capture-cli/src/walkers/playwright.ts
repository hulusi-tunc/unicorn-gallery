import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Page } from 'playwright';
import type { GalleryConfig, ManifestFlow, ManifestFrame } from '../types.js';
import { discoverNextjsRoutes, type DiscoveredRoute } from './nextjs-routes.js';

const ROUTES_FLOW_ID = 'routes';

export interface RunWalkerOptions {
  config: GalleryConfig;
  page: Page;
  outDir: string;
  projectRoot: string;
  log?: (msg: string) => void;
}

export async function walkRoutes(opts: RunWalkerOptions): Promise<ManifestFlow> {
  const { config, page, outDir, projectRoot } = opts;
  const log = opts.log ?? ((m: string) => console.log(m));

  const routes = await discoverNextjsRoutes({
    projectRoot,
    appDir: config.appDir,
  });
  const skipPatterns = (config.skip ?? []).map(globToRegExp);
  const filtered = routes.filter(
    (r) => !skipPatterns.some((re) => re.test(r.pathname)),
  );

  log(`[walker] Discovered ${routes.length} route(s); ${filtered.length} after skip filter.`);

  const screenshotsDir = join(outDir, 'screenshots', ROUTES_FLOW_ID);
  await mkdir(screenshotsDir, { recursive: true });

  if (filtered.length === 0) {
    return { id: ROUTES_FLOW_ID, name: 'All Routes', frames: [] };
  }

  const frames: ManifestFrame[] = [];
  for (const route of filtered) {
    const frame = await captureRoute(page, config, route, screenshotsDir, log);
    if (frame) frames.push(frame);
  }

  return {
    id: ROUTES_FLOW_ID,
    name: 'All Routes',
    frames,
  };
}

async function captureRoute(
  page: Page,
  config: GalleryConfig,
  route: DiscoveredRoute,
  screenshotsDir: string,
  log: (msg: string) => void,
): Promise<ManifestFrame | null> {
  const url = config.baseUrl.replace(/\/$/, '') + route.pathname;
  const id = pathnameToId(route.pathname);
  const filename = `${id}.png`;
  const screenshotPath = join(screenshotsDir, filename);
  try {
    await page.goto(url, {
      waitUntil: config.waitUntil ?? 'networkidle',
      timeout: config.navigationTimeoutMs ?? 15_000,
    });
    await page.screenshot({ path: screenshotPath, fullPage: true });
    log(`[walker]   ✓ ${route.pathname}`);
    return {
      id,
      name: pathnameToName(route.pathname),
      image: `screenshots/${ROUTES_FLOW_ID}/${filename}`,
    };
  } catch (err) {
    log(`[walker]   ✗ ${route.pathname} — ${(err as Error).message}`);
    return null;
  }
}

function pathnameToId(pathname: string): string {
  if (pathname === '/') return 'index';
  return pathname.replace(/^\//, '').replace(/\//g, '-');
}

function pathnameToName(pathname: string): string {
  if (pathname === '/') return 'Home';
  return pathname
    .replace(/^\//, '')
    .split('/')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' '))
    .join(' / ');
}

function globToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  const withWildcards = escaped.replace(/\*/g, '.*');
  return new RegExp('^' + withWildcards + '$');
}
