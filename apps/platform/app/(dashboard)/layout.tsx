import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { DashboardTopNav, TOPNAV_HEIGHT } from '@/components/dashboard-topnav';
import { RealtimeRefresh } from '@/components/realtime-refresh';
import { TooltipProvider } from '@/components/ui/tooltip';
import { BRANDS } from '@/lib/brand';
import { getBrand } from '@/lib/brand-server';
import { getClientBrand, getCurrentProfile, getTotalUnreadCount } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}): Promise<ReactNode> {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/sign-in');

  // A client of a white-labelled project who arrives on the Unicorn host (an
  // old bookmark, a link from before the project was branded) is sent to
  // their brand's host, so they never browse the gallery under Unicorn.
  if (profile.role === 'customer' && (await getBrand()).id === 'unicorn') {
    const clientBrand = await getClientBrand(profile.id);
    if (clientBrand !== 'unicorn') redirect(`${BRANDS[clientBrand].origin}/apps`);
  }

  const unreadCount = await getTotalUnreadCount(profile.id);

  return (
    <TooltipProvider delayDuration={150}>
      <div style={{ minHeight: '100vh', overflowX: 'hidden' }}>
        <RealtimeRefresh table="notifications" filter={`user_id=eq.${profile.id}`} />
        <DashboardTopNav profile={profile} unreadCount={unreadCount} />
        <main style={{ paddingTop: TOPNAV_HEIGHT }}>{children}</main>
      </div>
    </TooltipProvider>
  );
}
