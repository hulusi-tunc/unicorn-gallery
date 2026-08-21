'use client';

import { SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { AppCard } from '@/components/app-card';
import { EmptyState } from '@/components/empty-state';
import type { AppRowWithStaff } from '@/lib/db';

type PlatformFilter = 'all' | 'mobile' | 'web';
type StaffFilter = 'all' | 'mine';

export function AppsGrid({
  apps,
  unreadByApp,
  previewByApp,
  favorites,
  isAgency,
  myId,
}: {
  apps: AppRowWithStaff[];
  unreadByApp: Map<string, number>;
  previewByApp: Map<string, string[]>;
  favorites: Set<string>;
  isAgency: boolean;
  myId: string;
}): ReactNode {
  const [platform, setPlatform] = useState<PlatformFilter>(() => {
    if (typeof window === 'undefined') return 'mobile';
    return (localStorage.getItem('us:platform-filter') as PlatformFilter) || 'mobile';
  });
  const [staff, setStaff] = useState<StaffFilter>('all');

  useEffect(() => {
    localStorage.setItem('us:platform-filter', platform);
  }, [platform]);

  const filtered = useMemo(() => {
    let result = apps;
    if (platform === 'mobile') result = result.filter((a) => a.platform !== 'web');
    if (platform === 'web') result = result.filter((a) => a.platform === 'web');
    if (staff === 'mine') result = result.filter((a) => a.designer_id === myId || a.pm_id === myId);
    return [...result].sort((a, b) => Number(favorites.has(b.id)) - Number(favorites.has(a.id)));
  }, [apps, platform, staff, myId, favorites]);

  const MAX_PREVIEWS = 6;
  function previewsFor(app: AppRowWithStaff): string[] {
    const ordered = [app.preview_image_url, ...(previewByApp.get(app.id) ?? [])].filter(
      (u): u is string => Boolean(u),
    );
    return Array.from(new Set(ordered)).slice(0, MAX_PREVIEWS);
  }

  return (
    <div className="mx-auto w-[80%] pt-5 pb-10">
      <div className="flex items-center gap-5 pb-4">
        {/* Platform toggle */}
        <div className="inline-flex items-center rounded-full bg-[oklch(0.93_0.004_260)] p-[3px] dark:bg-[oklch(0.22_0.008_260)]">
          {(['mobile', 'web'] as const).map((p) => {
            const isActive = platform === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPlatform(isActive ? 'all' : p)}
                className={`rounded-full px-4 py-1.5 text-[13px] transition-all ${
                  isActive
                    ? 'bg-white font-medium text-[oklch(0.15_0.008_260)] shadow-sm dark:bg-[oklch(0.32_0.008_260)] dark:text-[oklch(0.97_0.005_260)]'
                    : 'font-normal text-[oklch(0.45_0.01_260)] dark:text-[oklch(0.55_0.01_260)]'
                }`}
              >
                {p === 'mobile' ? 'Mobile' : 'Web'}
              </button>
            );
          })}
        </div>

        <span className="h-5 w-px bg-[oklch(0.88_0.006_260)] dark:bg-[oklch(0.28_0.008_260)]" />

        {/* Staff tabs */}
        {isAgency ? (
          <nav className="flex items-center gap-5">
            {([
              { key: 'all' as const, label: 'All' },
              { key: 'mine' as const, label: 'My apps' },
            ]).map((f) => {
              const isActive = staff === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setStaff(f.key)}
                  className={`relative py-1 text-sm transition-colors ${
                    isActive
                      ? 'font-medium text-[oklch(0.15_0.008_260)] dark:text-[oklch(0.97_0.005_260)]'
                      : 'font-normal text-[oklch(0.45_0.01_260)] hover:text-[oklch(0.2_0.008_260)] dark:text-[oklch(0.52_0.01_260)] dark:hover:text-[oklch(0.85_0.01_260)]'
                  }`}
                >
                  {f.label}
                  {isActive ? (
                    <span className="absolute -bottom-3 left-0 right-0 h-[2px] bg-[oklch(0.15_0.008_260)] dark:bg-[oklch(0.97_0.005_260)]" />
                  ) : null}
                </button>
              );
            })}
          </nav>
        ) : null}

        <div className="ml-auto flex items-center gap-3">
          {isAgency ? (
            <Link
              href="/dor/team"
              className="inline-flex shrink-0 items-center gap-1.5 text-sm text-[oklch(0.42_0.008_260)] transition-colors hover:text-[oklch(0.15_0.008_260)] dark:text-[oklch(0.52_0.01_260)] dark:hover:text-[oklch(0.97_0.005_260)]"
            >
              <SlidersHorizontal size={15} />
              Filter
            </Link>
          ) : null}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={staff === 'mine' ? 'No apps assigned to you' : 'No apps yet'}
          body={staff === 'mine'
            ? 'Try the All tab, or assign yourself as designer/PM on a project.'
            : 'Open Unicorn Capture and push a project to get started.'}
        />
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((app) => (
            <AppCard
              key={app.id}
              app={app}
              unreadCount={unreadByApp.get(app.id) ?? 0}
              previewImages={previewsFor(app)}
              pinned={favorites.has(app.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
