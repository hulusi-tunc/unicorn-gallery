import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { DashboardTopNav, TOPNAV_HEIGHT } from '@/components/dashboard-topnav';
import { getCurrentProfile } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}): Promise<ReactNode> {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/sign-in');

  return (
    <div style={{ minHeight: '100vh' }}>
      <DashboardTopNav profile={profile} />
      <main style={{ paddingTop: TOPNAV_HEIGHT }}>{children}</main>
    </div>
  );
}
