import { Camera } from 'lucide-react';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { JourneyStrip } from '@/components/journey-strip';
import {
  getAppBySlug,
  getBuildByVersion,
  getCurrentProfile,
  getFreshFrameKeys,
  getManifestForApp,
  getUnresolvedCommentsByFrame,
} from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function FlowPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; flowId: string }>;
  searchParams: Promise<{ v?: string }>;
}): Promise<ReactNode> {
  const [{ slug, flowId: rawFlow }, sp] = await Promise.all([params, searchParams]);
  const flowId = decodeURIComponent(rawFlow);
  const app = await getAppBySlug(decodeURIComponent(slug));
  if (!app) notFound();

  const versionParam = sp.v ? Number(sp.v) : null;
  const selectedBuild =
    versionParam != null && Number.isFinite(versionParam)
      ? await getBuildByVersion(app.id, versionParam)
      : null;

  const profile = await getCurrentProfile();
  const manifest = await getManifestForApp(app.id, selectedBuild?.id);
  if (!manifest) notFound();
  const flow = manifest.flows.find((f) => f.id === flowId);
  if (!flow) notFound();

  const [freshFrameKeys, unresolvedByFrame] = await Promise.all([
    profile ? getFreshFrameKeys(profile.id, app.id) : Promise.resolve(new Set<string>()),
    getUnresolvedCommentsByFrame(app.id),
  ]);

  return (
    <main className="flex flex-1 flex-col overflow-y-auto bg-white text-[oklch(0.24_0.01_260)] dark:bg-[oklch(0.145_0.006_260)] dark:text-[oklch(0.82_0.012_260)]">
      <div className="flex items-baseline justify-between border-b border-[oklch(0.9_0.007_260)] px-10 py-7 dark:border-[oklch(0.24_0.008_260)]">
        <div>
          <p className="font-mono text-[13px] tracking-[0.12em] text-[oklch(0.48_0.01_260)] dark:text-[oklch(0.62_0.01_260)]">
            Flow
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[oklch(0.15_0.008_260)] dark:text-[oklch(0.97_0.005_260)]">
            {flow.name}
          </h1>
          <p className="mt-1 font-mono text-[13px] text-[oklch(0.48_0.01_260)] dark:text-[oklch(0.62_0.01_260)]">
            {flow.id}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-[oklch(0.48_0.01_260)] dark:text-[oklch(0.62_0.01_260)]">
          <Camera size={12} />
          <span>
            {flow.frames.length} frame{flow.frames.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {flow.frames.length === 0 ? (
        <p className="px-10 py-12 text-sm text-[oklch(0.48_0.01_260)] dark:text-[oklch(0.62_0.01_260)]">
          This flow has no frames yet.
        </p>
      ) : (
        <JourneyStrip
          flow={flow}
          platform={manifest.platform}
          appSlug={app.slug}
          freshFrameKeys={freshFrameKeys}
          unresolvedByFrame={unresolvedByFrame}
          versionQuery={selectedBuild ? `?v=${selectedBuild.version ?? ''}` : ''}
        />
      )}
    </main>
  );
}
