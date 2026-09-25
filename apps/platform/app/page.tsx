import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { Landing } from '@/components/landing';
import { getBrand } from '@/lib/brand-server';
import { getCurrentProfile } from '@/lib/queries';

export const dynamic = 'force-dynamic';

// Public front door. Signed-in visitors go straight to their gallery; everyone
// else sees the marketing landing.
export default async function RootPage(): Promise<ReactNode> {
  const profile = await getCurrentProfile();
  if (profile) redirect('/apps');
  // The landing is Unicorn's own marketing; a white-labelled host has none.
  if ((await getBrand()).id !== 'unicorn') redirect('/sign-in');
  return <Landing />;
}
