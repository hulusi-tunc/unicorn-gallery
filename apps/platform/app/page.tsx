import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { Landing } from '@/components/landing';
import { getCurrentProfile } from '@/lib/queries';

export const dynamic = 'force-dynamic';

// Public front door. Signed-in visitors go straight to their gallery; everyone
// else sees the marketing landing.
export default async function RootPage(): Promise<ReactNode> {
  const profile = await getCurrentProfile();
  if (profile) redirect('/apps');
  return <Landing />;
}
