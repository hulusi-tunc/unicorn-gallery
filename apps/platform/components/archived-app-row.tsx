'use client';

import { Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import {
  hardDeleteArchivedProject,
  restoreProject,
} from '@/lib/actions/archive';
import type { AppRowWithStaff } from '@/lib/db';

export function ArchivedAppRow({
  app,
  daysRemaining,
}: {
  app: AppRowWithStaff;
  daysRemaining: number;
}): React.ReactNode {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [deletePromptOpen, setDeletePromptOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  const archivedAt = app.archived_at
    ? new Date(app.archived_at).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '—';

  const onRestore = (): void => {
    setError(null);
    startTransition(async () => {
      const r = await restoreProject({ appSlug: app.slug });
      if (!r.ok) {
        setError(r.error ?? 'Restore failed.');
      }
      // No optimistic UI — Next.js revalidates / and /archived on success.
    });
  };

  const onHardDelete = (): void => {
    setError(null);
    startTransition(async () => {
      const r = await hardDeleteArchivedProject({
        appSlug: app.slug,
        confirmation: deleteConfirmation,
      });
      if (!r.ok) {
        setError(r.error ?? 'Delete failed.');
        return;
      }
      setDeletePromptOpen(false);
      setDeleteConfirmation('');
    });
  };

  // Daygin urgency tint — anything inside 7 days bleeds amber.
  const urgent = daysRemaining <= 7;

  return (
    <tr className="border-b border-[oklch(0.94_0.007_260)] last:border-b-0 dark:border-[oklch(0.24_0.008_260)]">
      <td className="px-5 py-4">
        <div className="font-medium text-[oklch(0.15_0.008_260)] dark:text-[oklch(0.97_0.005_260)]">
          {app.name}
        </div>
        <div className="font-mono text-[11px] text-[oklch(0.55_0.01_260)] dark:text-[oklch(0.62_0.01_260)]">
          {app.slug}
        </div>
      </td>
      <td className="px-5 py-4 text-[oklch(0.42_0.01_260)] dark:text-[oklch(0.68_0.01_260)]">
        {archivedAt}
      </td>
      <td className="px-5 py-4">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
            urgent
              ? 'bg-[oklch(0.95_0.06_50)] text-[oklch(0.50_0.16_50)] dark:bg-[oklch(0.28_0.07_50)] dark:text-[oklch(0.78_0.13_50)]'
              : 'bg-[oklch(0.95_0.01_260)] text-[oklch(0.42_0.01_260)] dark:bg-[oklch(0.22_0.01_260)] dark:text-[oklch(0.78_0.01_260)]'
          }`}
        >
          {daysRemaining > 0
            ? `${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`
            : 'Awaiting cleanup'}
        </span>
      </td>
      <td className="px-5 py-4 text-right">
        {error ? (
          <div className="mb-2 text-xs text-[oklch(0.50_0.18_25)]">{error}</div>
        ) : null}
        {deletePromptOpen ? (
          <div className="inline-flex flex-col items-end gap-2">
            <p className="text-[11px] text-[oklch(0.42_0.01_260)] dark:text-[oklch(0.68_0.01_260)]">
              Type <span className="font-mono">{app.slug}</span> to confirm:
            </p>
            <div className="inline-flex items-center gap-2">
              <input
                type="text"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder={app.slug}
                disabled={pending}
                className="h-7 w-40 rounded-md border border-[oklch(0.85_0.009_260)] bg-white px-2 font-mono text-xs text-[oklch(0.15_0.008_260)] outline-none focus:border-[oklch(0.50_0.18_25)] dark:border-[oklch(0.30_0.008_260)] dark:bg-[oklch(0.22_0.008_260)] dark:text-[oklch(0.97_0.005_260)]"
              />
              <button
                type="button"
                disabled={pending || deleteConfirmation !== app.slug}
                onClick={onHardDelete}
                className="inline-flex items-center gap-1.5 rounded-full bg-[oklch(0.55_0.20_25)] px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Trash2 size={12} />
                )}
                {pending ? 'Deleting…' : 'Delete forever'}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setDeletePromptOpen(false);
                  setDeleteConfirmation('');
                  setError(null);
                }}
                className="text-xs text-[oklch(0.55_0.01_260)] hover:underline disabled:opacity-50 dark:text-[oklch(0.68_0.01_260)]"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => setDeletePromptOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[oklch(0.85_0.009_260)] bg-white px-3 py-1.5 text-xs font-medium text-[oklch(0.55_0.01_260)] transition-colors hover:border-[oklch(0.55_0.20_25)] hover:text-[oklch(0.55_0.20_25)] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[oklch(0.30_0.008_260)] dark:bg-[oklch(0.22_0.008_260)] dark:text-[oklch(0.68_0.01_260)] dark:hover:border-[oklch(0.65_0.20_25)] dark:hover:text-[oklch(0.65_0.20_25)]"
            >
              <Trash2 size={12} />
              Delete now
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={onRestore}
              className="inline-flex items-center gap-1.5 rounded-full border border-[oklch(0.85_0.009_260)] bg-white px-3 py-1.5 text-xs font-medium text-[oklch(0.24_0.01_260)] transition-colors hover:border-[oklch(0.5_0.22_254)] hover:text-[oklch(0.5_0.22_254)] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[oklch(0.30_0.008_260)] dark:bg-[oklch(0.22_0.008_260)] dark:text-[oklch(0.82_0.012_260)] dark:hover:border-[oklch(0.6_0.21_254)] dark:hover:text-[oklch(0.6_0.21_254)]"
            >
              {pending ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <RotateCcw size={12} />
              )}
              {pending ? 'Restoring…' : 'Restore'}
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}
