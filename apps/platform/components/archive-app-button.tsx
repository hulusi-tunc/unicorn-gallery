'use client';

import { Archive, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { archiveProject } from '@/lib/actions/archive';
import { useTheme } from '@/components/providers/theme-provider';
import { editorialFonts, getNd } from '@/lib/tokens';

/**
 * Header action — archive (soft-delete) the current project. After
 * success, the user is bounced back to the dashboard since the project
 * is no longer reachable from the active list. Restorable for 90 days
 * from /archived.
 *
 * Confirmation is intentionally inline (window.confirm) rather than a
 * full modal — Archive is reversible within the grace window, so the
 * blast radius is small enough that a quick confirmation is fine.
 */
export function ArchiveAppButton({
  appSlug,
  appName,
}: {
  appSlug: string;
  appName: string;
}): React.ReactNode {
  const { theme } = useTheme();
  const t = getNd(theme);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onClick = (): void => {
    setError(null);
    const confirmed = window.confirm(
      `Archive "${appName}"?\n\n` +
        "Hides the project from active lists for everyone. Snaps stay safe — restore from Archived projects within 90 days.\n\n" +
        "After 90 days the daily cleanup deletes everything permanently.",
    );
    if (!confirmed) return;
    startTransition(async () => {
      const r = await archiveProject({
        appSlug,
        reason: 'user_initiated_web',
      });
      if (!r.ok) {
        setError(r.error ?? 'Archive failed.');
        return;
      }
      router.push('/apps');
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      title={error ?? 'Archive this project'}
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
        transition: 'background 160ms ease-out, color 160ms ease-out, border-color 160ms ease-out',
        opacity: pending ? 0.7 : 1,
      }}
      onMouseEnter={(e) => {
        if (pending || error) return;
        e.currentTarget.style.borderColor = 'oklch(0.55 0.20 25)';
        e.currentTarget.style.color = 'oklch(0.55 0.20 25)';
      }}
      onMouseLeave={(e) => {
        if (pending || error) return;
        e.currentTarget.style.borderColor = t.border;
        e.currentTarget.style.color = t.textSecondary;
      }}
    >
      {pending ? (
        <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
      ) : (
        <Archive size={11} />
      )}
      <span>{pending ? 'Archiving…' : error ? 'Failed' : 'Archive'}</span>
    </button>
  );
}
