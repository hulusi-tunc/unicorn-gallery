import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppHeader } from '@/components/header';
import { FlowSidebar } from '@/components/flow-sidebar';
import {
  getAppBySlug,
  getCurrentProfile,
  getManifestForApp,
  listAgencyProfiles,
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

  const [manifest, profile, agencyProfiles] = await Promise.all([
    getManifestForApp(app.id),
    getCurrentProfile(),
    listAgencyProfiles(),
  ]);
  // Only admins can change Designer/PM. Other agency users see the chip but no dropdown.
  const canEdit = profile?.role === 'agency' && profile.is_admin === true;

  return (
    <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 60px)' }}>
      <AppHeader
        app={app}
        manifest={manifest}
        agencyProfiles={agencyProfiles}
        canEdit={canEdit}
      />
      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 'calc(100vh - 60px - 56px)' }}>
        {manifest ? <FlowSidebar manifest={manifest} appSlug={app.slug} /> : null}
        <div className="flex flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
