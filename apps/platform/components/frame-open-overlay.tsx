'use client';

import { type ReactNode, useEffect, useSyncExternalStore } from 'react';
import { FrameModalSkeleton } from '@/components/frame-modal-skeleton';
import {
  clearPendingOpen,
  getPendingOpen,
  subscribePendingOpen,
} from '@/lib/frame-preview';

/**
 * Opens the frame modal's loading shell on the same frame as a card click.
 *
 * The route's loading state can only appear once the router has something
 * back from the server, and on a cold route that took seconds, during which
 * the click looked dead. This renders the shell from the card's primed
 * preview straight away; the route's loading state or the real modal clears
 * it the moment either mounts.
 */
export function FrameOpenOverlay(): ReactNode {
  const pending = useSyncExternalStore(subscribePendingOpen, getPendingOpen, () => null);

  // A navigation that never lands (offline, an error page) must not leave a
  // spinner over the project forever.
  useEffect(() => {
    if (!pending) return;
    const t = setTimeout(clearPendingOpen, 20_000);
    return () => clearTimeout(t);
  }, [pending]);

  if (!pending) return null;
  return <FrameModalSkeleton preview={pending} onClose={clearPendingOpen} />;
}
