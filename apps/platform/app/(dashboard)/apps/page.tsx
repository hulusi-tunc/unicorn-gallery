import type { ReactNode } from 'react';
import { AppsGrid } from '@/components/apps-grid';
import {
  getCurrentProfile,
  getFavoriteAppIds,
  getPreviewFramesByApp,
  getUnreadCountsByApp,
  listVisibleApps,
} from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function AppsPage(): Promise<ReactNode> {
  const profile = (await getCurrentProfile())!;
  const [apps, unreadByApp, favorites] = await Promise.all([
    listVisibleApps(),
    getUnreadCountsByApp(profile.id),
    getFavoriteAppIds(profile.id),
  ]);
  const previewByApp = await getPreviewFramesByApp(apps.map((a) => a.id));

  // Convert Maps/Sets to serializable objects for the client component
  const unreadObj = Object.fromEntries(unreadByApp);
  const previewObj = Object.fromEntries(previewByApp);
  const favArr = Array.from(favorites);

  return (
    <AppsGrid
      apps={apps}
      unreadByApp={new Map(Object.entries(unreadObj))}
      previewByApp={new Map(Object.entries(previewObj))}
      favorites={new Set(favArr)}
      isAgency={profile.role === 'agency'}
      myId={profile.id}
    />
  );
}
