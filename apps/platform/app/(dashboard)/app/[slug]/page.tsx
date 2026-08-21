import { Camera } from 'lucide-react';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import type { ManifestFlow } from '@unicorn-studio/gallery-capture';
import type { DetailTab } from '@/components/header';
import { EmptyState } from '@/components/empty-state';
import { FlowStrip } from '@/components/flow-strip';
import { HashScroller } from '@/components/hash-scroller';
import { ScreensGrid } from '@/components/screens-grid';
import {
  type FrameUnresolvedSummary,
  getAppBySlug,
  getBuildByVersion,
  getManifestForApp,
  getUnresolvedCommentsByFrame,
} from '@/lib/queries';

export const dynamic = 'force-dynamic';

interface FlowNode {
  flow: ManifestFlow;
  children: FlowNode[];
}

/**
 * Build a parent/child tree from the flat flows array. Top-level flows
 * (no `parentFlowId`) are roots; everything else nests under its parent.
 * Orphan sub-flows whose parent has been deleted bubble up to top-level.
 */
function buildFlowTree(flows: readonly ManifestFlow[]): FlowNode[] {
  const ids = new Set(flows.map((f) => f.id));
  const childrenOf = new Map<string | undefined, ManifestFlow[]>();
  for (const f of flows) {
    const key = f.parentFlowId && ids.has(f.parentFlowId) ? f.parentFlowId : undefined;
    const list = childrenOf.get(key) ?? [];
    list.push(f);
    childrenOf.set(key, list);
  }
  const build = (parent: string | undefined): FlowNode[] =>
    (childrenOf.get(parent) ?? []).map((f) => ({
      flow: f,
      children: build(f.id),
    }));
  return build(undefined);
}

export default async function AppOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ v?: string; tab?: string }>;
}): Promise<ReactNode> {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const app = await getAppBySlug(decodeURIComponent(slug));
  if (!app) notFound();

  // `?v=N` switches to a specific version; absent means latest.
  const versionParam = sp.v ? Number(sp.v) : null;
  const selectedBuild =
    versionParam != null && Number.isFinite(versionParam)
      ? await getBuildByVersion(app.id, versionParam)
      : null;

  const manifest = await getManifestForApp(app.id, selectedBuild?.id);

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

  const tree = buildFlowTree(manifest.flows);
  const unresolvedByFrame = await getUnresolvedCommentsByFrame(app.id);

  const activeTab: DetailTab = sp.tab === 'screens' ? 'screens' : 'flows';
  const versionQuery =
    selectedBuild?.version != null ? `?v=${selectedBuild.version}` : '';

  const basePath = `/app/${encodeURIComponent(app.slug)}`;
  const tabHref = (tab: 'screens' | 'flows'): string => {
    const p = new URLSearchParams();
    if (selectedBuild?.version != null) p.set('v', String(selectedBuild.version));
    if (tab === 'screens') p.set('tab', 'screens');
    const qs = p.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  const totalFrames = manifest.flows.reduce((n, f) => n + f.frames.length, 0);
  const totalFlows = manifest.flows.filter((f) => f.frames.length > 0).length;

  return (
    <main className={`relative flex flex-1 flex-col bg-white text-[oklch(0.24_0.01_260)] dark:bg-[oklch(0.145_0.006_260)] dark:text-[oklch(0.82_0.012_260)] ${activeTab === 'flows' ? 'pl-8' : ''}`}>
      <HashScroller />

      {/* Tab bar - only visible when NO sidebar (Screens tab) */}
      {activeTab === 'screens' ? (
        <div className="flex items-center gap-6 px-2 pb-4 pt-6">
          <nav className="flex items-center gap-5">
            {(['screens', 'flows'] as const).map((tab) => {
              const isActive = tab === activeTab;
              return (
                <a
                  key={tab}
                  href={tabHref(tab)}
                  className={`relative pb-2 text-sm ${
                    isActive
                      ? 'font-semibold text-[oklch(0.15_0.008_260)] dark:text-[oklch(0.97_0.005_260)]'
                      : 'font-normal text-[oklch(0.45_0.01_260)] dark:text-[oklch(0.52_0.01_260)]'
                  }`}
                >
                  {tab === 'screens' ? 'Screens' : 'Flows'}
                  {isActive ? (
                    <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[oklch(0.15_0.008_260)] dark:bg-[oklch(0.97_0.005_260)]" />
                  ) : null}
                </a>
              );
            })}
          </nav>
          <span className="ml-auto text-[13px] text-[oklch(0.48_0.01_260)] dark:text-[oklch(0.62_0.01_260)]">
            Showing {totalFrames} screen{totalFrames === 1 ? '' : 's'}
          </span>
        </div>
      ) : null}

      {activeTab === 'screens' ? (
        <ScreensGrid
          flows={manifest.flows}
          platform={manifest.platform}
          appSlug={app.slug}
          unresolvedByFrame={unresolvedByFrame}
          versionQuery={versionQuery}
        />
      ) : (
        <div className="flex flex-col gap-20 py-10">
          {tree.map((node) => (
            <FlowSection
              key={node.flow.id}
              node={node}
              platform={manifest.platform}
              appSlug={app.slug}
              isSub={false}
              unresolvedByFrame={unresolvedByFrame}
              versionQuery={versionQuery}
            />
          ))}
        </div>
      )}

    </main>
  );
}

function FlowSection({
  node,
  platform,
  appSlug,
  isSub,
  parentName,
  unresolvedByFrame,
  versionQuery,
}: {
  node: FlowNode;
  platform: 'ios' | 'android' | 'web';
  appSlug: string;
  isSub: boolean;
  parentName?: string;
  unresolvedByFrame: Map<string, FrameUnresolvedSummary>;
  versionQuery: string;
}): ReactNode {
  const isContainer = node.flow.frames.length === 0;
  const isMobile = platform !== 'web';

  return (
    <section
      id={`flow-${node.flow.id}`}
      className="scroll-mt-24"
    >
      {/* Container heading (parent flow with no frames of its own) */}
      {isContainer ? (
        <div className="mb-6 pl-1">
          <h2 className="text-lg font-semibold tracking-tight text-[oklch(0.15_0.008_260)] dark:text-[oklch(0.97_0.005_260)]">
            {node.flow.name}
          </h2>
          <p className="mt-1 text-[13px] text-[oklch(0.48_0.01_260)] dark:text-[oklch(0.62_0.01_260)]">
            {node.children.length} sub-flow{node.children.length === 1 ? '' : 's'}
          </p>
        </div>
      ) : null}

      {/* Flow strip with frames */}
      {!isContainer && node.flow.frames.length > 0 ? (
        <FlowStrip
          flow={node.flow}
          appSlug={appSlug}
          isMobile={isMobile}
          versionQuery={versionQuery}
          parentFlowName={parentName}
        />
      ) : null}

      {/* Sub-flows - indented under the parent */}
      {node.children.length > 0 ? (
        <div className={`${isContainer ? '' : 'mt-16'} ml-6 flex flex-col gap-14 border-l-2 border-[oklch(0.92_0.005_260)] pl-6 dark:border-[oklch(0.24_0.008_260)]`}>
          {node.children.map((child) => (
            <FlowSection
              key={child.flow.id}
              node={child}
              platform={platform}
              appSlug={appSlug}
              isSub={true}
              parentName={node.flow.name}
              unresolvedByFrame={unresolvedByFrame}
              versionQuery={versionQuery}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
