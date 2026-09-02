/**
 * Release types + display strings shared by the server queries and the client
 * uploader. Kept free of `server-only` and any Supabase import so the client
 * bundle can use it — `lib/releases.ts` holds the server-side reads.
 */

/** The artifacts the team downloads from the gallery. */
export type ReleaseKind = 'macos-desktop' | 'chrome-extension';
export type ReleaseChannel = 'stable' | 'canary';

export const RELEASE_KINDS: ReleaseKind[] = ['macos-desktop', 'chrome-extension'];

export const RELEASE_LABELS: Record<ReleaseKind, string> = {
  'macos-desktop': 'Unicorn Capture for macOS',
  'chrome-extension': 'Capture Chrome extension',
};

export const RELEASE_HINTS: Record<ReleaseKind, string> = {
  'macos-desktop': 'Open the .dmg and drag Unicorn Studio to Applications.',
  'chrome-extension':
    'Unzip, then load it at chrome://extensions with Developer mode on.',
};

export interface Release {
  id: string;
  kind: ReleaseKind;
  channel: ReleaseChannel;
  version: string;
  file_url: string;
  file_name: string;
  size_bytes: number | null;
  notes: string | null;
  created_at: string;
}

/** Human-readable size for the download button. */
export function formatBytes(bytes: number | null): string {
  if (!bytes || bytes <= 0) return '';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}
