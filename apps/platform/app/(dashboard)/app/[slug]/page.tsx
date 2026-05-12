import { Camera } from 'lucide-react';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import type { ManifestFlow } from '@unicorn-studio/gallery-capture';
import { EmptyState } from '@/components/empty-state';
import { HashScroller } from '@/components/hash-scroller';
import { JourneyStrip } from '@/components/journey-strip';
import {
  type FrameUnresolvedSummary,
  getAppBySlug,
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

  const tree = buildFlowTree(manifest.flows);
  const totalFrames = manifest.flows.reduce((n, f) => n + f.frames.length, 0);
  const unresolvedByFrame = await getUnresolvedCommentsByFrame(app.id);

  return (
    <main className="flex flex-1 flex-col overflow-y-auto bg-white text-[oklch(0.24_0.01_260)] dark:bg-[oklch(0.145_0.006_260)] dark:text-[oklch(0.82_0.012_260)]">
      <HashScroller />
      <div className="border-b border-[oklch(0.9_0.007_260)] px-10 py-7 dark:border-[oklch(0.24_0.008_260)]">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[oklch(0.48_0.01_260)] dark:text-[oklch(0.62_0.01_260)]">
          Overview
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[oklch(0.15_0.008_260)] dark:text-[oklch(0.97_0.005_260)]">
          All flows
        </h1>
        <p className="mt-1 text-sm text-[oklch(0.48_0.01_260)] dark:text-[oklch(0.62_0.01_260)]">
          {tree.length} flow{tree.length === 1 ? '' : 's'} · {totalFrames} frame
          {totalFrames === 1 ? '' : 's'}
        </p>
      </div>

      <div className="flex flex-col gap-12 px-2 py-8">
        {tree.map((node) => (
          <FlowSection
            key={node.flow.id}
            node={node}
            platform={manifest.platform}
            appSlug={app.slug}
            isSub={false}
            unresolvedByFrame={unresolvedByFrame}
          />
        ))}
      </div>
    </main>
  );
}

function FlowSection({
  node,
  platform,
  appSlug,
  isSub,
  unresolvedByFrame,
}: {
  node: FlowNode;
  platform: 'ios' | 'android' | 'web';
  appSlug: string;
  isSub: boolean;
  unresolvedByFrame: Map<string, FrameUnresolvedSummary>;
}): ReactNode {
  return (
    <section
      id={`flow-${node.flow.id}`}
      // scroll-mt offsets the sticky/top chrome so the anchor lands the
      // section header just below it instead of behind the bar.
      className={
        isSub
          ? 'ml-10 scroll-mt-24 border-l-2 border-[oklch(0.92_0.01_260)] pl-6 dark:border-[oklch(0.26_0.01_260)]'
          : 'scroll-mt-24'
      }
    >
      <div
        className={
          isSub
            ? 'flex items-baseline justify-between px-2 pb-2'
            : 'flex items-baseline justify-between px-8 pb-3'
        }
      >
        <div>
          <h2
            className={
              isSub
                ? 'text-sm font-semibold tracking-tight text-[oklch(0.20_0.008_260)] dark:text-[oklch(0.92_0.005_260)]'
                : 'text-base font-semibold tracking-tight text-[oklch(0.15_0.008_260)] dark:text-[oklch(0.97_0.005_260)]'
            }
          >
            {node.flow.name}
          </h2>
          <p className="mt-0.5 font-mono text-[10px] text-[oklch(0.48_0.01_260)] dark:text-[oklch(0.62_0.01_260)]">
            {node.flow.id}
          </p>
        </div>
        <span className="text-xs text-[oklch(0.48_0.01_260)] dark:text-[oklch(0.62_0.01_260)]">
          {node.flow.frames.length} frame{node.flow.frames.length === 1 ? '' : 's'}
        </span>
      </div>
      <JourneyStrip
        flow={node.flow}
        platform={platform}
        appSlug={appSlug}
        unresolvedByFrame={unresolvedByFrame}
      />
      {node.children.length > 0 && (
        <div className="mt-6 flex flex-col gap-8">
          {node.children.map((child) => (
            <FlowSection
              key={child.flow.id}
              node={child}
              platform={platform}
              appSlug={appSlug}
              isSub={true}
              unresolvedByFrame={unresolvedByFrame}
            />
          ))}
        </div>
      )}
    </section>
  );
}
