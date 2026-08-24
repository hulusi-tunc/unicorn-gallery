import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppHeader } from '@/components/header';
import { FlowSidebar } from '@/components/flow-sidebar';
import { VersionBanner } from '@/components/version-banner';
import {
  getAppBySlug,
  getCurrentProfile,
  getManifestForApp,
  getUnresolvedCommentsByFrame,
  listAgencyProfiles,
  listAppCustomers,
  listBuildsForApp,
  listEligibleCustomersForApp,
  listProjectMembers,
} from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function AppLayout({
  children,
  modal,
  params,
}: {
  children: ReactNode;
  /**
   * Parallel `@modal` slot. An intercepting route (`@modal/(.)[flowId]/[frameId]`)
   * captures frame-card clicks from anywhere under this app — the landing page,
   * the Screens grid, or a flow grid — and renders the frame as an overlay modal
   * on top of the current view. Hard refresh / deep link has no intercept, so the
   * slot falls back to `default.tsx` (null) and the full `[frameId]` page renders.
   */
  modal: ReactNode;
  params: Promise<{ slug: string }>;
}): Promise<ReactNode> {
  const { slug } = await params;
  const app = await getAppBySlug(decodeURIComponent(slug));
  if (!app) notFound();

  // Note: Next.js 15 doesn't pass searchParams to layouts. Pages handle
  // their own `?v=N` filtering and pass it to children that need it
  // (e.g. version banner is a Client Component reading useSearchParams).
  // The sidebar always renders the LATEST flow tree to keep this layout
  // simple; the page area below shows the correct version's content.
  const [
    profile,
    agencyProfiles,
    customers,
    eligibleCustomers,
    builds,
    manifest,
    members,
    unresolvedByFrame,
  ] = await Promise.all([
    getCurrentProfile(),
    listAgencyProfiles(),
    listAppCustomers(app.id),
    listEligibleCustomersForApp(app.id),
    listBuildsForApp(app.id),
    getManifestForApp(app.id),
    listProjectMembers(app.id),
    getUnresolvedCommentsByFrame(app.id),
  ]);
  const canEdit = profile?.role === 'agency';
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

  const flowCount = manifest
    ? manifest.flows.filter((f) => f.frames.length > 0).length
    : 0;
  const frameCount = manifest
    ? manifest.flows.reduce((n, f) => n + f.frames.length, 0)
    : 0;

  return (
    <div className="flex flex-col overflow-x-hidden" style={{ height: 'calc(100vh - 60px)', overflowY: 'auto' }}>
      <AppHeader
        app={app}
        manifest={manifest}
        agencyProfiles={agencyProfiles}
        canEdit={canEdit}
        customers={customers}
        eligibleCustomers={eligibleCustomers}
        builds={builds}
        members={members}
        flowCount={flowCount}
        frameCount={frameCount}
      />
      <VersionBanner />
      <div className="mx-auto flex w-full max-w-[1600px] flex-1 gap-0 px-6 lg:px-10 xl:px-16">
        {manifest ? (
          <FlowSidebar manifest={manifest} appSlug={app.slug} unreadByFlow={unresolvedByFlow} />
        ) : null}
        <div className="flex flex-1">{children}</div>
      </div>
      {modal}
    </div>
  );
}
