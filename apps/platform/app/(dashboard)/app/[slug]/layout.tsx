import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppHeader } from '@/components/header';
import { FlowSidebar } from '@/components/flow-sidebar';
import {
  getAppBySlug,
  getCurrentProfile,
  getLatestBuild,
  getManifestForApp,
  getUnresolvedCommentsByFrame,
  listAgencyProfiles,
  listAppCustomers,
} from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function AppLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}): Promise<ReactNode> {
  const { slug } = await params;
  const app = await getAppBySlug(decodeURIComponent(slug));
  if (!app) notFound();

  const [manifest, profile, agencyProfiles, latestBuild, customers] = await Promise.all([
    getManifestForApp(app.id),
    getCurrentProfile(),
    listAgencyProfiles(),
    getLatestBuild(app.id),
    listAppCustomers(app.id),
  ]);
  // Any agency member can change Designer / PM. Customers see chips but no dropdown.
  const canEdit = profile?.role === 'agency';
  // Sidebar shows unresolved-comment counts (not "unread") so the badge
  // semantics match the orange frame-card badge — clears only when the
  // thread is resolved, not just viewed. We aggregate per-frame
  // unresolved counts up to each flow + its descendant sub-flows.
  const unresolvedByFrame = await getUnresolvedCommentsByFrame(app.id);
  const unresolvedByFlow = new Map<string, number>();
  if (manifest) {
    const flowChildren = new Map<string, string[]>();
    for (const f of manifest.flows) {
      if (!f.parentFlowId) continue;
      const arr = flowChildren.get(f.parentFlowId) ?? [];
      arr.push(f.id);
      flowChildren.set(f.parentFlowId, arr);
    }
    const ownUnresolved = new Map<string, number>();
    for (const f of manifest.flows) {
      let n = 0;
      for (const fr of f.frames) n += unresolvedByFrame.get(fr.id)?.count ?? 0;
      ownUnresolved.set(f.id, n);
    }
    const collect = (id: string): number => {
      let total = ownUnresolved.get(id) ?? 0;
      for (const c of flowChildren.get(id) ?? []) total += collect(c);
      return total;
    };
    for (const f of manifest.flows) {
      const total = collect(f.id);
      if (total > 0) unresolvedByFlow.set(f.id, total);
    }
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 60px)' }}>
      <AppHeader
        app={app}
        manifest={manifest}
        agencyProfiles={agencyProfiles}
        canEdit={canEdit}
        latestVersion={latestBuild?.version ?? null}
        latestVersionAt={latestBuild?.created_at ?? null}
        customers={customers}
      />
      <div className="flex flex-1 overflow-hidden">
        {manifest ? (
          <FlowSidebar manifest={manifest} appSlug={app.slug} unreadByFlow={unresolvedByFlow} />
        ) : null}
        <div className="flex flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
