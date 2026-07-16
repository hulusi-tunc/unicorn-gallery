'use client';

import { Archive, FileDown, Images, MoreHorizontal } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition, type ReactNode } from 'react';
import { useTheme } from '@/components/providers/theme-provider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { archiveProject } from '@/lib/actions/archive';
import { downloadExport } from '@/lib/download-export';
import { editorialFonts, getNd } from '@/lib/tokens';

/**
 * Overflow "⋯" menu for the secondary app actions — exports + archive.
 * Keeps the header to a single primary action (Share) plus this menu, instead
 * of a row of competing buttons. Exports target the latest build; pick a past
 * version with the version switcher to browse it.
 */
export function AppActionsMenu({
  appSlug,
  appName,
  canArchive,
}: {
  appSlug: string;
  appName: string;
  canArchive: boolean;
}): ReactNode {
  const { theme } = useTheme();
  const t = getNd(theme);
  const router = useRouter();
  const [, startArchive] = useTransition();

  const exportFile = async (kind: 'pdf' | 'pngs'): Promise<void> => {
    try {
      await downloadExport(appSlug, kind, null);
    } catch (e) {
      window.alert((e as Error).message);
    }
  };

  const onArchive = (): void => {
    const ok = window.confirm(
      `Archive "${appName}"?\n\n` +
        'Hides the project from active lists for everyone. Snaps stay safe — restore from Archived projects within 90 days.',
    );
    if (!ok) return;
    startArchive(async () => {
      const r = await archiveProject({ appSlug, reason: 'user_initiated_web' });
      if (!r.ok) {
        window.alert(r.error ?? 'Archive failed.');
        return;
      }
      router.push('/apps');
    });
  };

  const item: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 10,
    fontFamily: editorialFonts.body,
    fontSize: 13,
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="More actions"
          title="More actions"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            borderRadius: 8,
            border: `1px solid ${t.border}`,
            background: t.surface,
            color: t.textSecondary,
            cursor: 'pointer',
            transition: 'background 160ms ease-out, color 160ms ease-out',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = t.surfaceRaised;
            e.currentTarget.style.color = t.textDisplay;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = t.surface;
            e.currentTarget.style.color = t.textSecondary;
          }}
        >
          <MoreHorizontal size={16} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6}>
        <DropdownMenuItem onSelect={() => void exportFile('pdf')}>
          <span style={item}>
            <FileDown size={14} /> Export PDF
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void exportFile('pngs')}>
          <span style={item}>
            <Images size={14} /> Export PNGs (ZIP)
          </span>
        </DropdownMenuItem>
        {canArchive ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onArchive}>
              <span style={{ ...item, color: t.danger }}>
                <Archive size={14} /> Archive project
              </span>
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
