import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';

const PAGE_FILE_RE = /^page\.(tsx|ts|jsx|js|mdx)$/;
const DEFAULT_APP_CANDIDATES = ['app', 'src/app'];

export interface DiscoveredRoute {
  /** Pathname to navigate to, e.g. "/", "/about", "/blog". */
  pathname: string;
  /** Source file that defines the page, relative to the project root. */
  sourceFile: string;
}

export interface DiscoverOptions {
  /** Project root containing the Next.js / expo-router app. */
  projectRoot: string;
  /** Override the app dir (relative to projectRoot). Auto-detected if omitted. */
  appDir?: string;
}

export async function discoverNextjsRoutes(
  opts: DiscoverOptions,
): Promise<DiscoveredRoute[]> {
  const appDir = resolveAppDir(opts);
  if (!appDir) return [];

  const found: DiscoveredRoute[] = [];
  await walk(appDir, found, appDir, opts.projectRoot);
  found.sort((a, b) => a.pathname.localeCompare(b.pathname));
  return found;
}

function resolveAppDir(opts: DiscoverOptions): string | null {
  const candidates = opts.appDir ? [opts.appDir] : DEFAULT_APP_CANDIDATES;
  for (const c of candidates) {
    const abs = resolve(opts.projectRoot, c);
    if (existsSync(abs)) return abs;
  }
  return null;
}

async function walk(
  dir: string,
  out: DiscoveredRoute[],
  appDir: string,
  projectRoot: string,
): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (shouldSkipDir(entry.name)) continue;
      await walk(full, out, appDir, projectRoot);
    } else if (entry.isFile() && PAGE_FILE_RE.test(entry.name)) {
      const pathname = filePathToRoute(appDir, full);
      if (pathname !== null) {
        out.push({
          pathname,
          sourceFile: relative(projectRoot, full),
        });
      }
    }
  }
}

function shouldSkipDir(name: string): boolean {
  if (name === 'node_modules') return true;
  if (name === 'api') return true;
  if (name.startsWith('_')) return true;
  if (name.startsWith('.')) return true;
  if (name.startsWith('@')) return true;
  return false;
}

function filePathToRoute(appDir: string, filePath: string): string | null {
  const rel = relative(appDir, filePath);
  const dir = rel.split(sep).slice(0, -1);

  const cleaned: string[] = [];
  for (const seg of dir) {
    if (!seg) continue;
    if (seg.startsWith('(') && seg.endsWith(')')) continue;
    if (seg.startsWith('_') || seg.startsWith('@')) return null;
    if (seg.startsWith('[') && seg.endsWith(']')) return null;
    cleaned.push(seg);
  }
  return cleaned.length === 0 ? '/' : '/' + cleaned.join('/');
}
