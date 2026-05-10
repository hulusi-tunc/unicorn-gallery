import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppHeader } from '@/components/header';
import { FlowSidebar } from '@/components/flow-sidebar';
import {
  getAppBySlug,
  getCurrentProfile,
  getLatestBuild,
  getManifestForApp,
  getUnreadByFlowAndFrameForApp,
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
  const unread = profile
    ? await getUnreadByFlowAndFrameForApp(app.id, profile.id)
    : { byFlow: new Map<string, number>(), byFrame: new Map<string, number>() };

  return (
    <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 60px)' }}>
      <AppHeader
        app={app}
        manifest={manifest}
        agencyProfiles={agencyProfiles}
        canEdit={canEdit}
        latestVersion={latestBuild?.version ?? null}
        latestVersionAt={latestBuild?.created_at ?? null}
        customers={customers}
      />
      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 'calc(100vh - 60px - 56px)' }}>
        {manifest ? (
          <FlowSidebar manifest={manifest} appSlug={app.slug} unreadByFlow={unread.byFlow} />
        ) : null}
        <div className="flex flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
