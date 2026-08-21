'use client';

import { Check, ChevronDown, FileDown, Loader2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDownloadToast } from '@/components/download-toast';
import { useTheme } from '@/components/providers/theme-provider';
import type { BuildSummary } from '@/lib/queries';
import { editorialFonts, getNd } from '@/lib/tokens';

/**
 * Header action — download every screen in the current project as a single
 * PDF. Opens a dropdown so PMs/designers can pick which version to export
 * (defaults to "Latest"). Hidden from customers via the canEdit gate in
 * AppHeader; the API enforces the same role check server-side.
 */
export function DownloadPdfButton({
  appSlug,
  appName,
  builds,
}: {
  appSlug: string;
  appName: string;
  builds: BuildSummary[];
}): ReactNode {
  const { theme } = useTheme();
  const t = getNd(theme);
  const toast = useDownloadToast();
  const [pendingVersion, setPendingVersion] = useState<number | 'latest' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pending = pendingVersion !== null;

  const onDownload = async (version: number | null): Promise<void> => {
    setError(null);
    setPendingVersion(version ?? 'latest');
    const filename = `${appSlug}-${version != null ? `v${version}` : 'latest'}.pdf`;
    const toastId = toast.start('pdf', filename);
    try {
      const qs = version != null ? `?v=${version}` : '';
      const res = await fetch(
        `/api/projects/${encodeURIComponent(appSlug)}/download-pdf${qs}`,
        { credentials: 'same-origin' },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Download failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast.finish(toastId);
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      toast.fail(toastId, msg);
    } finally {
      setPendingVersion(null);
    }
  };

  const hasVersions = builds.length > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={pending}
          title={error ?? `Download ${appName} as PDF`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            height: 22,
            padding: '0 10px',
            borderRadius: 999,
            border: `1px solid ${error ? 'oklch(0.55 0.20 25)' : t.border}`,
            background: t.surface,
            color: error ? 'oklch(0.55 0.20 25)' : t.textSecondary,
            fontFamily: editorialFonts.mono,
            fontSize: 10,
            letterSpacing: '0.04em',
            cursor: pending ? 'wait' : 'pointer',
            opacity: pending ? 0.7 : 1,
            transition:
              'background 160ms ease-out, color 160ms ease-out, border-color 160ms ease-out',
          }}
        >
          {pending ? (
            <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
          ) : (
            <FileDown size={11} />
          )}
          <span>{pending ? 'Preparing…' : error ? 'Failed' : 'PDF'}</span>
          {!pending ? <ChevronDown size={11} aria-hidden /> : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} style={{ minWidth: 240 }}>
        <DropdownMenuLabel
          style={{
            fontFamily: editorialFonts.mono,
            fontSize: 10,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: t.textSecondary,
          }}
        >
          Download as PDF
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            void onDownload(null);
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              width: 14,
              justifyContent: 'center',
              marginRight: 6,
            }}
          >
            {pendingVersion === 'latest' ? (
              <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <Check size={11} style={{ opacity: 0 }} />
            )}
          </span>
          <span style={{ flex: 1 }}>Latest</span>
          {hasVersions && builds[0]?.version != null ? (
            <span
              style={{
                fontFamily: editorialFonts.mono,
                fontSize: 10,
                color: t.textSecondary,
              }}
            >
              v{builds[0].version}
            </span>
          ) : null}
        </DropdownMenuItem>

        {builds.length > 1 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel
              style={{
                fontFamily: editorialFonts.mono,
                fontSize: 10,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: t.textSecondary,
              }}
            >
              Previous versions
            </DropdownMenuLabel>
            <div style={{ maxHeight: 280, overflowY: 'auto' }}>
              {builds.slice(1).map((b) => (
                <DropdownMenuItem
                  key={b.id}
                  onSelect={(e) => {
                    e.preventDefault();
                    if (b.version != null) void onDownload(b.version);
                  }}
                  disabled={b.version == null}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      width: 14,
                      justifyContent: 'center',
                      marginRight: 6,
                    }}
                  >
                    {pendingVersion === b.version ? (
                      <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
                    ) : null}
                  </span>
                  <span
                    style={{
                      fontFamily: editorialFonts.mono,
                      fontVariantNumeric: 'tabular-nums',
                      fontWeight: 600,
                      color: t.textDisplay,
                      flex: 1,
                    }}
                  >
                    v{b.version ?? '—'}
                  </span>
                  {b.message ? (
                    <span
                      style={{
                        fontSize: 11,
                        color: t.textSecondary,
                        maxWidth: 140,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        marginLeft: 8,
                      }}
                      title={b.message}
                    >
                      {b.message}
                    </span>
                  ) : null}
                </DropdownMenuItem>
              ))}
            </div>
          </>
        ) : null}

        {error ? (
          <>
            <DropdownMenuSeparator />
            <div
              style={{
                padding: '8px 10px',
                fontSize: 11,
                color: t.danger,
                fontFamily: editorialFonts.body,
              }}
            >
              {error}
            </div>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
