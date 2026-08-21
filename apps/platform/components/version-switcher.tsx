'use client';

import { Check, ChevronDown, History } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useMemo, type ReactNode } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTheme } from '@/components/providers/theme-provider';
import type { BuildSummary } from '@/lib/queries';
import { editorialFonts, getNd } from '@/lib/tokens';

interface VersionSwitcherProps {
  appSlug: string;
  builds: BuildSummary[];
}

/**
 * Header dropdown that lists every version of an app. Picking a version
 * navigates to `?v=N` on the current path, which the layout + frame pages
 * pick up to render that version's snapshot. Picking "Latest" clears the
 * `v` param. The "Full history" link at the bottom routes to the existing
 * `/history` page where diff stats live.
 */
export function VersionSwitcher({ appSlug, builds }: VersionSwitcherProps): ReactNode {
  const { theme } = useTheme();
  const t = getNd(theme);
  const pathname = usePathname() ?? `/app/${appSlug}`;
  const searchParams = useSearchParams();
  const currentV = searchParams?.get('v');
  const currentVersion = currentV ? Number(currentV) : null;
  const latest = builds[0] ?? null;
  const isLatestSelected = currentVersion === null;

  const triggerLabel = useMemo(() => {
    if (isLatestSelected) {
      return latest ? `v${latest.version ?? '—'}` : 'No versions';
    }
    return `v${currentVersion ?? '—'}`;
  }, [isLatestSelected, latest, currentVersion]);

  if (builds.length === 0) return null;

  // Build hrefs that preserve the current path but rewrite `v`. Frame pages
  // live under /app/<slug>/[flow]/[frame]; the version applies to that
  // depth too, not just the app root.
  const buildHref = (version: number | null): string => {
    const sp = new URLSearchParams(searchParams?.toString() ?? '');
    if (version === null) sp.delete('v');
    else sp.set('v', String(version));
    const qs = sp.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title="Switch version"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            height: 34,
            padding: '0 14px',
            borderRadius: 999,
            border: `1px solid ${t.borderVisible}`,
            background: t.surface,
            color: t.textPrimary,
            fontFamily: editorialFonts.body,
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'background 120ms ease-out',
          }}
        >
          <History size={11} />
          <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
            {triggerLabel}
          </span>
          {!isLatestSelected ? (
            <span style={{ fontSize: 13, opacity: 0.6 }}>
              · viewing
            </span>
          ) : null}
          <ChevronDown size={11} aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} style={{ minWidth: 280 }}>
        <DropdownMenuLabel
          style={{
            fontFamily: editorialFonts.mono,
            fontSize: 10,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: t.textSecondary,
          }}
        >
          Version history
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
          {builds.map((b, i) => {
            const isCurrent =
              isLatestSelected && i === 0
                ? true
                : currentVersion != null && currentVersion === b.version;
            const isLatestRow = i === 0;
            return (
              <DropdownMenuItem key={b.id} asChild>
                <Link
                  href={buildHref(isLatestRow ? null : b.version ?? null)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '16px 1fr auto',
                    alignItems: 'center',
                    gap: 8,
                    textDecoration: 'none',
                  }}
                >
                  <span style={{ display: 'inline-flex', justifyContent: 'center' }}>
                    {isCurrent ? <Check size={13} /> : null}
                  </span>
                  <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'baseline',
                        gap: 6,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: editorialFonts.mono,
                          fontVariantNumeric: 'tabular-nums',
                          fontWeight: 600,
                          color: t.textDisplay,
                        }}
                      >
                        v{b.version ?? '—'}
                      </span>
                      {isLatestRow ? (
                        <span
                          style={{
                            fontFamily: editorialFonts.mono,
                            fontSize: 9,
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                            color: t.textSecondary,
                          }}
                        >
                          Latest
                        </span>
                      ) : null}
                    </span>
                    {b.message ? (
                      <span
                        style={{
                          fontSize: 11,
                          color: t.textSecondary,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: 220,
                        }}
                        title={b.message}
                      >
                        {b.message}
                      </span>
                    ) : null}
                  </span>
                  <span
                    style={{
                      fontFamily: editorialFonts.mono,
                      fontSize: 10,
                      color: t.textSecondary,
                    }}
                  >
                    {formatRelative(b.createdAt)}
                  </span>
                </Link>
              </DropdownMenuItem>
            );
          })}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link
            href={`/app/${encodeURIComponent(appSlug)}/history`}
            style={{
              fontSize: 12,
              color: t.textPrimary,
              textDecoration: 'none',
            }}
          >
            Open full history…
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - then);
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}
