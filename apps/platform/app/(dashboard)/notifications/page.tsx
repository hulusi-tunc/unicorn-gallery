import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { NotificationsList } from './notifications-list';
import { getCurrentProfile, listNotifications } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}): Promise<ReactNode> {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/sign-in');

  const params = await searchParams;
  const filter = params.filter === 'unread' ? 'unread' : 'all';

  const items = await listNotifications(profile.id, {
    limit: 100,
    onlyUnseen: filter === 'unread',
  });

  return (
    <NotificationsList
      items={items}
      currentUserId={profile.id}
      filter={filter}
    />
  );
}
