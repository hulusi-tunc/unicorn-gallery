import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getCurrentProfile, listAllProfiles } from '@/lib/queries';
import { UsersTable } from './users-table';

export const dynamic = 'force-dynamic';

export default async function AdminPage(): Promise<ReactNode> {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/sign-in');
  if (profile.role !== 'agency') redirect('/');

  const profiles = await listAllProfiles();

  return <UsersTable profiles={profiles} currentUserId={profile.id} />;
}
