import { Chrome, Download, Monitor } from 'lucide-react';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getCurrentProfile } from '@/lib/queries';
import { getLatestReleases } from '@/lib/releases';
import {
  formatBytes,
  RELEASE_HINTS,
  RELEASE_KINDS,
  RELEASE_LABELS,
  type Release,
  type ReleaseKind,
} from '@/lib/releases-shared';

export const dynamic = 'force-dynamic';

const ICONS: Record<ReleaseKind, typeof Monitor> = {
  'macos-desktop': Monitor,
  'chrome-extension': Chrome,
};

function ReleaseCard({
  kind,
  release,
}: {
  kind: ReleaseKind;
  release: Release | undefined;
}): ReactNode {
  const Icon = ICONS[kind];
  const size = formatBytes(release?.size_bytes ?? null);

  return (
    <div className="flex flex-col rounded-xl border border-[oklch(0.9_0.007_260)] bg-white p-6 dark:border-[oklch(0.24_0.008_260)] dark:bg-[oklch(0.175_0.007_260)]">
      <div className="flex items-start gap-3">
        <span className="rounded-lg bg-[oklch(0.96_0.004_260)] p-2 dark:bg-[oklch(0.22_0.007_260)]">
          <Icon size={18} className="text-[oklch(0.42_0.01_260)] dark:text-[oklch(0.72_0.01_260)]" />
        </span>
        <div className="min-w-0">
          <h2 className="text-[15px] font-medium text-[oklch(0.15_0.008_260)] dark:text-[oklch(0.97_0.005_260)]">
            {RELEASE_LABELS[kind]}
          </h2>
          <p className="mt-1 text-[12px] leading-relaxed text-[oklch(0.48_0.01_260)] dark:text-[oklch(0.62_0.01_260)]">
            {RELEASE_HINTS[kind]}
          </p>
        </div>
      </div>

      {release ? (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-2 text-[11px] text-[oklch(0.48_0.01_260)] dark:text-[oklch(0.62_0.01_260)]">
            <span className="rounded-full bg-[oklch(0.96_0.004_260)] px-2 py-0.5 font-mono dark:bg-[oklch(0.22_0.007_260)]">
              v{release.version}
            </span>
            {release.channel === 'canary' ? (
              <span className="rounded-full bg-[oklch(0.94_0.06_75)] px-2 py-0.5 font-mono uppercase tracking-[0.06em] text-[oklch(0.42_0.11_60)]">
                canary
              </span>
            ) : null}
            {size ? <span>{size}</span> : null}
            <span>
              {new Date(release.created_at).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </span>
          </div>
          {release.notes ? (
            <p className="mt-3 whitespace-pre-line text-[12px] leading-relaxed text-[oklch(0.42_0.01_260)] dark:text-[oklch(0.68_0.01_260)]">
              {release.notes}
            </p>
          ) : null}
          <a
            href={release.file_url}
            download={release.file_name}
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-[oklch(0.15_0.008_260)] px-4 py-2.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90 dark:bg-[oklch(0.97_0.005_260)] dark:text-[oklch(0.15_0.008_260)]"
          >
            <Download size={14} />
            Download
          </a>
        </>
      ) : (
        <p className="mt-6 rounded-lg border border-dashed border-[oklch(0.88_0.007_260)] px-4 py-6 text-center text-[12px] text-[oklch(0.48_0.01_260)] dark:border-[oklch(0.28_0.008_260)] dark:text-[oklch(0.62_0.01_260)]">
          No build published yet.
        </p>
      )}
    </div>
  );
}

export default async function DownloadsPage(): Promise<ReactNode> {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/sign-in');

  const releases = await getLatestReleases();
  // Stable is what the team should get by default.
  const stable = new Map(
    releases.filter((r) => r.channel === 'stable').map((r) => [r.kind, r]),
  );

  return (
    <div className="w-full px-8 py-10 lg:px-12 2xl:px-16">
      <div className="mb-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[oklch(0.48_0.01_260)] dark:text-[oklch(0.62_0.01_260)]">
          Downloads
        </p>
        <h1 className="mt-1 text-3xl font-medium tracking-tight text-[oklch(0.15_0.008_260)] dark:text-[oklch(0.97_0.005_260)]">
          Get the apps
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-[oklch(0.42_0.01_260)] dark:text-[oklch(0.68_0.01_260)]">
          The latest Capture desktop build and browser extension. Always the
          current version — no more passing files around.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:max-w-4xl">
        {RELEASE_KINDS.map((kind) => (
          <ReleaseCard key={kind} kind={kind} release={stable.get(kind)} />
        ))}
      </div>
    </div>
  );
}
