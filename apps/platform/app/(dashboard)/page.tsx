import { Plus } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { AppCard } from '@/components/app-card';
import { EmptyState } from '@/components/empty-state';
import { getCurrentProfile, listVisibleApps } from '@/lib/queries';
import type { AppRowWithStaff } from '@/lib/db';

export const dynamic = 'force-dynamic';

type StaffFilter = 'all' | 'mine' | 'designer' | 'pm' | 'unassigned';

const FILTERS: { key: StaffFilter; label: string; agencyOnly?: boolean }[] = [
  { key: 'all', label: 'All apps' },
  { key: 'mine', label: 'On my plate', agencyOnly: true },
  { key: 'designer', label: "I'm the designer", agencyOnly: true },
  { key: 'pm', label: "I'm the PM", agencyOnly: true },
  { key: 'unassigned', label: 'Unassigned', agencyOnly: true },
];

function applyFilter(
  apps: AppRowWithStaff[],
  filter: StaffFilter,
  myId: string,
): AppRowWithStaff[] {
  switch (filter) {
    case 'mine':
      return apps.filter((a) => a.designer_id === myId || a.pm_id === myId);
    case 'designer':
      return apps.filter((a) => a.designer_id === myId);
    case 'pm':
      return apps.filter((a) => a.pm_id === myId);
    case 'unassigned':
      return apps.filter((a) => !a.designer_id || !a.pm_id);
    case 'all':
    default:
      return apps;
  }
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ staff?: string }>;
}): Promise<ReactNode> {
  const profile = (await getCurrentProfile())!; // layout already redirected if null
  const apps = await listVisibleApps();
  const isAgency = profile.role === 'agency';

  const params = await searchParams;
  const filter: StaffFilter =
    isAgency &&
    params.staff &&
    ['mine', 'designer', 'pm', 'unassigned'].includes(params.staff)
      ? (params.staff as StaffFilter)
      : 'all';
  const filtered = applyFilter(apps, filter, profile.id);

  return (
    <div className="w-full px-8 py-10 lg:px-12 2xl:px-16">
      <div className="mb-8 flex items-baseline justify-between">
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

      {isAgency ? (
        <FilterBar active={filter} apps={apps} myId={profile.id} />
      ) : null}

      {filtered.length === 0 ? (
        isAgency ? (
          filter === 'all' ? (
            <EmptyState
              title="No apps yet"
              body="Create your first app to start capturing screens."
              hint="Click + Add app above. Then run the capture CLI from the customer's repo."
            />
          ) : (
            <EmptyState
              title="No apps match this filter"
              body="Try a different filter, or assign yourself as designer/PM on a project."
            />
          )
        ) : (
          <EmptyState
            title="No apps shared with you yet"
            body="Your PM will invite you to apps as they go live. Check back after they confirm."
          />
        )
      ) : (
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((app) => (
            <AppCard key={app.id} app={app} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterBar({
  active,
  apps,
  myId,
}: {
  active: StaffFilter;
  apps: AppRowWithStaff[];
  myId: string;
}): ReactNode {
  return (
    <nav className="mb-8 flex flex-wrap items-center gap-2">
      {FILTERS.map((f) => {
        const count = applyFilter(apps, f.key, myId).length;
        const isActive = f.key === active;
        const href = f.key === 'all' ? '/' : `/?staff=${f.key}`;
        return (
          <Link
            key={f.key}
            href={href}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              isActive
                ? 'border-[oklch(0.5_0.22_254)] bg-[oklch(0.95_0.04_254)] text-[oklch(0.5_0.22_254)] dark:border-[oklch(0.6_0.21_254)] dark:bg-[oklch(0.24_0.06_254)] dark:text-[oklch(0.6_0.21_254)]'
                : 'border-[oklch(0.9_0.007_260)] bg-white text-[oklch(0.24_0.01_260)] hover:border-[oklch(0.83_0.009_260)] dark:border-[oklch(0.24_0.008_260)] dark:bg-[oklch(0.175_0.007_260)] dark:text-[oklch(0.82_0.012_260)]'
            }`}
          >
            <span>{f.label}</span>
            <span
              className={`font-mono text-[10px] tabular-nums ${
                isActive
                  ? 'text-[oklch(0.5_0.22_254)] dark:text-[oklch(0.6_0.21_254)]'
                  : 'text-[oklch(0.48_0.01_260)] dark:text-[oklch(0.62_0.01_260)]'
              }`}
            >
              {count}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
