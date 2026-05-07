import { Plus } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { AppCard } from '@/components/app-card';
import { EmptyState } from '@/components/empty-state';
import { getCurrentProfile, listVisibleApps } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function HomePage(): Promise<ReactNode> {
  const profile = (await getCurrentProfile())!; // layout already redirected if null
  const apps = await listVisibleApps();
  const isAgency = profile.role === 'agency';

  return (
    <div className="w-full px-8 py-10 lg:px-12 2xl:px-16">
      <div className="mb-10 flex items-baseline justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[oklch(0.48_0.01_260)] dark:text-[oklch(0.62_0.01_260)]">
            {isAgency ? 'All apps' : 'Your apps'}
          </p>
          <h1 className="mt-1 text-3xl font-medium tracking-tight text-[oklch(0.15_0.008_260)] dark:text-[oklch(0.97_0.005_260)]">
            {isAgency ? 'Customer apps' : 'Apps shared with you'}
          </h1>
        </div>
        {isAgency ? (
          <Link
            href="/admin/apps/new"
            className="inline-flex items-center gap-1.5 rounded-full bg-[oklch(0.5_0.22_254)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            <Plus size={14} /> Add app
          </Link>
        ) : null}
      </div>

      {apps.length === 0 ? (
        isAgency ? (
          <EmptyState
            title="No apps yet"
            body="Create your first app to start capturing screens."
            hint="Click + Add app above. Then run the capture CLI from the customer's repo."
          />
        ) : (
          <EmptyState
            title="No apps shared with you yet"
            body="Your PM will invite you to apps as they go live. Check back after they confirm."
          />
        )
      ) : (
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {apps.map((app) => (
            <AppCard key={app.id} app={app} />
          ))}
        </div>
      )}
    </div>
  );
}
