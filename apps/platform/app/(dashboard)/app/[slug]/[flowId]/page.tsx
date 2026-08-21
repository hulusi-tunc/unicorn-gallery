import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { FlowStrip } from '@/components/flow-strip';
import {
  getAppBySlug,
  getBuildByVersion,
  getManifestForApp,
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

  const manifest = await getManifestForApp(app.id, selectedBuild?.id);
  if (!manifest) notFound();
  const flow = manifest.flows.find((f) => f.id === flowId);
  if (!flow) notFound();

  const isMobile = manifest.platform !== 'web';
  const versionQuery = selectedBuild ? `?v=${selectedBuild.version ?? ''}` : '';

  return (
    <main className="flex flex-1 flex-col bg-white pl-8 pt-8 text-[oklch(0.24_0.01_260)] dark:bg-[oklch(0.145_0.006_260)] dark:text-[oklch(0.82_0.012_260)]">
      {/* Flow header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-[oklch(0.15_0.008_260)] dark:text-[oklch(0.97_0.005_260)]">
          {flow.name}
        </h1>
        <p className="mt-1 text-[13px] text-[oklch(0.48_0.01_260)] dark:text-[oklch(0.62_0.01_260)]">
          {flow.frames.length} screen{flow.frames.length === 1 ? '' : 's'}
        </p>
      </div>

      {flow.frames.length === 0 ? (
        <p className="py-13 text-sm text-[oklch(0.48_0.01_260)] dark:text-[oklch(0.62_0.01_260)]">
          This flow has no frames yet.
        </p>
      ) : (
        <FlowStrip
          flow={flow}
          appSlug={app.slug}
          isMobile={isMobile}
          versionQuery={versionQuery}
        />
      )}
    </main>
  );
}
