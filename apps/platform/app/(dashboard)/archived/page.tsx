import { Archive, Clock, RotateCcw } from 'lucide-react';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { ArchivedAppRow } from '@/components/archived-app-row';
import { archiveDaysRemaining, ARCHIVE_GRACE_DAYS } from '@/lib/db';
import {
  getCurrentProfile,
  listArchivedApps,
} from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function ArchivedPage(): Promise<ReactNode> {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/sign-in');
  if (profile.role !== 'agency') {
    redirect('/');
  }
  const apps = await listArchivedApps();

  return (
    <div className="w-full px-8 py-10 lg:px-12 2xl:px-16">
      <div className="mb-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[oklch(0.48_0.01_260)] dark:text-[oklch(0.62_0.01_260)]">
          Archived
        </p>
        <h1 className="mt-1 text-3xl font-medium tracking-tight text-[oklch(0.15_0.008_260)] dark:text-[oklch(0.97_0.005_260)]">
          Recently removed projects
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-[oklch(0.42_0.01_260)] dark:text-[oklch(0.68_0.01_260)]">
          Projects archived from Capture or here. Restore any time within the {ARCHIVE_GRACE_DAYS}-day grace window — after that they're permanently deleted by the daily cleanup job.
        </p>
      </div>

      {apps.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-[oklch(0.9_0.007_260)] bg-white py-20 text-center dark:border-[oklch(0.24_0.008_260)] dark:bg-[oklch(0.175_0.007_260)]">
          <Archive size={32} className="text-[oklch(0.62_0.01_260)]" />
          <p className="text-sm text-[oklch(0.42_0.01_260)] dark:text-[oklch(0.68_0.01_260)]">
            No archived projects.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[oklch(0.9_0.007_260)] bg-white dark:border-[oklch(0.24_0.008_260)] dark:bg-[oklch(0.175_0.007_260)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[oklch(0.94_0.007_260)] text-left text-[11px] uppercase tracking-[0.08em] text-[oklch(0.48_0.01_260)] dark:border-[oklch(0.24_0.008_260)] dark:text-[oklch(0.62_0.01_260)]">
                <th className="px-5 py-3 font-medium">Project</th>
                <th className="px-5 py-3 font-medium">Archived</th>
                <th className="px-5 py-3 font-medium">
                  <span className="inline-flex items-center gap-1">
                    <Clock size={12} /> Auto-delete in
                  </span>
                </th>
                <th className="px-5 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((app) => (
                <ArchivedAppRow
                  key={app.id}
                  app={app}
                  daysRemaining={
                    app.archived_at ? archiveDaysRemaining(app.archived_at) : 0
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-6 inline-flex items-center gap-1.5 text-xs text-[oklch(0.55_0.01_260)] dark:text-[oklch(0.62_0.01_260)]">
        <RotateCcw size={12} /> Restore is non-destructive — snaps and history come back exactly as they were.
      </p>
    </div>
  );
}
