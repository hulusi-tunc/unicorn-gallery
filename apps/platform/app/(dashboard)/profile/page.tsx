import type { ReactNode } from 'react';
import { ProfileForm } from './profile-form';
import { getCurrentProfile } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function ProfilePage(): Promise<ReactNode> {
  // Layout already redirects if not signed in
  const profile = (await getCurrentProfile())!;
  return <ProfileForm profile={profile} />;
}
