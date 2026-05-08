import { History } from 'lucide-react';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { EmptyState } from '@/components/empty-state';
import { getAppBySlug, listBuildsForApp } from '@/lib/queries';

export const dynamic = 'force-dynamic';

const TEXT_DISPLAY = 'text-[oklch(0.15_0.008_260)] dark:text-[oklch(0.97_0.005_260)]';
const TEXT_SECONDARY = 'text-[oklch(0.48_0.01_260)] dark:text-[oklch(0.62_0.01_260)]';
const BORDER = 'border-[oklch(0.9_0.007_260)] dark:border-[oklch(0.24_0.008_260)]';
const SURFACE = 'bg-white dark:bg-[oklch(0.175_0.007_260)]';

export default async function HistoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<ReactNode> {
  const { slug } = await params;
  const app = await getAppBySlug(decodeURIComponent(slug));
  if (!app) notFound();

  const builds = await listBuildsForApp(app.id);

  if (builds.length === 0) {
    return (
      <main className="flex flex-1 items-center justify-center px-6">
        <EmptyState
          icon={<History size={20} />}
          title="No versions yet"
          body="Push from the capture app to record the first version."
        />
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col overflow-y-auto bg-white dark:bg-[oklch(0.145_0.006_260)]">
      <div className={`border-b ${BORDER} px-10 py-7`}>
        <p className={`font-mono text-[10px] uppercase tracking-[0.12em] ${TEXT_SECONDARY}`}>
          Version history
        </p>
        <h1 className={`mt-1 text-2xl font-semibold tracking-tight ${TEXT_DISPLAY}`}>
          {builds.length} version{builds.length === 1 ? '' : 's'}
        </h1>
        <p className={`mt-1 text-sm ${TEXT_SECONDARY}`}>
          Every push from the capture app gets a version number. The diff shows what changed since
          the previous push.
        </p>
      </div>

      <ol className={`flex flex-col`}>
        {builds.map((b, i) => {
          const isLatest = i === 0;
          return (
            <li key={b.id} className={`border-b ${BORDER} px-10 py-6`}>
              <div className="flex items-start justify-between gap-6">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-3">
                    <span
                      className={`font-mono text-base font-semibold ${TEXT_DISPLAY}`}
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      v{b.version ?? '—'}
                    </span>
                    {isLatest ? (
                      <span
                        className={`rounded-full ${SURFACE} border ${BORDER} px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] ${TEXT_SECONDARY}`}
                      >
                        Latest
                      </span>
                    ) : null}
                    <time
                      className={`font-mono text-[11px] ${TEXT_SECONDARY}`}
                      dateTime={b.createdAt}
                    >
                      {formatRelative(b.createdAt)}
                    </time>
                  </div>
                  {b.message ? (
                    <p className={`mt-2 text-sm ${TEXT_DISPLAY}`}>{b.message}</p>
                  ) : null}
                  <p className={`mt-1 font-mono text-[10px] ${TEXT_SECONDARY}`}>{b.sha}</p>
                </div>
                <DiffChips
                  added={b.added}
                  updated={b.updated}
                  renamed={b.renamed}
                  removed={b.removed}
                  isFirstBuild={i === builds.length - 1}
                />
              </div>
            </li>
          );
        })}
      </ol>
    </main>
  );
}

function DiffChips({
  added,
  updated,
  renamed,
  removed,
  isFirstBuild,
}: {
  added: number;
  updated: number;
  renamed: number;
  removed: number;
  isFirstBuild: boolean;
}): ReactNode {
  if (isFirstBuild && added === 0 && updated === 0 && renamed === 0 && removed === 0) {
    return (
      <span className={`font-mono text-[11px] ${TEXT_SECONDARY}`}>Initial capture</span>
    );
  }
  return (
    <div className="flex shrink-0 items-center gap-2 font-mono text-[11px] tabular-nums">
      {added > 0 ? <Chip kind="added">+{added} added</Chip> : null}
      {updated > 0 ? <Chip kind="updated">~{updated} updated</Chip> : null}
      {renamed > 0 ? <Chip kind="renamed">↺{renamed} renamed</Chip> : null}
      {removed > 0 ? <Chip kind="removed">−{removed} removed</Chip> : null}
      {added + updated + renamed + removed === 0 ? (
        <span className={TEXT_SECONDARY}>No changes</span>
      ) : null}
    </div>
  );
}

function Chip({
  kind,
  children,
}: {
  kind: 'added' | 'updated' | 'renamed' | 'removed';
  children: ReactNode;
}): ReactNode {
  const styles: Record<typeof kind, string> = {
    added:
      'bg-[oklch(0.95_0.04_140)] text-[oklch(0.32_0.10_140)] dark:bg-[oklch(0.22_0.04_140)] dark:text-[oklch(0.78_0.10_140)]',
    updated:
      'bg-[oklch(0.95_0.04_254)] text-[oklch(0.32_0.10_254)] dark:bg-[oklch(0.22_0.04_254)] dark:text-[oklch(0.78_0.10_254)]',
    renamed:
      'bg-[oklch(0.95_0.04_60)] text-[oklch(0.32_0.10_60)] dark:bg-[oklch(0.22_0.04_60)] dark:text-[oklch(0.82_0.10_60)]',
    removed:
      'bg-[oklch(0.95_0.04_25)] text-[oklch(0.40_0.13_25)] dark:bg-[oklch(0.22_0.04_25)] dark:text-[oklch(0.78_0.10_25)]',
  };
  return (
    <span className={`rounded px-1.5 py-0.5 ${styles[kind]}`}>{children}</span>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
