import { Camera } from 'lucide-react';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { EmptyState } from '@/components/empty-state';
import { JourneyStrip } from '@/components/journey-strip';
import { getAppBySlug, getManifestForApp } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function AppOverviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<ReactNode> {
  const { slug } = await params;
  const app = await getAppBySlug(decodeURIComponent(slug));
  if (!app) notFound();

  // Read from the `frames` table, not builds.manifest — the latter only stores
  // the last upload batch when capture chunks. See snap-bridge / capture pipeline
  // notes in project memory.
  const manifest = await getManifestForApp(app.id);

  if (!manifest || manifest.flows.length === 0) {
    return (
      <main className="flex flex-1 items-center justify-center px-6">
        <EmptyState
          icon={<Camera size={20} />}
          title="No screens captured yet"
          body={`Run the capture CLI from this app's repo with \`--upload\` to send the first build.`}
          hint={`pnpm exec gallery-capture --upload https://your-platform.example.com/api/captures/upload --project-token <token>`}
        />
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col overflow-y-auto bg-white text-[oklch(0.24_0.01_260)] dark:bg-[oklch(0.145_0.006_260)] dark:text-[oklch(0.82_0.012_260)]">
      <div className="border-b border-[oklch(0.9_0.007_260)] px-10 py-7 dark:border-[oklch(0.24_0.008_260)]">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[oklch(0.48_0.01_260)] dark:text-[oklch(0.62_0.01_260)]">
          Overview
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[oklch(0.15_0.008_260)] dark:text-[oklch(0.97_0.005_260)]">
          All flows
        </h1>
        <p className="mt-1 text-sm text-[oklch(0.48_0.01_260)] dark:text-[oklch(0.62_0.01_260)]">
          {manifest.flows.length} flow{manifest.flows.length === 1 ? '' : 's'} ·{' '}
          {manifest.flows.reduce((n, f) => n + f.frames.length, 0)} frames
        </p>
      </div>

      <div className="flex flex-col gap-12 px-2 py-8">
        {manifest.flows.map((flow) => (
          <section key={flow.id}>
            <div className="flex items-baseline justify-between px-8 pb-3">
              <div>
                <h2 className="text-base font-semibold tracking-tight text-[oklch(0.15_0.008_260)] dark:text-[oklch(0.97_0.005_260)]">
                  {flow.name}
                </h2>
                <p className="mt-0.5 font-mono text-[10px] text-[oklch(0.48_0.01_260)] dark:text-[oklch(0.62_0.01_260)]">
                  {flow.id}
                </p>
              </div>
              <span className="text-xs text-[oklch(0.48_0.01_260)] dark:text-[oklch(0.62_0.01_260)]">
                {flow.frames.length} frame{flow.frames.length === 1 ? '' : 's'}
              </span>
            </div>
            <JourneyStrip flow={flow} platform={manifest.platform} appSlug={app.slug} />
          </section>
        ))}
      </div>
    </main>
  );
}
