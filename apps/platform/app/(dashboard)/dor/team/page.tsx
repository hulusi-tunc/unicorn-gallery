import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import {
  getCurrentProfile,
  listDorAssessments,
  listVisibleApps,
} from '@/lib/queries';
import { DorTool, type DorAppOption } from '@/components/dor-tool';

export const dynamic = 'force-dynamic';

export default async function DorTeamPage(): Promise<ReactNode> {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/sign-in');
  if (profile.role !== 'agency') redirect('/apps');

  const [apps, history] = await Promise.all([
    listVisibleApps(),
    listDorAssessments({ limit: 100 }),
  ]);

  const appOptions: DorAppOption[] = apps.map((a) => ({
    id: a.id,
    name: a.name,
    platform: a.platform,
  }));

  return (
    <DorTool
      mode="team"
      apps={appOptions}
      initialHistory={history}
      designerName={profile.name ?? profile.email}
    />
  );
}
